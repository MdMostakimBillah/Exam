"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useInstitutionBySlug } from "@/lib/storage/institutions";
import { useAllPaymentsByInstitution, useCreatePayment, computeDue } from "@/lib/storage/payments";
import { useAllRegistrationsByInstitution } from "@/lib/storage/registrations";
import { useCurrentSession } from "@/lib/storage/sessions";
import { Payment } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/storage/storage";
import { CreditCard, Search, Plus, Minus, Eye, CheckCircle, Wallet, FileDown, Receipt, Calendar, Copy, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LoadingBar } from "@/components/ui/loading-bar";

const emptyForm = {
  studentCount: "1",
  paymentMethod: "BKASH" as "BKASH" | "CASH",
  accountNumber: "",
  invoiceNumber: "",
  paymentDate: new Date().toISOString().split("T")[0],
  notes: "",
};

const isPendingReg = (r: { status: string }) => r.status !== 'APPROVED' && r.status !== 'VERIFIED' && r.status !== 'REJECTED';

export default function InstitutionPaymentsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Payment instruction info set by the super-admin (system_settings)
  const [payInfo, setPayInfo] = useState<{ bkashNumber: string; bkashName: string; cashAddress: string; instructions: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const loadPayInfo = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['paymentBkashNumber', 'paymentBkashName', 'paymentCashAddress', 'paymentInstructions']);
      if (!data) { setPayInfo({ bkashNumber: '', bkashName: '', cashAddress: '', instructions: '' }); return; }
      const m = Object.fromEntries(data.map((s: any) => [s.key, s.value]));
      setPayInfo({
        bkashNumber: m.paymentBkashNumber || '',
        bkashName: m.paymentBkashName || '',
        cashAddress: m.paymentCashAddress || '',
        instructions: m.paymentInstructions || '',
      });
    };
    loadPayInfo();
  }, []);

  const { data: inst } = useInstitutionBySlug(slug);
  const { data: currentSession } = useCurrentSession();
  const { data: payments = [], isFetching } = useAllPaymentsByInstitution(inst?.id || '', currentSession?.id);
  const { data: registrations = [] } = useAllRegistrationsByInstitution(inst?.id || '', currentSession?.id);
  const createPaymentMutation = useCreatePayment();

  const filtered = payments.filter(p => {
    const matchesSearch = !search ||
      (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
      (p.studentName && p.studentName.toLowerCase().includes(search.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !statusFilter ||
      (statusFilter === "STUDENT_SUBMITTED" ? p.submittedByStudent && p.status === "PENDING" : p.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const selection = useTableSelection(filtered);

  const pdfColumns: PdfColumn[] = [
    { header: isBn ? 'ইনভয়েস' : 'Invoice', key: 'invoice' },
    { header: isBn ? 'শিক্ষার্থী' : 'Student', key: 'studentName' },
    { header: isBn ? 'পরিমাণ' : 'Amount', key: 'amount' },
    { header: isBn ? 'পদ্ধতি' : 'Method', key: 'paymentMethod' },
    { header: isBn ? 'তারিখ' : 'Date', key: 'paymentDate' },
    { header: isBn ? 'স্ট্যাটাস' : 'Status', key: 'status' },
  ];

  const pdfData = filtered.map(p => ({
    invoice: p.reference || p.transactionId,
    studentName: p.studentName || '-',
    amount: formatCurrency(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate: formatDate(p.paymentDate || p.date),
    status: p.status,
  }));

  // Institution due = total student fees − approved (PAID) payments
  const totalFees = registrations.reduce((sum, r) => sum + Number(r.paymentAmount || 0), 0);
  const paidAmount = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const dueAmount = computeDue(registrations, payments);
  const feePerStudent = registrations.reduce((max, r) => Math.max(max, Number(r.paymentAmount || 0)), 0);
  const pendingCount = registrations.filter(isPendingReg).length;
  const maxStudents = pendingCount > 0 ? pendingCount : (feePerStudent > 0 ? Math.floor(dueAmount / feePerStudent) : 0);

  if (!mounted) return <PaymentsSkeleton isDark={isDark} />;
  if (!inst) return null;

  const handleCreate = () => {
    setFormData({ ...emptyForm, studentCount: String(Math.max(maxStudents, 1)) });
    setShowModal(true);
  };

  const handleSave = async () => {
    const count = parseInt(formData.studentCount, 10);
    if (!formData.invoiceNumber.trim() || !formData.paymentDate) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    if (formData.paymentMethod === "BKASH" && !formData.accountNumber.trim()) {
      toast("error", isBn ? "bKash নম্বর দিন" : "Please enter your bKash number");
      return;
    }
    if (feePerStudent <= 0) {
      toast("error", isBn ? "শিক্ষার্থীর ফি পাওয়া যায়নি" : "Student fee not found");
      return;
    }
    if (!Number.isFinite(count) || count < 1 || count > maxStudents) {
      toast("error", isBn ? `১ থেকে ${maxStudents} শিক্ষার্থীর মধ্যে সংখ্যা দিন` : `Enter a student count between 1 and ${maxStudents}`);
      return;
    }
    const amount = count * feePerStudent;

    await createPaymentMutation.mutateAsync({
      sessionId: currentSession?.id || '',
      transactionId: `TXN-${Date.now()}`,
      institutionId: inst!.id,
      institutionName: inst!.name,
      studentCount: count,
      amount,
      paymentMethod: formData.paymentMethod,
      status: 'PENDING',
      date: formData.paymentDate,
      reference: formData.invoiceNumber.trim(),
      paymentDate: formData.paymentDate,
      notes: formData.notes,
      accountNumber: formData.paymentMethod === "BKASH" ? formData.accountNumber.trim() : undefined,
      submittedAt: new Date().toISOString(),
    });
    toast("success", isBn ? "পেমেন্ট জমা হয়েছে — সুপার অ্যাডমিন যাচাই করবেন" : "Payment submitted — awaiting super-admin review");
    setShowModal(false);
  };

  // Student count input: digits only, clamped to 1..maxStudents
  const clampCount = (raw: string) => {
    if (raw === "") { setFormData(f => ({ ...f, studentCount: "" })); return; }
    let n = parseInt(raw, 10);
    if (Number.isNaN(n)) n = 1;
    if (maxStudents > 0) n = Math.min(Math.max(n, 1), maxStudents);
    else n = Math.max(n, 1);
    setFormData(f => ({ ...f, studentCount: String(n) }));
  };

  const stepCount = (delta: number) => {
    const n = parseInt(formData.studentCount, 10) || 0;
    const next = Math.min(Math.max(n + delta, 1), Math.max(maxStudents, 1));
    setFormData(f => ({ ...f, studentCount: String(next) }));
  };

  const countNum = parseInt(formData.studentCount, 10) || 0;
  const amountPreview = countNum * feePerStudent;

  const copyBkashNumber = async () => {
    if (!payInfo?.bkashNumber) return;
    try {
      await navigator.clipboard.writeText(payInfo.bkashNumber);
      toast("success", isBn ? "bKash নম্বর কপি হয়েছে" : "bKash number copied");
    } catch {
      toast("error", isBn ? "কপি করা যায়নি" : "Could not copy");
    }
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'পেমেন্ট' : 'Payments'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'প্রতিষ্ঠানের বাকি ও জমাকৃত পেমেন্ট ট্র্যাক করুন' : 'Track your institution’s due and submitted payments'}
            </p>
          </div>
          <button onClick={handleCreate} disabled={dueAmount <= 0} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800", dueAmount <= 0 && "opacity-50 cursor-not-allowed")}>
            <Plus className="h-4 w-4" /> {isBn ? 'পেমেন্ট জমা দিন' : 'Submit Payment'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { icon: CreditCard, label: isBn ? 'মোট ফি' : 'Total Fees', value: formatCurrency(totalFees) },
            { icon: CheckCircle, label: isBn ? 'পরিশোধিত' : 'Paid', value: formatCurrency(paidAmount) },
            { icon: Wallet, label: isBn ? 'বাকি' : 'Due', value: formatCurrency(dueAmount) },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Payment Instructions */}
        {payInfo && (
          <div className={`${card} p-5 mb-8`}>
            <div className="flex items-center gap-2 mb-4">
              <Info className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পেমেন্ট নির্দেশনা' : 'Payment Instructions'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নিবন্ধনের টাকা যেভাবে পাঠাবেন' : 'How to send registration payment'}</span>
            </div>

            {!payInfo.bkashNumber && !payInfo.cashAddress && !payInfo.instructions ? (
              <p className={`text-[13px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {isBn ? 'পেমেন্টের তথ্য জানতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' : 'Contact the super-admin for payment details.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Send-to number */}
                {payInfo.bkashNumber && (
                  <div className={`rounded-md border p-4 ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-zinc-200 bg-zinc-50"}`}>
                    <p className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'bKash এ Send Money করুন' : 'Send Money via bKash to'}</p>
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <div className="min-w-0">
                        <p className={`text-lg font-bold font-mono tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{payInfo.bkashNumber}</p>
                        {payInfo.bkashName && <p className={`text-[11px] truncate ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{payInfo.bkashName}</p>}
                      </div>
                      <button
                        onClick={copyBkashNumber}
                        className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.12]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
                      >
                        <Copy className="h-3.5 w-3.5" /> {isBn ? 'কপি' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Steps */}
                <div>
                  <ol className={`text-[12px] space-y-1.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                    {[
                      isBn ? 'উপরের নম্বরে bKash Send Money করুন।' : 'Send Money via bKash to the number above.',
                      isBn ? 'TrxID কপি করে রাখুন।' : 'Copy the TrxID from the confirmation.',
                      isBn ? 'নিচের Submit Payment এ ইনভয়েস নম্বর ও TrxID দিন।' : 'Open Submit Payment below and enter the invoice number and TrxID.',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-200 text-zinc-700"}`}>{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {payInfo.cashAddress && (
                    <p className={`text-[11px] mt-2.5 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {isBn ? 'নগদ:' : 'Cash:'} {payInfo.cashAddress}
                    </p>
                  )}
                </div>

                {/* Admin-written instructions */}
                {payInfo.instructions && (
                  <p className={`text-[12px] whitespace-pre-line md:col-span-2 pt-1 border-t ${isDark ? "text-zinc-400 border-white/[0.06]" : "text-zinc-600 border-zinc-100"}`}>
                    {payInfo.instructions}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "ইনভয়েস বা শিক্ষার্থীর নাম দিয়ে অনুসন্ধান..." : "Search by invoice or student name..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'শিক্ষার্থী জমা (মুলতুবি)' : 'Student Submitted', value: 'STUDENT_SUBMITTED' },
                { label: 'PENDING', value: 'PENDING' },
                { label: 'PAID', value: 'PAID' },
                { label: 'FAILED', value: 'FAILED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-full sm:w-36", inputCls)}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <CreditCard className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পেমেন্ট তালিকা' : 'Payments List'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <CreditCard className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পেমেন্ট পাওয়া যায়নি' : 'No payments found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'বাকি থাকলে পেমেন্ট জমা দিন' : 'Submit a payment if you have a due'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ইনভয়েস' : 'Invoice'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরিমাণ' : 'Amount'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পদ্ধতি' : 'Method'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(payment => (
                  <TableRow key={payment.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(payment.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                    <TableCell className="w-10">
                      <TableCheckbox checked={selection.isSelected(payment.id)} onChange={() => selection.toggle(payment.id)} />
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{payment.reference || payment.transactionId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {payment.submittedByStudent && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" title="Student submitted" />
                        )}
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {payment.studentName ? payment.studentName.charAt(0) : <Receipt className="h-3.5 w-3.5" />}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{payment.studentName || (isBn ? 'প্রতিষ্ঠান' : 'Institution')}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.paymentMethod}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(payment.paymentDate || payment.date)}</TableCell>
                    <TableCell><Badge status={payment.status} /></TableCell>
                    <TableCell>
                      <button onClick={() => setShowDetailModal(payment)} className={`p-1.5 rounded-md transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`} title={isBn ? 'বিস্তারিত দেখুন' : 'View Details'}>
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Submit Payment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isBn ? 'পেমেন্ট জমা দিন' : 'Submit Payment'} maxWidth="max-w-xl">
        <div className="grid grid-cols-2 gap-3.5">
          {/* Current due banner */}
          <div className={`col-span-2 rounded-lg border px-3.5 py-2.5 flex items-center justify-between ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-zinc-200 bg-zinc-50"}`}>
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${isDark ? "bg-white/[0.06]" : "bg-zinc-100"}`}>
                <Wallet className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div>
                <p className={`text-[11px] font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{isBn ? 'বর্তমান বাকি' : 'Current Due'}</p>
                <p className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                  {isBn ? 'ফি' : 'Fee'} ৳{feePerStudent.toLocaleString()} × {maxStudents} {isBn ? 'জন' : 'students'}
                </p>
              </div>
            </div>
            <span className={`text-base font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(dueAmount)}</span>
          </div>

          {/* Student count stepper */}
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শিক্ষার্থী সংখ্যা *' : 'Number of Students *'}</label>
            <div className={`flex items-center justify-between rounded-md border px-1.5 py-1.5 ${inputCls}`}>
              <button type="button" onClick={() => stepCount(-1)} className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${isDark ? "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"}`}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                inputMode="numeric"
                value={formData.studentCount}
                onChange={(e) => clampCount(e.target.value.replace(/\D/g, ''))}
                className={`w-16 bg-transparent text-center text-lg font-bold outline-none ${isDark ? "text-white" : "text-zinc-900"}`}
              />
              <button type="button" onClick={() => stepCount(1)} className={`h-7 w-7 rounded flex items-center justify-center transition-colors ${isDark ? "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"}`}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {isBn ? 'সর্বোচ্চ' : 'Up to'} {maxStudents} {isBn ? 'জন' : 'students'}
            </p>
          </div>

          {/* Auto-calculated amount */}
          <div className={`rounded-md border px-3.5 py-2.5 flex items-center justify-between ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-zinc-200 bg-zinc-50"}`}>
            <div>
              <p className={`text-[11px] font-medium ${labelCls}`}>{isBn ? 'মোট পরিমাণ' : 'Total Amount'}</p>
              <p className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{countNum} × ৳{feePerStudent.toLocaleString()}</p>
            </div>
            <span className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(amountPreview)}</span>
          </div>

          {/* Payment method segmented control */}
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পেমেন্ট পদ্ধতি *' : 'Payment Method *'}</label>
            <div className={`grid grid-cols-2 gap-1 p-1 rounded-md ${isDark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-zinc-100 border border-zinc-200"}`}>
              {([
                { value: "BKASH" as const, label: "bKash" },
                { value: "CASH" as const, label: isBn ? 'নগদ' : 'Cash' },
              ]).map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, paymentMethod: o.value, accountNumber: o.value === "CASH" ? "" : f.accountNumber }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-2 py-2 rounded text-[12px] font-medium transition-all",
                    formData.paymentMethod === o.value
                      ? (isDark ? "bg-white text-black" : "bg-zinc-900 text-white")
                      : isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]" : "text-zinc-500 hover:text-zinc-700 hover:bg-white"
                  )}
                >
                  {o.value === "BKASH" ? <Wallet className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice */}
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ইনভয়েস নম্বর *' : 'Invoice Number *'}</label>
            <Input placeholder={isBn ? 'ইনভয়েস নম্বর' : 'Invoice number'} value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} className={inputCls} />
          </div>

          {/* Payment date */}
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পেমেন্ট তারিখ *' : 'Payment Date *'}</label>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
                className={cn(inputCls, "w-full rounded-md pl-9 pr-3 py-2 text-sm outline-none")}
              />
            </div>
          </div>

          {/* bKash number (only for bKash) */}
          {formData.paymentMethod === "BKASH" && (
            <div>
              <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'bKash নম্বর *' : 'bKash Number *'}</label>
              <Input placeholder="01XXXXXXXXX" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} className={inputCls} />
            </div>
          )}

          {/* Notes */}
          <div className="col-span-2">
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নোট' : 'Notes'}</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={isBn ? 'TrxID বা অতিরিক্ত মন্তব্য...' : 'TrxID or any remark...'}
              className={cn(inputCls, "w-full rounded-md px-3 py-2 text-sm outline-none resize-none")}
            />
          </div>
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={createPaymentMutation.isPending || maxStudents < 1} className={cn(`px-5 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`, (createPaymentMutation.isPending || maxStudents < 1) && "opacity-50 cursor-not-allowed")}>
            {createPaymentMutation.isPending
              ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : (isBn ? 'জমা দিন' : 'Submit')}
          </button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetailModal} onClose={() => setShowDetailModal(null)} title={isBn ? 'পেমেন্ট বিস্তারিত' : 'Payment Details'} maxWidth="max-w-lg">
        {showDetailModal && (
          <div className="space-y-4">
            {[
              { label: isBn ? 'ইনভয়েস' : 'Invoice', value: showDetailModal.reference || showDetailModal.transactionId, badge: false },
              { label: isBn ? 'শিক্ষার্থী' : 'Student', value: showDetailModal.studentName || (isBn ? 'প্রতিষ্ঠান' : 'Institution'), badge: false },
              ...(showDetailModal.examName ? [{ label: isBn ? 'পরীক্ষা' : 'Exam', value: showDetailModal.examName, badge: false }] : []),
              { label: isBn ? 'পরিমাণ' : 'Amount', value: formatCurrency(showDetailModal.amount), badge: false },
              { label: isBn ? 'পদ্ধতি' : 'Method', value: showDetailModal.paymentMethod, badge: false },
              { label: isBn ? 'অ্যাকাউন্ট নম্বর' : 'Account Number', value: showDetailModal.accountNumber || '-', badge: false },
              { label: isBn ? 'তারিখ' : 'Date', value: formatDate(showDetailModal.paymentDate || showDetailModal.date), badge: false },
              { label: isBn ? 'স্ট্যাটাস' : 'Status', value: showDetailModal.status, badge: true },
              ...(showDetailModal.rejectionReason ? [{ label: isBn ? 'প্রত্যাখ্যানের কারণ' : 'Rejection Reason', value: showDetailModal.rejectionReason, badge: false }] : []),
              { label: isBn ? 'নোট' : 'Notes', value: showDetailModal.notes || '-', badge: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-dashed" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{item.label}</span>
                {item.badge ? <Badge status={item.value as any} /> : <span className={`text-[13px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{item.value}</span>}
              </div>
            ))}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => setShowDetailModal(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বন্ধ' : 'Close'}</button>
        </ModalFooter>
      </Modal>

      {/* Floating PDF Download Button */}
      {filtered.length > 0 && (
        <button
          onClick={() => setShowPdfModal(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${isDark ? "bg-[#9333ea] text-white hover:bg-[#7e22ce] shadow-[#9333ea]/20" : "bg-[#9333ea] text-white hover:bg-[#7e22ce] shadow-[#9333ea]/30"}`}
        >
          <FileDown className="h-4 w-4" />
          <span className="text-[13px] font-medium">{isBn ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}</span>
        </button>
      )}

      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={isBn ? 'পেমেন্ট তালিকা' : 'Payment List'}
        columns={pdfColumns}
        data={pdfData}
      />
    </div>
  );
}

function PaymentsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-md ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-300'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-300/80'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (<div key={i} className={`${card} rounded-md h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-md h-12 mb-8`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
