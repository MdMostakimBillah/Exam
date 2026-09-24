"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { useRegistrations, useUpdateRegistration, useDeleteRegistration } from "@/lib/storage/registrations";
import { useToast } from "@/components/ui/toast";
import { LoadingBar } from "@/components/ui/loading-bar";
import { ClipboardList, Search, Download, FileDown, Edit, Trash2, CheckCircle } from "lucide-react";
import { TableActionMenu, TableActionItem } from "@/components/ui/table-action-menu";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { Registration } from "@/lib/types";
import { cn } from "@/lib/utils/helpers";

export default function RegistrationsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [instFilter, setInstFilter] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [editForm, setEditForm] = useState({ status: "" });
  const [deletingReg, setDeletingReg] = useState<Registration | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const { toast } = useToast();
  const { data: registrations = [], isFetching } = useRegistrations();
  const updateRegistrationMutation = useUpdateRegistration();
  const deleteRegistrationMutation = useDeleteRegistration();

  const filtered = useMemo(() => registrations.filter(r => {
    const q = search.toLowerCase();
    const matchesSearch = r.studentName.toLowerCase().includes(q) || r.registrationNumber.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesInstitution = !instFilter || r.institutionId === instFilter;
    return matchesSearch && matchesStatus && matchesInstitution;
  }), [registrations, search, statusFilter, instFilter]);

  // Unique institutions present in the current registrations
  const institutionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    registrations.forEach(r => { if (r.institutionId && !seen.has(r.institutionId)) seen.set(r.institutionId, r.institutionName); });
    return [
      { label: isBn ? 'সব প্রতিষ্ঠান' : 'All Institutions', value: '' },
      ...Array.from(seen.entries())
        .map(([value, label]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [registrations, isBn]);

  const selection = useTableSelection(filtered);

  const pdfColumns = useMemo<PdfColumn[]>(() => [
    { header: isBn ? "রেজিস্ট্রেশন নম্বর" : "Registration Number", key: "registrationNumber" },
    { header: isBn ? "শিক্ষার্থী" : "Student", key: "studentName" },
    { header: isBn ? "প্রতিষ্ঠান" : "Institution", key: "institutionName" },
    { header: isBn ? "পরীক্ষা" : "Exam", key: "examName" },
    { header: isBn ? "তারিখ" : "Date", key: "date" },
    { header: isBn ? "স্ট্যাটাস" : "Status", key: "status" },
  ], [isBn]);

  const pdfData = useMemo(() => filtered.map(r => ({
    registrationNumber: r.registrationNumber,
    studentName: r.studentName,
    institutionName: r.institutionName,
    examName: r.examName,
    date: formatDate(r.createdAt),
    status: r.status,
  })), [filtered]);

  const statusCounts = useMemo(() => ({
    all: registrations.length,
    APPROVED: registrations.filter(r => r.status === 'APPROVED').length,
    VERIFIED: registrations.filter(r => r.status === 'VERIFIED').length,
    PENDING: registrations.filter(r => r.status === 'PENDING').length,
  }), [registrations]);

  if (!mounted) return <RegistrationsSkeleton isDark={isDark} />;

  const handleEdit = (reg: Registration) => {
    setEditingReg(reg);
    setEditForm({ status: reg.status });
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingReg) return;
    const newStatus = editForm.status;
    const isApprove = newStatus === 'APPROVED';
    await updateRegistrationMutation.mutateAsync({
      id: editingReg.id,
      data: {
        status: newStatus as any,
        paymentStatus: isApprove ? 'PAID' : 'PENDING',
      },
    });
    toast("success", isBn ? "নিবন্ধন আপডেট হয়েছে" : "Registration updated");
    setEditingReg(null);
    setRefreshKey(k => k + 1);
  };

  const handleApprove = async () => {
    if (!editingReg) return;
    await updateRegistrationMutation.mutateAsync({
      id: editingReg.id,
      data: {
        status: 'APPROVED',
        paymentStatus: 'PAID',
      },
    });
    toast("success", isBn ? "নিবন্ধন অনুমোদিত ও পরিশোধিত হয়েছে" : "Registration approved and marked as paid");
    setEditingReg(null);
    setRefreshKey(k => k + 1);
  };

  const handleBulkApprove = async () => {
    const selectedIds = filtered.filter(r => selection.isSelected(r.id)).map(r => r.id);
    if (selectedIds.length === 0) return;
    let count = 0;
    for (const id of selectedIds) {
      try {
        await updateRegistrationMutation.mutateAsync({
          id,
          data: { status: 'APPROVED', paymentStatus: 'PAID' },
        });
        count++;
      } catch { /* skip failed */ }
    }
    toast("success", isBn ? `${count} টি নিবন্ধন অনুমোদিত ও পরিশোধিত হয়েছে` : `${count} registration(s) approved and marked as paid`);
    selection.toggleAll();
    setRefreshKey(k => k + 1);
  };

  const handleDelete = async () => {
    if (!deletingReg) return;
    await deleteRegistrationMutation.mutateAsync(deletingReg.id);
    toast("success", isBn ? "নিবন্ধন মুছে ফেলা হয়েছে" : "Registration deleted");
    setDeletingReg(null);
    setRefreshKey(k => k + 1);
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'নিবন্ধন' : 'Registrations'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'শিক্ষার্থী নিবন্ধন পরিচালনা করুন' : 'Manage student registrations'}
          </p>
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট' : 'Total', value: statusCounts.all },
            { label: isBn ? 'অনুমোদিত' : 'Approved', value: statusCounts.APPROVED },
            { label: isBn ? 'যাচাইকৃত' : 'Verified', value: statusCounts.VERIFIED },
            { label: isBn ? 'বিচারাধীন' : 'Pending', value: statusCounts.PENDING },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <ClipboardList className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              <Input
                placeholder={isBn ? "শিক্ষার্থী বা রেজিস্ট্রেশন নম্বর দিয়ে অনুসন্ধান..." : "Search by student or registration number..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'অনুমোদিত' : 'Approved', value: 'APPROVED' },
                { label: isBn ? 'যাচাইকৃত' : 'Verified', value: 'VERIFIED' },
                { label: isBn ? 'বিচারাধীন' : 'Pending', value: 'PENDING' },
                { label: isBn ? 'বাতিল' : 'Rejected', value: 'REJECTED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-40 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
            <Select
              options={institutionOptions}
              value={instFilter}
              onChange={(e) => setInstFilter(e.target.value)}
              className={`w-full sm:w-48 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
            <button className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
              <Download className="h-3.5 w-3.5" /> {isBn ? 'এক্সপোর্ট' : 'Export'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? 'নিবন্ধন তালিকা' : 'Registrations List'}
                </h3>
                <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
              </div>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <ClipboardList className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো নিবন্ধন পাওয়া যায়নি' : 'No registrations found'}</p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{isBn ? 'অনুসন্ধান বা ফিল্টার পরিবর্তন করুন' : 'Try adjusting your search or filters'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className="w-10">
                    <TableCheckbox
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      onChange={selection.toggleAll}
                    />
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'রেজিস্ট্রেশন নম্বর' : 'Registration Number'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'তারিখ' : 'Date'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 20).map(reg => (
                  <TableRow key={reg.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <TableCheckbox
                        checked={selection.isSelected(reg.id)}
                        onChange={() => selection.toggle(reg.id)}
                      />
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{reg.registrationNumber}</TableCell>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{reg.studentName}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{reg.institutionName}</TableCell>
                    <TableCell className={`text-[11px] hidden lg:table-cell ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{reg.examName}</TableCell>
                    <TableCell className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{formatDate(reg.createdAt)}</TableCell>
                    <TableCell><Badge status={reg.status} /></TableCell>
                    <TableCell>
                      <TableActionMenu id={reg.id} openId={menuOpenId} onToggle={setMenuOpenId} isDark={isDark}>
                        <TableActionItem onClick={() => handleEdit(reg)} isDark={isDark}>
                          <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                        </TableActionItem>
                        <TableActionItem onClick={() => { setDeletingReg(reg); setMenuOpenId(null); }} isDark={isDark} variant="danger">
                          <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                        </TableActionItem>
                      </TableActionMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Edit Registration Modal */}
      {editingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setEditingReg(null)} />
          <div className={`relative z-50 w-full max-w-xl rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl ${isDark ? 'border border-white/[0.06] bg-[#0D0D0D]' : 'border border-zinc-200 bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'নিবন্ধন সম্পাদনা' : 'Edit Registration'}</h3>
              <button onClick={() => setEditingReg(null)} className={`p-1 rounded ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>×</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</label>
                  <Input value={editingReg.studentName} disabled className={cn("opacity-60", inputCls)} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'রেজিস্ট্রেশন নম্বর' : 'Registration Number'}</label>
                  <Input value={editingReg.registrationNumber} disabled className={cn("opacity-60", inputCls)} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</label>
                  <Input value={editingReg.examName} disabled className={cn("opacity-60", inputCls)} />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</label>
                  <Input value={editingReg.institutionName} disabled className={cn("opacity-60", inputCls)} />
                </div>
              </div>
              <div>
                <label className={`block text-[11px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'স্থিতি *' : 'Status *'}</label>
                <Select
                  options={[
                    { label: 'PENDING', value: 'PENDING' },
                    { label: 'APPROVED', value: 'APPROVED' },
                    { label: 'REJECTED', value: 'REJECTED' },
                  ]}
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className={inputCls}
                />
              </div>
              {editForm.status === 'APPROVED' && (
                <div className={`rounded-md p-3 text-[11px] ${isDark ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-green-50 text-green-700 border border-green-200"}`}>
                  {isBn ? 'অনুমোদিত হলে পেমেন্ট স্বয়ংক্রিয়ভাবে PAID হবে' : 'Approving will automatically mark payment as PAID'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setEditingReg(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              {editingReg.status !== 'APPROVED' && (
                <button onClick={handleApprove} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-green-600 text-white hover:bg-green-700">
                  {isBn ? 'অনুমোদন ও পরিশোধ' : 'Approve & Mark Paid'}
                </button>
              )}
              <button onClick={handleSaveEdit} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${"bg-brand-accent text-brand-accent-fg hover:opacity-90"}`}>
                {isBn ? 'সংরক্ষণ' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setDeletingReg(null)} />
          <div className={`relative z-50 w-full max-w-md rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl ${isDark ? 'border border-white/[0.06] bg-[#0D0D0D]' : 'border border-zinc-200 bg-white'}`}>
            <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'নিবন্ধন মুছুন?' : 'Delete Registration?'}</h3>
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {isBn ? `"${deletingReg.studentName}" -এর "${deletingReg.examName}" নিবন্ধন মুছে ফেলা হবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।` : `Registration for "${deletingReg.studentName}" in "${deletingReg.examName}" will be deleted. This action cannot be undone.`}
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setDeletingReg(null)} className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${isDark ? "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-md text-[13px] font-medium transition-all bg-red-600 text-white hover:bg-red-700">
                {isBn ? 'মুছুন' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar */}
      {selection.selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
            </span>
            <button onClick={handleBulkApprove} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors">
              <CheckCircle className="h-3.5 w-3.5" /> {isBn ? 'অনুমোদন ও পরিশোধ' : 'Approve & Mark Paid'}
            </button>
            <button onClick={() => setShowPdfModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-colors">
              <FileDown className="h-3.5 w-3.5" /> {isBn ? 'পিডিএফ' : 'PDF'}
            </button>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        title={isBn ? "নিবন্ধন তালিকা" : "Registrations List"}
        columns={pdfColumns}
        data={selection.selectedCount > 0
          ? pdfData.filter((_, i) => selection.isSelected(filtered[i].id))
          : pdfData
        }
        companyName="Bangladesh Madrasah Association"
        companySubtitle="বাংলাদেশ মাদ্রাসা এসোসিয়েশন"
      />
    </div>
  );
}

function RegistrationsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-12 mb-6`} />
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
