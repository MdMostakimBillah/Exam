"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getExamCenters, createExamCenter, updateExamCenter } from "@/lib/storage/exam-centers";
import { School, Plus, Pencil } from "lucide-react";
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

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ExamCentersSkeleton isDark={isDark} />;

  const centers = getExamCenters();
  const totalCapacity = centers.reduce((s, c) => s + c.capacity, 0);
  const totalAllocated = centers.reduce((s, c) => s + c.allocated, 0);

  const handleSave = () => {
    if (!form.name || !form.capacity) return;
    const data = { name: form.name, address: form.address, capacity: parseInt(form.capacity), allocated: 0 };
    if (editId) { updateExamCenter(editId, data); toast('success', isBn ? 'কেন্দ্র আপডেট হয়েছে' : 'Center updated'); }
    else { createExamCenter(data); toast('success', isBn ? 'কেন্দ্র তৈরি হয়েছে' : 'Center created'); }
    setModalOpen(false); setEditId(null); setForm({ name: '', address: '', capacity: '' });
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.06]" : "bg-zinc-100";
  const iconColor = isDark ? "text-white" : "text-zinc-900";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট কেন্দ্র' : 'Total Centers', value: centers.length },
            { label: isBn ? 'মোট আসন' : 'Total Seats', value: totalCapacity },
            { label: isBn ? 'বরাদ্দ' : 'Allocated', value: totalAllocated },
            { label: isBn ? 'অবশিষ্ট' : 'Available', value: totalCapacity - totalAllocated },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <School className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => { setForm({ name: '', address: '', capacity: '' }); setEditId(null); setModalOpen(true); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
          >
            <Plus className="h-3.5 w-3.5" /> {isBn ? 'কেন্দ্র যোগ করুন' : 'Add Center'}
          </button>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <School className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'পরীক্ষা কেন্দ্র' : 'Exam Centers'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({centers.length})</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কেন্দ্রের নাম' : 'Center Name'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ঠিকানা' : 'Address'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ধারণক্ষমতা' : 'Capacity'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'বরাদ্দ' : 'Allocated'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'অবশিষ্ট' : 'Available'}</TableHead>
                <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ব্যবহার' : 'Occupancy'}</TableHead>
                <TableHead className={`w-[40px]`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map(c => (
                <TableRow key={c.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                  <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{c.name}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{c.address}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{c.capacity}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{c.allocated}</TableCell>
                  <TableCell className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{c.capacity - c.allocated}</TableCell>
                  <TableCell>
                    <div className="w-20">
                      <div className={`h-1.5 rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'} overflow-hidden`}>
                        <div className={`h-full rounded-full ${isDark ? 'bg-white/30' : 'bg-zinc-600'}`} style={{ width: `${(c.allocated / c.capacity) * 100}%` }} />
                      </div>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>{Math.round((c.allocated / c.capacity) * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => { setEditId(c.id); setForm({ name: c.name, address: c.address, capacity: String(c.capacity) }); setModalOpen(true); }}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? (isBn ? 'কেন্দ্র সম্পাদনা' : 'Edit Center') : (isBn ? 'কেন্দ্র যোগ করুন' : 'Add Center')}>
          <div className="space-y-3">
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'কেন্দ্রের নাম' : 'Center Name'}</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isBn ? 'কেন্দ্রের নাম লিখুন' : 'Enter center name'} /></div>
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={isBn ? 'ঠিকানা লিখুন' : 'Enter address'} /></div>
            <div><label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ধারণক্ষমতা' : 'Capacity'}</label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder={isBn ? 'সর্বোচ্চ আসন' : 'Maximum seats'} /></div>
          </div>
          <ModalFooter>
            <button onClick={() => setModalOpen(false)} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? 'bg-white/[0.06] text-zinc-400 hover:text-white' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>{editId ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি' : 'Create')}</button>
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
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
