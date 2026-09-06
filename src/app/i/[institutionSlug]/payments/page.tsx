"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { getPaymentsByInstitution, createPayment, updatePayment } from "@/lib/storage/payments";
import { getRegistrationsByInstitution } from "@/lib/storage/registrations";
import { Payment } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/storage/storage";
import { CreditCard, Search, Plus, Eye, CheckCircle, XCircle, Wallet } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

const emptyForm = {
  registrationId: "",
  amount: "",
  paymentMethod: "CASH" as "CASH" | "BANK" | "MOBILE",
  paymentDate: new Date().toISOString().split("T")[0],
  reference: "",
  notes: "",
};

export default function InstitutionPaymentsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Payment | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <PaymentsSkeleton isDark={isDark} />;

  const inst = getInstitutionBySlug(slug);
  if (!inst) return null;

  const payments = getPaymentsByInstitution(inst.id);
  const registrations = getRegistrationsByInstitution(inst.id);

  const filtered = payments.filter(p => {
    const matchesSearch = !search ||
      (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
      (p.studentName && p.studentName.toLowerCase().includes(search.toLowerCase())) ||
      (p.transactionId && p.transactionId.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const confirmedAmount = payments.filter(p => p.status === 'CONFIRMED' || p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  const failedAmount = payments.filter(p => p.status === 'FAILED').reduce((sum, p) => sum + p.amount, 0);

  const handleCreate = () => {
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.registrationId || !formData.amount || !formData.paymentMethod) {
      toast("error", isBn ? "প্রয়োজনীয় ঘর পূরণ করুন" : "Please fill required fields");
      return;
    }
    const reg = registrations.find(r => r.id === formData.registrationId);
    if (!reg) {
      toast("error", isBn ? "নিবন্ধন পাওয়া যায়নি" : "Registration not found");
      return;
    }
    createPayment({
      transactionId: `TXN-${Date.now()}`,
      institutionId: inst.id,
      institutionName: inst.name,
      examId: reg.examId,
      examName: reg.examName,
      studentCount: 1,
      amount: Number(formData.amount),
      paymentMethod: formData.paymentMethod,
      status: 'PENDING',
      date: formData.paymentDate,
      registrationId: reg.id,
      studentId: reg.studentId,
      studentName: reg.studentName,
      reference: formData.reference,
      paymentDate: formData.paymentDate,
      notes: formData.notes,
    });
    toast("success", isBn ? "পেমেন্ট রেকর্ড হয়েছে" : "Payment recorded");
    setShowModal(false);
    setRefreshKey(k => k + 1);
  };

  const handleMarkConfirmed = (p: Payment) => {
    updatePayment(p.id, { status: 'CONFIRMED' });
    toast("success", isBn ? "পেমেন্ট নিশ্চিত হয়েছে" : "Payment confirmed");
    setRefreshKey(k => k + 1);
  };

  const handleMarkFailed = (p: Payment) => {
    updatePayment(p.id, { status: 'FAILED' });
    toast("success", isBn ? "পেমেন্ট ব্যর্থ হিসেবে চিহ্নিত" : "Payment marked as failed");
    setRefreshKey(k => k + 1);
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'পেমেন্ট' : 'Payments'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'শিক্ষার্থী নিবন্ধনের পেমেন্ট স্ট্যাটাস ট্র্যাক করুন' : 'Track payment status for student registrations'}
            </p>
          </div>
          <button onClick={handleCreate} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all", isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800")}>
            <Plus className="h-4 w-4" /> {isBn ? 'পেমেন্ট রেকর্ড করুন' : 'Record Payment'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: CreditCard, label: isBn ? 'মোট পরিমাণ' : 'Total Amount', value: formatCurrency(totalAmount) },
            { icon: CheckCircle, label: isBn ? 'নিশ্চিত' : 'Confirmed', value: formatCurrency(confirmedAmount) },
            { icon: Wallet, label: isBn ? 'পেন্ডিং' : 'Pending', value: formatCurrency(pendingAmount) },
            { icon: XCircle, label: isBn ? 'ব্যর্থ' : 'Failed', value: formatCurrency(failedAmount) },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-8`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input placeholder={isBn ? "রেফারেন্স বা শিক্ষার্থীর নাম দিয়ে অনুসন্ধান..." : "Search by reference or student name..."} value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-10", inputCls)} />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'পেন্ডিং' : 'Pending', value: 'PENDING' },
                { label: isBn ? 'নিশ্চিত' : 'Confirmed', value: 'CONFIRMED' },
                { label: isBn ? 'ব্যর্থ' : 'Failed', value: 'FAILED' },
                { label: isBn ? 'ফেরত' : 'Refunded', value: 'REFUNDED' },
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
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <CreditCard className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো পেমেন্ট পাওয়া যায়নি' : 'No payments found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{isBn ? 'নতুন পেমেন্ট রেকর্ড করুন' : 'Record a new payment to get started'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রেফারেন্স' : 'Reference'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরিমাণ' : 'Amount'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পদ্ধতি' : 'Method'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(payment => (
                  <TableRow key={payment.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{payment.reference || payment.transactionId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {payment.studentName ? payment.studentName.charAt(0) : '?'}
                        </div>
                        <span className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{payment.studentName || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.examName}</TableCell>
                    <TableCell className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{payment.paymentMethod}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(payment.paymentDate || payment.date)}</TableCell>
                    <TableCell><Badge status={payment.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {payment.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleMarkConfirmed(payment)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-green-400 hover:text-green-300 hover:bg-green-500/10" : "text-green-600 hover:text-green-700 hover:bg-green-50"}`} title={isBn ? 'নিশ্চিত করুন' : 'Mark Confirmed'}>
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleMarkFailed(payment)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-red-600 hover:text-red-700 hover:bg-red-50"}`} title={isBn ? 'ব্যর্থ চিহ্নিত করুন' : 'Mark Failed'}>
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => setShowDetailModal(payment)} className={`p-1.5 rounded-lg transition-all ${isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`} title={isBn ? 'বিস্তারিত দেখুন' : 'View Details'}>
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={isBn ? 'পেমেন্ট রেকর্ড করুন' : 'Record Payment'} maxWidth="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নিবন্ধন *' : 'Registration *'}</label>
            <Select
              options={registrations.map(r => ({ label: `${r.studentName} - ${r.examName}`, value: r.id }))}
              value={formData.registrationId}
              onChange={(e) => setFormData({ ...formData, registrationId: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পরিমাণ *' : 'Amount *'}</label>
            <Input type="number" placeholder={isBn ? 'পরিমাণ' : 'Amount'} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পেমেন্ট পদ্ধতি *' : 'Payment Method *'}</label>
            <Select
              options={[
                { label: isBn ? 'নগদ' : 'CASH', value: 'CASH' },
                { label: isBn ? 'ব্যাংক' : 'BANK', value: 'BANK' },
                { label: isBn ? 'মোবাইল' : 'MOBILE', value: 'MOBILE' },
              ]}
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as "CASH" | "BANK" | "MOBILE" })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পেমেন্ট তারিখ' : 'Payment Date'}</label>
            <Input type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'রেফারেন্স' : 'Reference'}</label>
            <Input placeholder={isBn ? 'রেফারেন্স নম্বর' : 'Reference number'} value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নোট' : 'Notes'}</label>
            <Input placeholder={isBn ? 'অতিরিক্ত নোট' : 'Additional notes'} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputCls} />
          </div>
        </div>
        <ModalFooter>
          <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
          <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
            {isBn ? 'রেকর্ড করুন' : 'Record'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetailModal} onClose={() => setShowDetailModal(null)} title={isBn ? 'পেমেন্ট বিস্তারিত' : 'Payment Details'} maxWidth="max-w-lg">
        {showDetailModal && (
          <div className="space-y-4">
            {[
              { label: isBn ? 'রেফারেন্স' : 'Reference', value: showDetailModal.reference || showDetailModal.transactionId },
              { label: isBn ? 'শিক্ষার্থী' : 'Student', value: showDetailModal.studentName || '-' },
              { label: isBn ? 'পরীক্ষা' : 'Exam', value: showDetailModal.examName },
              { label: isBn ? 'পরিমাণ' : 'Amount', value: formatCurrency(showDetailModal.amount) },
              { label: isBn ? 'পদ্ধতি' : 'Method', value: showDetailModal.paymentMethod },
              { label: isBn ? 'তারিখ' : 'Date', value: formatDate(showDetailModal.paymentDate || showDetailModal.date) },
              { label: isBn ? 'স্ট্যাটাস' : 'Status', value: showDetailModal.status },
              { label: isBn ? 'নোট' : 'Notes', value: showDetailModal.notes || '-' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-dashed" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{item.label}</span>
                {item.label === (isBn ? 'স্ট্যাটাস' : 'Status') ? <Badge status={item.value} /> : <span className={`text-[13px] font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{item.value}</span>}
              </div>
            ))}
          </div>
        )}
        <ModalFooter>
          <button onClick={() => setShowDetailModal(null)} className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{isBn ? 'বন্ধ' : 'Close'}</button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function PaymentsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (<div key={i} className={`${card} rounded-2xl h-[52px]`} />))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-8`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
