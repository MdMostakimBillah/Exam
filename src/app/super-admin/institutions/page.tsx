"use client";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInstitutions, updateInstitution } from "@/lib/storage/institutions";
import { Institution } from "@/lib/types";
import { Building2, Search, Plus, MapPin, Users, Mail, Phone, ArrowRight, Check, X, Ban, Clock } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import Link from "next/link";

export default function InstitutionsPage() {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  const isDark = theme === "dark";
  const isBn = language === "bn";

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

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200/50";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white/70 backdrop-blur-xl border border-white/80";
  const inputBg = isDark ? "bg-white/[0.05]" : "bg-white";

  const stats = [
    { label: isBn ? 'মোট প্রতিষ্ঠান' : 'Total', value: statusCounts.all, icon: Building2 },
    { label: isBn ? 'সক্রিয়' : 'Active', value: statusCounts.ACTIVE, icon: Building2 },
    { label: isBn ? 'বিচারাধীন' : 'Pending', value: statusCounts.PENDING, icon: Building2 },
    { label: isBn ? 'স্থগিত' : 'Suspended', value: statusCounts.SUSPENDED, icon: Building2 },
  ];

  const handleStatusChange = (id: string, newStatus: string) => {
    updateInstitution(id, { status: newStatus as Institution['status'] });
    setRefreshKey(k => k + 1);
  };

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className={`${glassCard}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-zinc-100'}`}>
                    <stat.icon className={`h-5 w-5 ${textSec}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xl font-semibold ${text}`}>{stat.value}</p>
                    <p className={`text-xs ${textSec} truncate`}>{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className={glassCard}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSec}`} />
                <Input
                  placeholder={isBn ? "নাম বা কোড দিয়ে অনুসন্ধান করুন..." : "Search by name or code..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`pl-10 ${inputBg}`}
                />
              </div>
              <Select
                options={[
                  { label: isBn ? 'সব অবস্থা' : 'All Status', value: '' },
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Suspended', value: 'SUSPENDED' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full sm:w-40 ${inputBg}`}
              />
              <Button>
                Add Institution
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow className={border}>
                  <TableHead className={textSec}>{isBn ? 'প্রতিষ্ঠান' : 'Institution'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'কোড' : 'Code'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'যোগাযোগ' : 'Contact'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'শিক্ষার্থী' : 'Students'}</TableHead>
                  <TableHead className={textSec}>{isBn ? 'স্থিতি' : 'Status'}</TableHead>
                  <TableHead className={textSec}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className={`text-center py-12 ${textSec}`}>
                      {isBn ? 'কোনো প্রতিষ্ঠান পাওয়া যায়নি' : 'No institutions found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inst) => (
                    <TableRow key={inst.id} className={`${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-zinc-50'}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold ${isDark ? 'bg-white/10 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {inst.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${text}`}>{inst.name}</p>
                            <p className={`text-xs ${textSec}`}>{inst.city}, {inst.district}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-sm font-mono ${textSec}`}>{inst.code}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className={`text-xs ${textSec} flex items-center gap-1.5`}>
                            <Mail className="h-3 w-3" /> {inst.email}
                          </p>
                          <p className={`text-xs ${textSec} flex items-center gap-1.5`}>
                            <Phone className="h-3 w-3" /> {inst.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={`text-sm ${textSec}`}>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {inst.totalStudents}
                        </span>
                      </TableCell>
                      <TableCell><Badge status={inst.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {inst.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(inst.id, 'ACTIVE')}
                                className={`h-7 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                              >
                                <Check className="h-3 w-3" /> {isBn ? 'অনুমোদন' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleStatusChange(inst.id, 'SUSPENDED')}
                                className={`h-7 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                              >
                                <X className="h-3 w-3" /> {isBn ? 'বাতিল' : 'Reject'}
                              </button>
                            </>
                          )}
                          {inst.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleStatusChange(inst.id, 'SUSPENDED')}
                              className={`h-7 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${isDark ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                            >
                              <Ban className="h-3 w-3" /> {isBn ? 'স্থগিত' : 'Suspend'}
                            </button>
                          )}
                          {inst.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleStatusChange(inst.id, 'ACTIVE')}
                              className={`h-7 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${isDark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            >
                              <Check className="h-3 w-3" /> {isBn ? 'পুনরুদ্ধার' : 'Reactivate'}
                            </button>
                          )}
                          <Link href={`/super-admin/institutions/${inst.id}`} className={`h-7 px-2 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors ${isDark ? 'bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]' : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'}`}>
                            {isBn ? 'দেখুন' : 'View'}
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InstitutionsSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const cardBg = isDark ? "bg-white/[0.03]" : "bg-white";
  
  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="p-6 lg:p-8">
        <div className={`h-8 w-48 rounded mb-8 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`h-20 rounded-lg ${cardBg}`} />
          ))}
        </div>
        <div className={`h-96 rounded-lg ${cardBg}`} />
      </div>
    </div>
  );
}
