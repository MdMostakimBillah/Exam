"use client";
import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PdfExportModal, type PdfColumn } from "@/components/ui/pdf-export-modal";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useExamCenters, useCreateExamCenter, useUpdateExamCenter } from "@/lib/storage/exam-centers";
import { useCurrentSession } from "@/lib/storage/sessions";
import { School, Plus, Pencil, FileDown } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ExamCentersPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', capacity: '' });
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: currentSession } = useCurrentSession();
  const { data: centers = [] } = useExamCenters();
  const createExamCenterMutation = useCreateExamCenter();
  const updateExamCenterMutation = useUpdateExamCenter();
  const totalCapacity = useMemo(() => centers.reduce((s, c) => s + c.capacity, 0), [centers]);
  const totalAllocated = useMemo(() => centers.reduce((s, c) => s + c.allocated, 0), [centers]);

  const selection = useTableSelection(centers);

  const pdfColumns = useMemo<PdfColumn[]>(() => [
    { header: isBn ? 'কেন্দ্রের নাম' : 'Center Name', key: 'name' },
    { header: isBn ? 'ঠিকানা' : 'Address', key: 'address' },
    { header: isBn ? 'ধারণক্ষমতা' : 'Capacity', key: 'capacity' },
    { header: isBn ? 'বরাদ্দ' : 'Allocated', key: 'allocated' },
    { header: isBn ? 'অবশিষ্ট' : 'Available', key: 'available' },
  ], [isBn]);

  const pdfData = useMemo(() => centers
    .filter((c) => selection.isSelected(c.id))
    .map((c) => ({
      name: c.name,
      address: c.address,
      capacity: c.capacity,
      allocated: c.allocated,
      available: c.capacity - c.allocated,
    })), [centers, selection]);

  if (!mounted) return <ExamCentersSkeleton isDark={isDark} />;

  const handleSave = async () => {
    if (!form.name || !form.capacity) return;
    const data = { 
      sessionId: currentSession?.id || '',
      name: form.name, 
      address: form.address, 
      capacity: parseInt(form.capacity), 
      allocated: 0 
    };
    if (editId) { await updateExamCenterMutation.mutateAsync({ id: editId, data }); toast('success', isBn ? 'কেন্দ্র আপডেট হয়েছে' : 'Center updated'); }
    else { await createExamCenterMutation.mutateAsync(data); toast('success', isBn ? 'কেন্দ্র তৈরি হয়েছে' : 'Center created'); }
    setModalOpen(false); setEditId(null); setForm({ name: '', address: '', capacity: '' });
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'পরীক্ষা কেন্দ্র' : 'Exam Centers'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'পরীক্ষা কেন্দ্র পরিচালনা করুন' : 'Manage examination centers'}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট কেন্দ্র' : 'Total Centers', value: centers.length },
            { label: isBn ? 'মোট আসন' : 'Total Seats', value: totalCapacity },
            { label: isBn ? 'বরাদ্দ' : 'Allocated', value: totalAllocated },
            { label: isBn ? 'অবশিষ্ট' : 'Available', value: totalCapacity - totalAllocated },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
                <School className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => { setForm({ name: '', address: '', capacity: '' }); setEditId(null); setModalOpen(true); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${"bg-brand-accent text-brand-accent-fg hover:opacity-90"}`}
          >
            <Plus className="h-3.5 w-3.5" /> {isBn ? 'কেন্দ্র যোগ করুন' : 'Add Center'}
          </button>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <School className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'পরীক্ষা কেন্দ্র' : 'Exam Centers'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({centers.length})</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                <TableHead className="w-10">
                  <TableCheckbox checked={selection.allSelected} indeterminate={selection.someSelected} onChange={selection.toggleAll} />
                </TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কেন্দ্রের নাম' : 'Center Name'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ঠিকানা' : 'Address'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ধারণক্ষমতা' : 'Capacity'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বরাদ্দ' : 'Allocated'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'অবশিষ্ট' : 'Available'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'ব্যবহার' : 'Occupancy'}</TableHead>
                <TableHead className={`w-[40px]`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map(c => (
                <TableRow key={c.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'} ${selection.isSelected(c.id) ? (isDark ? 'bg-[#9333ea]/10' : 'bg-purple-50') : ''}`}>
                  <TableCell className="w-10">
                    <TableCheckbox checked={selection.isSelected(c.id)} onChange={() => selection.toggle(c.id)} />
                  </TableCell>
                  <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{c.name}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{c.address}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.capacity}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.allocated}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{c.capacity - c.allocated}</TableCell>
                  <TableCell>
                    <div className="w-20">
                      <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'} overflow-hidden`}>
                        <div className={`h-full rounded-full ${isDark ? 'bg-white/30' : 'bg-zinc-600'}`} style={{ width: `${(c.allocated / c.capacity) * 100}%` }} />
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>{Math.round((c.allocated / c.capacity) * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => { setEditId(c.id); setForm({ name: c.name, address: c.address, capacity: String(c.capacity) }); setModalOpen(true); }}
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Floating PDF Button */}
        {selection.selectedCount > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slideUp">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-md shadow-2xl ${isDark ? 'bg-[#1a1a1c] border border-white/[0.1]' : 'bg-white border border-zinc-200'}`}>
              <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {selection.selectedCount} {isBn ? 'টি নির্বাচিত' : 'selected'}
              </span>
              <button
                onClick={() => setShowPdfModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-[#9333ea] text-white hover:bg-[#7e22ce] transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}

        {/* PDF Export Modal */}
        <PdfExportModal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          title={isBn ? 'পরীক্ষা কেন্দ্র তালিকা' : 'Exam Centers List'}
          columns={pdfColumns}
          data={pdfData}
        />

        {/* Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? (isBn ? 'কেন্দ্র সম্পাদনা' : 'Edit Center') : (isBn ? 'কেন্দ্র যোগ করুন' : 'Add Center')}>
          <div className="space-y-3">
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'কেন্দ্রের নাম' : 'Center Name'}</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isBn ? 'কেন্দ্রের নাম লিখুন' : 'Enter center name'} /></div>
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={isBn ? 'ঠিকানা লিখুন' : 'Enter address'} /></div>
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ধারণক্ষমতা' : 'Capacity'}</label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder={isBn ? 'সর্বোচ্চ আসন' : 'Maximum seats'} /></div>
          </div>
          <ModalFooter>
            <button onClick={() => setModalOpen(false)} className={`px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? 'bg-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900'}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${'bg-brand-accent text-brand-accent-fg hover:opacity-90'}`}>{editId ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি' : 'Create')}</button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
}

function ExamCentersSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-md h-64`} />
      </div>
    </div>
  );
}
