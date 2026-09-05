"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getClasses, createClass, updateClass, deleteClass } from "@/lib/storage/classes";
import { Class } from "@/lib/types";
import { BookMarked, Plus, Search, MoreVertical, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ClassesPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <ClassesSkeleton isDark={isDark} />;

  const classes = getClasses();
  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    setEditingClass(null);
    setFormData({ name: "", code: "", description: "" });
    setShowModal(true);
  };

  const handleEdit = (cls: Class) => {
    setEditingClass(cls);
    setFormData({ name: cls.name, code: cls.code, description: cls.description });
    setShowModal(true);
    setMenuOpenId(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code) {
      toast('error', isBn ? 'নাম এবং কোড আবশ্যক' : 'Name and code are required');
      return;
    }
    if (editingClass) {
      updateClass(editingClass.id, formData);
      toast('success', isBn ? 'শ্রেণী আপডেট হয়েছে' : 'Class updated');
    } else {
      createClass({ ...formData, isActive: true });
      toast('success', isBn ? 'শ্রেণী তৈরি হয়েছে' : 'Class created');
    }
    setShowModal(false);
  };

  const handleToggleActive = (cls: Class) => {
    updateClass(cls.id, { isActive: !cls.isActive });
    toast('success', isBn ? (cls.isActive ? 'শ্রেণী নিষ্ক্রিয় হয়েছে' : 'শ্রেণী সক্রিয় হয়েছে') : (cls.isActive ? 'Class deactivated' : 'Class activated'));
    setMenuOpenId(null);
  };

  const handleDelete = (cls: Class) => {
    if (confirm(isBn ? `"${cls.name}" মুছে ফেলতে চান?` : `Delete "${cls.name}"?`)) {
      deleteClass(cls.id);
      toast('success', isBn ? 'শ্রেণী মুছে ফেলা হয়েছে' : 'Class deleted');
    }
    setMenuOpenId(null);
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট শ্রেণী' : 'Total Classes', value: classes.length },
            { label: isBn ? 'সক্রিয়' : 'Active', value: classes.filter(c => c.isActive).length },
            { label: isBn ? 'নিষ্ক্রিয়' : 'Inactive', value: classes.filter(c => !c.isActive).length },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <BookMarked className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
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
                placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <button onClick={handleCreate} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
              <Plus className="h-3.5 w-3.5" /> {isBn ? 'নতুন শ্রেণী' : 'Add Class'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <BookMarked className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'শ্রেণী তালিকা' : 'Classes'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                <BookMarked className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো শ্রেণী পাওয়া যায়নি' : 'No classes found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'বিবরণ' : 'Description'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'কার্য' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(cls => (
                  <TableRow key={cls.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                          {cls.name.charAt(0)}
                        </div>
                        <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{cls.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{cls.code}</TableCell>
                    <TableCell className={`text-[11px] hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{cls.description}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cls.isActive ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-zinc-500' : 'text-zinc-400')}`}>
                        {cls.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {cls.isActive ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Inactive')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === cls.id ? null : cls.id)}
                          className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.06] text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'}`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === cls.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                            <div className={`absolute right-0 top-8 z-50 w-40 rounded-xl border py-1 shadow-lg ${isDark ? 'bg-[#1a1a1c] border-white/[0.08]' : 'bg-white border-zinc-200'}`}>
                              <button onClick={() => handleEdit(cls)} className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${isDark ? 'text-zinc-400 hover:bg-white/[0.05] hover:text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
                                <Edit className="h-3.5 w-3.5" /> {isBn ? 'সম্পাদনা' : 'Edit'}
                              </button>
                              <button onClick={() => handleToggleActive(cls)} className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${isDark ? 'text-zinc-400 hover:bg-white/[0.05] hover:text-white' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
                                {cls.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                {cls.isActive ? (isBn ? 'নিষ্ক্রিয়' : 'Deactivate') : (isBn ? 'সক্রিয়' : 'Activate')}
                              </button>
                              <button onClick={() => handleDelete(cls)} className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}>
                                <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className={`${isDark ? 'bg-[#141416] border border-white/[0.06]' : 'bg-white border-zinc-200'} rounded-2xl p-6 w-full max-w-md`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            {editingClass ? (isBn ? 'শ্রেণী সম্পাদনা' : 'Edit Class') : (isBn ? 'নতুন শ্রেণী' : 'New Class')}
          </h3>
          <div className="space-y-3">
            <div>
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={isBn ? 'যেমন: শ্রেণী ৫' : 'e.g., Class 5'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</label>
              <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder={isBn ? 'যেমন: CLS-05' : 'e.g., CLS-05'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>
            <div>
              <label className={`block text-[11px] mb-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'বিবরণ' : 'Description'}</label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={isBn ? 'ঐচ্ছিক বিবরণ' : 'Optional description'}
                className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"}`}>
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
              {editingClass ? (isBn ? 'আপডেট' : 'Update') : (isBn ? 'তৈরি' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClassesSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
