"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { usePayments, useUpdatePayment } from "@/lib/storage/payments";
import { useUpdateRegistration } from "@/lib/storage/registrations";
import { createClient } from "@/lib/supabase/client";
import { Payment } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { CreditCard, Search, FileDown, Eye, CheckCircle, XCircle, Clock, AlertCircle, User, FileText, Camera } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LoadingBar } from "@/components/ui/loading-bar";

const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`;

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
  const [refreshKey, setRefreshKey] = useState(0);

  // Review modal state
  const [reviewingPayment, setReviewingPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject"; payment: Payment } | null>(null);
  const [processing, setProcessing] = useState(false);

  const { data: paymentsData = [], isFetching: isFetchingPayments } = usePayments();
  const payments = paymentsData;
  const updatePaymentMutation = useUpdatePayment();
  const updateRegistrationMutation = useUpdateRegistration();
  const filtered = useMemo(() => payments.filter(p => {
    const matchesSearch = p.institutionName.toLowerCase().includes(search.toLowerCase()) || p.transactionId.toLowerCase().includes(search.toLowerCase()) || p.studentName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter ||
      (statusFilter === "STUDENT_SUBMITTED" ? p.submittedByStudent && p.status === "PENDING" : p.status === statusFilter);
    return matchesSearch && matchesStatus;
  }), [payments, search, statusFilter, refreshKey]);

  const totalAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const paidAmount = useMemo(() => payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0), [payments]);
  const pendingAmount = useMemo(() => payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0), [payments]);
  const studentSubmittedCount = useMemo(() => payments.filter(p => p.submittedByStudent && p.status === "PENDING").length, [payments]);

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = useMemo(() => [
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: "studentName" },
    { header: isBn ? 'প্রতিষ্ঠান' : 'Institution', key: "institutionName" },
    { header: isBn ? 'পরিমাণ' : 'Amount', key: "amount" },
    { header: isBn ? 'পদ্ধতি' : 'Method', key: "paymentMethod" },
    { header: isBn ? 'রসিদ' : 'Receipt', key: "receiptNumber" },
    { header: isBn ? 'স্ট্যাটাস' : 'Status', key: "status" },
  ], [isBn]);

  const pdfData = useMemo(() => filtered.map(p => ({
    studentName: p.studentName || "-",
    institutionName: p.institutionName,
    amount: formatCurrency(p.amount),
    paymentMethod: p.paymentMethod,
    receiptNumber: p.receiptNumber || "-",
    status: p.status,
  })), [filtered]);

  useEffect(() => { setMounted(true); }, []);

  const handleApprove = async (payment: Payment) => {
    setProcessing(true);
    try {
      await updatePaymentMutation.mutateAsync({
        id: payment.id,
        data: {
          status: "PAID",
          verifiedBySuperAdmin: "super-admin",
          verifiedAt: new Date().toISOString(),
        },
      });

      if (payment.registrationId) {
        await updateRegistrationMutation.mutateAsync({
          id: payment.registrationId,
          data: {
            status: "APPROVED",
            paymentStatus: "PAID",
            studentPaymentStatus: "VERIFIED",
          },
        });
      }

      toast("success", isBn ? "পেমেন্ট যাচাইকৃত হয়েছে" : "Payment verified successfully");
      setConfirmAction(null);
      setRefreshKey(k => k + 1);
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

      toast("success", isBn ? "পেমেন্ট প্রত্যাখ্যাত হয়েছে" : "Payment rejected");
      setConfirmAction(null);
      setRejectReason("");
      setRefreshKey(k => k + 1);
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
            {isBn ? 'সমস্ত লেনদেন ট্র্যাক এবং পরিচালনা করুন' : 'Track and manage all transactions'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট অর্থ' : 'Total Amount', value: formatCurrency(totalAmount), color: "" },
            { label: isBn ? 'পরিশোধিত' : 'Paid', value: formatCurrency(paidAmount), color: "text-green-400" },
            { label: isBn ? 'অপেক্ষমাণ' : 'Pending', value: formatCurrency(pendingAmount), color: "text-amber-400" },
            { label: isBn ? 'শিক্ষার্থী জমা' : 'Student Submitted', value: studentSubmittedCount, color: "text-blue-400" },
            { label: isBn ? 'মোট লেনদেন' : 'Transactions', value: payments.length, color: "" },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <CreditCard className={`h-5 w-5 ${iconColor}`} />
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
              <Input placeholder={isBn ? "শিক্ষার্থী, প্রতিষ্ঠান বা ট্রানজেকশন আইডি দিয়ে অনুসন্ধান..." : "Search by student, institution or transaction ID..."} value={search} onChange={(e) => setSearch(e.target.value)}
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
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরিমাণ' : 'Amount'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পদ্ধতি' : 'Method'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রসিদ' : 'Receipt'}</TableHead>
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
                          {payment.studentName || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.institutionName}</TableCell>
                    <TableCell className={`text-[11px] font-mono font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.paymentMethod}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{payment.receiptNumber || "-"}</TableCell>
                    <TableCell><Badge status={payment.status} /></TableCell>
                    <TableCell>
                      {payment.submittedByStudent && payment.status === "PENDING" && (
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
            {/* Student Info */}
            <div className={`p-3 rounded-lg ${isDark ? "bg-white/[0.02] border border-white/[0.06]" : "bg-zinc-50 border border-zinc-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <User className={`h-4 w-4 ${iconColor}`} />
                <span className={`text-[11px] font-medium ${labelCls}`}>{isBn ? "শিক্ষার্থী তথ্য" : "Student Info"}</span>
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{reviewingPayment.studentName}</p>
              <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{reviewingPayment.institutionName}</p>
            </div>

            {/* Payment Details */}
            <div className="space-y-2">
              {[
                { label: isBn ? "পরিমাণ" : "Amount", value: formatCurrency(reviewingPayment.amount) },
                { label: isBn ? "পেমেন্ট পদ্ধতি" : "Payment Method", value: reviewingPayment.paymentMethod },
                { label: isBn ? "পেমেন্ট তারিখ" : "Payment Date", value: reviewingPayment.paymentDate || reviewingPayment.date },
                { label: isBn ? "অ্যাকাউন্ট নম্বর" : "Account Number", value: reviewingPayment.accountNumber || "-" },
                { label: isBn ? "রসিদ নম্বর" : "Receipt Number", value: reviewingPayment.receiptNumber || "-" },
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
          {reviewingPayment?.status === "PENDING" && reviewingPayment?.submittedByStudent && (
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
      <Modal open={!!confirmAction} onClose={() => { setConfirmAction(null); setRejectReason(""); }} title={confirmAction?.type === "approve" ? (isBn ? "পেমেন্ট অনুমোদন?" : "Approve Payment?") : (isBn ? "পেমেন্ট প্রত্যাখ্যান?" : "Reject Payment?")}>
        {confirmAction && (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {confirmAction.type === "approve"
                ? (isBn ? `"${confirmAction.payment.studentName}" এর ৳${confirmAction.payment.amount.toLocaleString()} পেমেন্ট যাচাইকৃত হবে। নিবন্ধন অনুমোদিত হবে।` : `"${confirmAction.payment.studentName}"'s ৳${confirmAction.payment.amount.toLocaleString()} payment will be verified. Registration will be approved.`)
                : (isBn ? `"${confirmAction.payment.studentName}" এর পেমেন্ট প্রত্যাখ্যাত হবে।` : `"${confirmAction.payment.studentName}"'s payment will be rejected.`)}
            </p>
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
          <button onClick={() => { setConfirmAction(null); setRejectReason(""); }} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={() => confirmAction && (confirmAction.type === "approve" ? handleApprove(confirmAction.payment) : handleReject(confirmAction.payment))}
            disabled={processing || (confirmAction?.type === "reject" && !rejectReason.trim())}
            className={cn(
              "px-4 py-2 rounded-md text-[13px] font-medium transition-all",
              confirmAction?.type === "approve" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700",
              (processing || (confirmAction?.type === "reject" && !rejectReason.trim())) && "opacity-50 cursor-not-allowed"
            )}
          >
            {processing ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : confirmAction?.type === "approve" ? (isBn ? "অনুমোদন" : "Approve") : (isBn ? "প্রত্যাখ্যান" : "Reject")}
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

const labelCls = ""; // placeholder - will be resolved in context

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
