"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAllPayments, useUpdatePayment, computeDue } from "@/lib/storage/payments";
import { useUpdateRegistration, useAllRegistrations, useAllRegistrationsByInstitution } from "@/lib/storage/registrations";
import { Payment, Registration } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { CreditCard, Search, FileDown, Eye, CheckCircle, XCircle, Wallet, Users, Clock } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LoadingBar } from "@/components/ui/loading-bar";
import { createClient } from "@/lib/supabase/client";
import { notifyUser } from "@/lib/storage/notifications";

const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`;

const isPendingReg = (r: Registration) => r.status !== 'APPROVED' && r.status !== 'VERIFIED' && r.status !== 'REJECTED';

/** Stable empty array so `data ?? EMPTY_REGS` keeps referential identity. */
const EMPTY_REGS: Registration[] = [];
const EMPTY_REGS_PAYMENT: Payment[] = [];

export default function PaymentsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Review modal state
  const [reviewingPayment, setReviewingPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject"; payment: Payment } | null>(null);
  const [processing, setProcessing] = useState(false);
  // Students ticked inside the approve modal
  const [selectedRegs, setSelectedRegs] = useState<string[]>([]);

  const { data: fetchedPayments, isFetching: isFetchingPayments } = useAllPayments();
  const { data: fetchedRegistrations } = useAllRegistrations();
  const payments = fetchedPayments ?? EMPTY_REGS_PAYMENT;
  const registrations = fetchedRegistrations ?? EMPTY_REGS;
  const updatePaymentMutation = useUpdatePayment();
  const updateRegistrationMutation = useUpdateRegistration();

  // That institution's pending students, for the approve checklist.
  // NOTE: stable fallback array — `data = []` destructuring would allocate a
  // new reference every render and re-trigger the pre-tick effect forever.
  const { data: fetchedInstitutionRegs, isFetching: fetchingRegs } = useAllRegistrationsByInstitution(confirmAction?.payment.institutionId || '', confirmAction?.payment.sessionId);
  const institutionRegs = fetchedInstitutionRegs ?? EMPTY_REGS;

  const filtered = useMemo(() => payments.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = p.institutionName.toLowerCase().includes(q) || p.transactionId.toLowerCase().includes(q) ||
      (p.reference && p.reference.toLowerCase().includes(q)) || p.studentName?.toLowerCase().includes(q);
    const matchesStatus = !statusFilter ||
      (statusFilter === "STUDENT_SUBMITTED" ? p.submittedByStudent && p.status === "PENDING" : p.status === statusFilter);
    return matchesSearch && matchesStatus;
  }), [payments, search, statusFilter]);

  // Due = all student fees − approved (PAID) payments
  const totalFees = useMemo(() => registrations.reduce((sum, r) => sum + Number(r.paymentAmount || 0), 0), [registrations]);
  const dueAmount = useMemo(() => computeDue(registrations, payments), [registrations, payments]);
  const paidAmount = useMemo(() => payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0), [payments]);
  const pendingAmount = useMemo(() => payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0), [payments]);
  const studentSubmittedCount = useMemo(() => payments.filter(p => p.submittedByStudent && p.status === "PENDING").length, [payments]);

  const pendingInstitutionRegs = useMemo(() => institutionRegs.filter(isPendingReg), [institutionRegs]);

  // Only write state when the value actually changes (prevents render loops)
  const setSelectedRegsStable = useCallback((next: string[]) => {
    setSelectedRegs(prev =>
      prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next
    );
  }, []);

  const clearSelectedRegs = useCallback(() => {
    setSelectedRegs(prev => (prev.length === 0 ? prev : []));
  }, []);

  // Pre-tick round(amount ÷ fee) students (or the linked registration for student payments)
  useEffect(() => {
    if (confirmAction?.type !== "approve") { clearSelectedRegs(); return; }
    if (fetchingRegs || pendingInstitutionRegs.length === 0) { clearSelectedRegs(); return; }
    const p = confirmAction.payment;
    if (p.registrationId) {
      setSelectedRegsStable(pendingInstitutionRegs.some(r => r.id === p.registrationId) ? [p.registrationId] : []);
      return;
    }
    const fee = pendingInstitutionRegs[0]?.paymentAmount || 0;
    const count = fee > 0 ? Math.min(pendingInstitutionRegs.length, Math.round(p.amount / fee)) : 0;
    setSelectedRegsStable(pendingInstitutionRegs.slice(0, count).map(r => r.id));
  }, [confirmAction, pendingInstitutionRegs, fetchingRegs, clearSelectedRegs, setSelectedRegsStable]);

  const toggleReg = (id: string) => {
    setSelectedRegs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: "institutionName" },
    { header: isBn ? 'ইনভয়েস' : 'Invoice', key: "invoice" },
    { header: isBn ? 'পরিমাণ' : 'Amount', key: "amount" },
    { header: isBn ? 'পদ্ধতি' : 'Method', key: "paymentMethod" },
    { header: isBn ? 'তারিখ' : 'Date', key: "paymentDate" },
    { header: isBn ? 'স্ট্যাটাস' : 'Status', key: "status" },
  ], [isBn]);

  const pdfData = useMemo(() => filtered.map(p => ({
    studentName: p.studentName || "-",
    institutionName: p.institutionName,
    invoice: p.reference || p.receiptNumber || p.transactionId,
    amount: formatCurrency(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate: formatDate(p.paymentDate || p.date),
    status: p.status,
  })), [filtered]);

  useEffect(() => { setMounted(true); }, []);

  // Tell the institution's admin about an approve/reject decision.
  // Fire-and-forget with internal catch — never blocks the decision.
  const notifyInstitutionAdmin = (
    payment: Payment,
    type: 'success' | 'warning',
    title: string,
    message: string
  ) => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: instRow } = await supabase
          .from('institutions')
          .select('admin_user_id, slug')
          .eq('id', payment.institutionId)
          .maybeSingle();
        if (instRow?.admin_user_id) {
          await notifyUser(instRow.admin_user_id, title, message, type, `/i/${instRow.slug}/payments`);
        }
      } catch (e) {
        console.error('[payment-notification] notify institution admin failed (run migration 0008):', e);
      }
    })();
  };

  const handleApprove = async (payment: Payment) => {
    setProcessing(true);
    try {
      await updatePaymentMutation.mutateAsync({
        id: payment.id,
        data: {
          status: "PAID",
          // verified_by_super_admin is a UUID column; only stamp the timestamp here
          verifiedAt: new Date().toISOString(),
        },
      });

      if (selectedRegs.length > 0) {
        await Promise.all(selectedRegs.map(id =>
          updateRegistrationMutation.mutateAsync({
            id,
            data: {
              status: "APPROVED",
              paymentStatus: "PAID",
              studentPaymentStatus: "VERIFIED",
            },
          })
        ));
      }

      notifyInstitutionAdmin(
        payment,
        'success',
        isBn ? 'পেমেন্ট অনুমোদিত' : 'Payment approved',
        `${formatCurrency(payment.amount)} · ${selectedRegs.length} ${isBn ? 'জন শিক্ষার্থী অনুমোদিত হয়েছে' : 'student(s) approved'}`
      );

      toast("success", isBn
        ? `পেমেন্ট অনুমোদিত — ${selectedRegs.length} জন শিক্ষার্থী অনুমোদিত হয়েছে`
        : `Payment approved — ${selectedRegs.length} student(s) approved`);
      setConfirmAction(null);
      setSelectedRegs([]);
    } catch {
      toast("error", isBn ? "সমস্যা হয়েছে" : "Error occurred");
    }
    setProcessing(false);
  };

  const handleReject = async (payment: Payment) => {
    if (!rejectReason.trim()) {
      toast("error", isBn ? "কারণ লিখুন" : "Please provide a reason");
      return;
    }
    setProcessing(true);
    try {
      await updatePaymentMutation.mutateAsync({
        id: payment.id,
        data: {
          status: "FAILED",
          rejectionReason: rejectReason,
        },
      });

      if (payment.registrationId) {
        await updateRegistrationMutation.mutateAsync({
          id: payment.registrationId,
          data: {
            studentPaymentStatus: "REJECTED",
          },
        });
      }

      notifyInstitutionAdmin(
        payment,
        'warning',
        isBn ? 'পেমেন্ট প্রত্যাখ্যাত' : 'Payment rejected',
        `${formatCurrency(payment.amount)} · ${rejectReason.trim()}`
      );

      toast("success", isBn ? "পেমেন্ট প্রত্যাখ্যাত হয়েছে" : "Payment rejected");
      setConfirmAction(null);
      setRejectReason("");
    } catch {
      toast("error", isBn ? "সমস্যা হয়েছে" : "Error occurred");
    }
    setProcessing(false);
  };

  if (!mounted) return <PaymentsSkeleton isDark={isDark} />;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-md" : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetchingPayments} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'পেমেন্ট' : 'Payments'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্রতিষ্ঠানের জমাকৃত পেমেন্ট যাচাই ও অনুমোদন করুন' : 'Review and approve institution payments'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট বাকি' : 'Total Due', value: formatCurrency(dueAmount), color: "text-amber-400", icon: Wallet },
            { label: isBn ? 'পরিশোধিত' : 'Paid', value: formatCurrency(paidAmount), color: "text-green-400", icon: CheckCircle },
            { label: isBn ? 'অনুমোদনে অপেক্ষমাণ' : 'Pending Approval', value: formatCurrency(pendingAmount), color: "text-blue-400", icon: Clock },
            { label: isBn ? 'শিক্ষার্থী জমা' : 'Student Submitted', value: studentSubmittedCount, color: "text-purple-400", icon: Users },
            { label: isBn ? 'মোট ফি' : 'Total Fees', value: formatCurrency(totalFees), color: "", icon: CreditCard },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${s.color || (isDark ? "text-white" : "text-zinc-900")}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "প্রতিষ্ঠান, ইনভয়েস বা শিক্ষার্থীর নাম দিয়ে অনুসন্ধান..." : "Search by institution, invoice or student name..."} value={search} onChange={(e) => setSearch(e.target.value)}
                className={cn("pl-10", inputCls)} />
            </div>
            <Select options={[
              { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
              { label: isBn ? 'শিক্ষার্থী জমা (মুলতুবি)' : 'Student Submitted', value: 'STUDENT_SUBMITTED' },
              { label: 'PAID', value: 'PAID' },
              { label: 'PENDING', value: 'PENDING' },
              { label: 'FAILED', value: 'FAILED' },
            ]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-48", inputCls)} />
          </div>
        </div>

        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <CreditCard className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'লেনদেন তালিকা' : 'Transactions'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <CreditCard className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো লেনদেন পাওয়া যায়নি' : 'No payments found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ইনভয়েস' : 'Invoice'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরিমাণ' : 'Amount'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পদ্ধতি' : 'Method'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(payment => (
                  <TableRow key={payment.id} className={`${isDark ? 'border-white/[0.04]' : 'border-zinc-100'} ${selection.isSelected(payment.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(payment.id)} onChange={() => selection.toggle(payment.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {payment.submittedByStudent && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                          {payment.studentName || (isBn ? 'প্রতিষ্ঠান' : 'Institution')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.institutionName}</TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{payment.reference || payment.receiptNumber || payment.transactionId}</TableCell>
                    <TableCell className={`text-[11px] font-mono font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.paymentMethod}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(payment.paymentDate || payment.date)}</TableCell>
                    <TableCell><Badge status={payment.status} /></TableCell>
                    <TableCell>
                      {payment.status === "PENDING" && (
                        <TableActionMenu id={payment.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                          <TableActionItem onClick={() => { setReviewingPayment(payment); setMenuOpenId(null); }} isDark={isDark}>
                            <Eye className="h-3.5 w-3.5" /> {isBn ? "বিস্তারিত" : "Review"}
                          </TableActionItem>
                          <TableActionItem onClick={() => { setConfirmAction({ type: "approve", payment }); setMenuOpenId(null); }} isDark={isDark} variant="success">
                            <CheckCircle className="h-3.5 w-3.5" /> {isBn ? "অনুমোদন" : "Approve"}
                          </TableActionItem>
                          <TableActionItem onClick={() => { setConfirmAction({ type: "reject", payment }); setMenuOpenId(null); }} isDark={isDark} variant="danger">
                            <XCircle className="h-3.5 w-3.5" /> {isBn ? "প্রত্যাখ্যান" : "Reject"}
                          </TableActionItem>
                        </TableActionMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Review Detail Modal */}
      <Modal open={!!reviewingPayment} onClose={() => setReviewingPayment(null)} title={isBn ? "পেমেন্ট পর্যালোচনা" : "Payment Review"} maxWidth="max-w-lg">
        {reviewingPayment && (
          <div className="space-y-4">
            {/* Student / Institution Info */}
            <div className={`p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.06]" : "bg-zinc-50 border border-zinc-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Users className={`h-4 w-4 ${iconColor}`} />
                <span className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{reviewingPayment.studentName ? (isBn ? "শিক্ষার্থী তথ্য" : "Student Info") : (isBn ? "প্রতিষ্ঠান তথ্য" : "Institution Info")}</span>
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{reviewingPayment.studentName || (isBn ? "প্রতিষ্ঠান পেমেন্ট" : "Institution Payment")}</p>
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{reviewingPayment.institutionName}</p>
            </div>

            {/* Payment Details */}
            <div className="space-y-2">
              {[
                { label: isBn ? "ইনভয়েস" : "Invoice", value: reviewingPayment.reference || reviewingPayment.transactionId },
                { label: isBn ? "পরিমাণ" : "Amount", value: formatCurrency(reviewingPayment.amount) },
                { label: isBn ? "পেমেন্ট পদ্ধতি" : "Payment Method", value: reviewingPayment.paymentMethod },
                { label: isBn ? "পেমেন্ট তারিখ" : "Payment Date", value: reviewingPayment.paymentDate || reviewingPayment.date },
                { label: isBn ? "অ্যাকাউন্ট নম্বর" : "Account Number", value: reviewingPayment.accountNumber || "-" },
                ...(reviewingPayment.studentCount ? [{ label: isBn ? "শিক্ষার্থী সংখ্যা" : "Students Covered", value: String(reviewingPayment.studentCount) }] : []),
                { label: isBn ? "জমার তারিখ" : "Submitted At", value: reviewingPayment.submittedAt ? formatDate(reviewingPayment.submittedAt) : "-" },
              ].map((item) => (
                <div key={item.label} className={`flex items-center justify-between py-1.5 border-b ${isDark ? "border-white/[0.04]" : "border-zinc-100"}`}>
                  <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{item.label}</span>
                  <span className={`text-[11px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Proof Image */}
            {reviewingPayment.proofImage && (
              <div>
                <span className={`text-[11px] font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "রসিদের ছবি" : "Receipt Screenshot"}</span>
                <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.06]">
                  <img src={reviewingPayment.proofImage} alt="Receipt" className="w-full max-h-64 object-contain bg-black/20" />
                </div>
              </div>
            )}

            {reviewingPayment.notes && (
              <div className={`p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.06]" : "bg-zinc-50 border border-zinc-200"}`}>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? "মন্তব্য" : "Notes"}</span>
                <p className={`text-[11px] mt-1 ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{reviewingPayment.notes}</p>
              </div>
            )}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => setReviewingPayment(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
            {isBn ? "বন্ধ" : "Close"}
          </button>
          {reviewingPayment?.status === "PENDING" && (
            <>
              <button onClick={() => { setConfirmAction({ type: "reject", payment: reviewingPayment }); setReviewingPayment(null); }} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">
                {isBn ? "প্রত্যাখ্যান" : "Reject"}
              </button>
              <button onClick={() => { setConfirmAction({ type: "approve", payment: reviewingPayment }); setReviewingPayment(null); }} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-green-600 text-white hover:bg-green-700">
                {isBn ? "অনুমোদন" : "Approve"}
              </button>
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* Approve/Reject Confirmation Modal */}
      <Modal open={!!confirmAction} onClose={() => { setConfirmAction(null); setRejectReason(""); setSelectedRegs([]); }}
        title={confirmAction?.type === "approve" ? (isBn ? "পেমেন্ট অনুমোদন?" : "Approve Payment?") : (isBn ? "পেমেন্ট প্রত্যাখ্যান?" : "Reject Payment?")}
        maxWidth="max-w-lg">
        {confirmAction && (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {confirmAction.type === "approve"
                ? (isBn ? `"${confirmAction.payment.institutionName}" এর ৳${confirmAction.payment.amount.toLocaleString()} পেমেন্ট অনুমোদন হবে। নিচ থেকে যেসব শিক্ষার্থী অনুমোদিত হবে নির্বাচন করুন।` : `"${confirmAction.payment.institutionName}"'s ৳${confirmAction.payment.amount.toLocaleString()} payment will be approved. Select which students to approve below.`)
                : (isBn ? `"${confirmAction.payment.institutionName}" এর পেমেন্ট প্রত্যাখ্যাত হবে।` : `"${confirmAction.payment.institutionName}"'s payment will be rejected.`)}
            </p>

            {confirmAction.type === "approve" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? "শিক্ষার্থী অনুমোদন করুন" : "Select students to approve"}</label>
                  <span className={`text-[11px] font-mono ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{selectedRegs.length}/{pendingInstitutionRegs.length}</span>
                </div>
                {fetchingRegs ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin text-zinc-400" />
                  </div>
                ) : pendingInstitutionRegs.length === 0 ? (
                  <p className={`text-[11px] py-3 text-center rounded-md ${isDark ? "bg-white/[0.02] text-zinc-500" : "bg-zinc-50 text-zinc-500"}`}>
                    {isBn ? "এই প্রতিষ্ঠানে কোনো মুলতুবি শিক্ষার্থী নেই" : "No pending students at this institution"}
                  </p>
                ) : (
                  <>
                    <div className={`max-h-56 overflow-y-auto rounded-md border ${isDark ? "border-white/[0.08]" : "border-zinc-200"}`}>
                      {pendingInstitutionRegs.map((r, i) => (
                        <label key={r.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/[0.03] ${i > 0 ? (isDark ? "border-t border-white/[0.05]" : "border-t border-zinc-100") : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectedRegs.includes(r.id)}
                            onChange={() => toggleReg(r.id)}
                            className="h-4 w-4 accent-[#9333ea] shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-medium truncate ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{r.studentName}</p>
                            <p className={`text-[10px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{r.registrationNumber || r.examName}</p>
                          </div>
                          <span className={`text-[11px] font-mono shrink-0 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatCurrency(Number(r.paymentAmount || 0))}</span>
                        </label>
                      ))}
                    </div>
                    <p className={`text-[10px] mt-1.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {isBn ? 'নির্বাচিত শিক্ষার্থীদের নিবন্ধন অনুমোদিত ও পরিশোধিত হিসেবে চিহ্নিত হবে।' : 'Selected students will be marked APPROVED & PAID.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {confirmAction.type === "reject" && (
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? "কারণ *" : "Reason *"}</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={isBn ? "প্রত্যাখ্যানের কারণ লিখুন" : "Enter rejection reason"}
                  rows={3}
                  className={cn("w-full px-3 py-2 rounded-md text-sm outline-none resize-none", inputCls)}
                />
              </div>
            )}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => { setConfirmAction(null); setRejectReason(""); setSelectedRegs([]); }} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={() => confirmAction && (confirmAction.type === "approve" ? handleApprove(confirmAction.payment) : handleReject(confirmAction.payment))}
            disabled={processing || fetchingRegs || (confirmAction?.type === "reject" && !rejectReason.trim())}
            className={cn(
              "px-4 py-2 rounded-md text-[13px] font-medium transition-all",
              confirmAction?.type === "approve" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700",
              (processing || fetchingRegs || (confirmAction?.type === "reject" && !rejectReason.trim())) && "opacity-50 cursor-not-allowed"
            )}
          >
            {processing
              ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : confirmAction?.type === "approve"
                ? (isBn ? `অনুমোদন (${selectedRegs.length})` : `Approve (${selectedRegs.length})`)
                : (isBn ? "প্রত্যাখ্যান" : "Reject")}
          </button>
        </ModalFooter>
      </Modal>

      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
            </span>
            <button onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-[#9333ea] text-white hover:bg-[#7e22ce] transition-colors">
              <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      <PdfExportModal open={showPdfModal} onClose={() => setShowPdfModal(false)} title={isBn ? 'পেমেন্ট তালিকা' : 'Payments List'} columns={pdfColumns} data={pdfData} />
    </div>
  );
}

function PaymentsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-12 mb-6`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
