"use client";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstitutions, createInstitution, updateInstitution, deleteInstitution } from "@/lib/storage/institutions";
import { Institution } from "@/lib/types";
import { Building2, Search, Users, Mail, Phone, MoreVertical, Trash2, Eye, Check, X, Ban, Plus } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import Link from "next/link";

export default function InstitutionsPage() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", slug: "", email: "", phone: "", address: "", city: "", district: "", contactPerson: "", contactPersonPhone: "", status: "PENDING" as Institution["status"],
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) return <InstitutionsSkeleton isDark={isDark} />;

  const institutions = getInstitutions();
  const filtered = institutions.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: institutions.length,
    ACTIVE: institutions.filter(i => i.status === 'ACTIVE').length,
    PENDING: institutions.filter(i => i.status === 'PENDING').length,
    SUSPENDED: institutions.filter(i => i.status === 'SUSPENDED').length,
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateInstitution(id, { status: newStatus as Institution['status'] });
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (id: string) => {
    if (confirm(isBn ? 'আপনি কি নিশ্চিত?' : 'Are you sure?')) {
      deleteInstitution(id);
      setRefreshKey(k => k + 1);
    }
  };

  const resetForm = () => setForm({
    name: "", code: "", slug: "", email: "", phone: "", address: "", city: "", district: "", contactPerson: "", contactPersonPhone: "", status: "PENDING",
  });

  const handleCreate = () => {
    if (!form.name || !form.code) return;
    createInstitution({
      name: form.name, code: form.code, slug: form.slug, email: form.email, phone: form.phone,
      address: form.address, city: form.city, district: form.district, contactPerson: form.contactPerson,
      contactPersonPhone: form.contactPersonPhone, status: form.status, totalStudents: 0, totalApplications: 0,
    });
    resetForm();
    setShowCreateModal(false);
    setRefreshKey(k => k + 1);
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'প্রতিষ্ঠান' : 'Institutions'}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? 'নিবন্ধিত প্রতিষ্ঠান পরিচালনা করুন' : 'Manage registered institutions'}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors shrink-0 ${isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
          >
            <Plus className="h-3.5 w-3.5" /> {isBn ? 'প্রতিষ্ঠান যোগ করুন' : 'Add Institution'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total', value: statusCounts.all },
            { label: isBn ? 'সক্রিয়' : 'Active', value: statusCounts.ACTIVE },
            { label: isBn ? 'বিচারাধীন' : 'Pending', value: statusCounts.PENDING },
            { label: isBn ? 'স্থগিত' : 'Suspended', value: statusCounts.SUSPENDED },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Building2 className={`h-5 w-5 ${iconColor}`} />
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
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <Input
                placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান..." : "Search by name or code..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
              />
            </div>
            <Select
              options={[
                { label: isBn ? 'সব স্ট্যাটাস' : 'All Status', value: '' },
                { label: isBn ? 'সক্রিয়' : 'Active', value: 'ACTIVE' },
                { label: isBn ? 'বিচারাধীন' : 'Pending', value: 'PENDING' },
                { label: isBn ? 'স্থগিত' : 'Suspended', value: 'SUSPENDED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full sm:w-40 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}`}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Building2 className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? 'প্রতিষ্ঠান তালিকা' : 'Institutions'}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Building2 className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো প্রতিষ্ঠান পাওয়া যায়নি' : 'No institutions found'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'যোগাযোগ' : 'Contact'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Students'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inst) => (
                  <TableRow key={inst.id} className={`${isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                          {inst.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{inst.name}</p>
                          <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{inst.city}, {inst.district}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{inst.code}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1">
                        <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'} flex items-center gap-1.5`}>
                          <Mail className="h-3 w-3" /> {inst.email}
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'} flex items-center gap-1.5`}>
                          <Phone className="h-3 w-3" /> {inst.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> {inst.totalStudents}
                      </span>
                    </TableCell>
                    <TableCell><Badge status={inst.status} /></TableCell>
                    <TableCell>
                      <div className="relative" ref={openDropdown === inst.id ? dropdownRef : undefined}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === inst.id ? null : inst.id)}
                          className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openDropdown === inst.id && (
                          <div className={`absolute right-0 top-8 z-50 w-36 rounded-xl border shadow-xl py-1 ${isDark ? 'bg-[#1a1a1c] border-white/[0.08]' : 'bg-white border-zinc-200'}`}>
                            {inst.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => { handleStatusChange(inst.id, 'ACTIVE'); setOpenDropdown(null); }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-emerald-400 hover:bg-white/[0.04]' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                >
                                  <Check className="h-3.5 w-3.5" /> {isBn ? 'অনুমোদন' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => { handleStatusChange(inst.id, 'REJECTED'); setOpenDropdown(null); }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-rose-400 hover:bg-white/[0.04]' : 'text-rose-600 hover:bg-rose-50'}`}
                                >
                                  <X className="h-3.5 w-3.5" /> {isBn ? 'বাতিল' : 'Reject'}
                                </button>
                              </>
                            )}
                            {inst.status === 'ACTIVE' && (
                              <button
                                onClick={() => { handleStatusChange(inst.id, 'SUSPENDED'); setOpenDropdown(null); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-amber-400 hover:bg-white/[0.04]' : 'text-amber-600 hover:bg-amber-50'}`}
                              >
                                <Ban className="h-3.5 w-3.5" /> {isBn ? 'স্থগিত' : 'Suspend'}
                              </button>
                            )}
                            {inst.status === 'SUSPENDED' && (
                              <button
                                onClick={() => { handleStatusChange(inst.id, 'ACTIVE'); setOpenDropdown(null); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-emerald-400 hover:bg-white/[0.04]' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              >
                                <Check className="h-3.5 w-3.5" /> {isBn ? 'পুনরুদ্ধার' : 'Reactivate'}
                              </button>
                            )}
                            <div className={`border-t my-0.5 ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`} />
                            <Link
                              href={`/super-admin/institutions/${inst.id}`}
                              onClick={() => setOpenDropdown(null)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-zinc-400 hover:bg-white/[0.04]' : 'text-zinc-600 hover:bg-zinc-50'}`}
                            >
                              <Eye className="h-3.5 w-3.5" /> {isBn ? 'দেখুন' : 'View'}
                            </Link>
                            <button
                              onClick={() => { handleDelete(inst.id); setOpenDropdown(null); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium transition-colors ${isDark ? 'text-rose-400 hover:bg-white/[0.04]' : 'text-rose-600 hover:bg-rose-50'}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'মুছুন' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Create Modal */}
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={isBn ? 'নতুন প্রতিষ্ঠান যোগ করুন' : 'Add New Institution'} maxWidth="max-w-xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'} *</label>
              <Input value={form.name} onChange={(e) => {
                const name = e.target.value;
                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                setForm({ ...form, name, slug });
              }} placeholder={isBn ? 'নাম লিখুন' : 'Enter name'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'কোড' : 'Code'} *</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={isBn ? 'কোড লিখুন' : 'Enter code'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'স্লাগ' : 'Slug'}</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={isBn ? 'স্লাগ' : 'auto-generated'} className="opacity-70" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Institution["status"] })} className={`w-full h-9 rounded-xl border px-3 text-[11px] transition-colors ${isDark ? "bg-white/[0.04] border-white/[0.06] text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"}`}>
                <option value="PENDING">{isBn ? 'বিচারাধীন' : 'Pending'}</option>
                <option value="ACTIVE">{isBn ? 'সক্রিয়' : 'Active'}</option>
                <option value="SUSPENDED">{isBn ? 'স্থগিত' : 'Suspended'}</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ইমেইল' : 'Email'}</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={isBn ? 'ইমেইল' : 'email@example.com'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ফোন' : 'Phone'}</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={isBn ? 'ফোন নম্বর' : 'Phone number'} />
            </div>
            <div className="col-span-2">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={isBn ? 'ঠিকানা' : 'Address'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'শহর' : 'City'}</label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={isBn ? 'শহর' : 'City'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'জেলা' : 'District'}</label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder={isBn ? 'জেলা' : 'District'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder={isBn ? 'ব্যক্তির নাম' : 'Person name'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>{isBn ? 'যোগাযোগ ফোন' : 'Contact Phone'}</label>
              <Input value={form.contactPersonPhone} onChange={(e) => setForm({ ...form, contactPersonPhone: e.target.value })} placeholder={isBn ? 'ব্যক্তির ফোন' : 'Person phone'} />
            </div>
          </div>
          <ModalFooter>
            <button onClick={() => setShowCreateModal(false)} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? 'bg-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900'}`}>{isBn ? 'বাতিল' : 'Cancel'}</button>
            <button onClick={handleCreate} className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>{isBn ? 'তৈরি করুন' : 'Create'}</button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
}

function InstitutionsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
