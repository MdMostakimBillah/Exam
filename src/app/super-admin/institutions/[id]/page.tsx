"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstitutionById, useUpdateInstitution } from "@/lib/storage/institutions";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useStudentsByInstitution } from "@/lib/storage/students";
import { useRegistrationsByInstitution } from "@/lib/storage/registrations";
import { usePaymentsByInstitution } from "@/lib/storage/payments";
import { useResultsByInstitution } from "@/lib/storage/results";
import { useCertificatesByInstitution } from "@/lib/storage/certificates";
import { Student, Registration } from "@/lib/types";
import { Building2, Users, CreditCard, Award, ArrowLeft, Mail, Phone, MapPin, Calendar, FileCheck, FileText, Edit, ListChecks, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type MarkEntryRollRange,
  formatMultipleRollRangesLabel,
  formatRollRangeLabel,
  normalizeRollDigits,
  normalizeRollRangePair,
} from "@/lib/marks/roll-range";
import { ManageRollRangesModal } from "@/components/marks/ManageRollRangesModal";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const updateInstitution = useUpdateInstitution();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    nameEn: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    district: "",
    contactPerson: "",
    contactPersonPhone: "",
  });
  const [updating, setUpdating] = useState(false);
  const [rollRangeDraft, setRollRangeDraft] = useState<{ id: string; from: string; to: string } | null>(null);
  const [manageRangesOpen, setManageRangesOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: inst } = useInstitutionById(params.id as string);
  const { data: students = [] } = useStudentsByInstitution(inst?.id || '');
  // Fetch enough registrations (newest first) to derive each student's
  // actual status from their latest application
  const { data: regs = [] } = useRegistrationsByInstitution(inst?.id || '', undefined, 1, 200);
  const { data: payments = [] } = usePaymentsByInstitution(inst?.id || '');
  const { data: results = [] } = useResultsByInstitution(inst?.id || '');
  const { data: certs = [] } = useCertificatesByInstitution(inst?.id || '');

  // studentId -> their newest registration
  const regByStudent = useMemo(() => {
    const map = new Map<string, Registration>();
    for (const r of regs) {
      const cur = map.get(r.studentId);
      if (!cur || new Date(r.createdAt) >= new Date(cur.createdAt)) {
        map.set(r.studentId, r);
      }
    }
    return map;
  }, [regs]);

  /**
   * The student's ACTUAL status on this page:
   *  - SUSPENDED/INACTIVE student → stays suspended regardless of applications
   *  - otherwise the latest application decides: APPROVED/VERIFIED (green),
   *    PENDING/PAYMENT_PENDING (amber), REJECTED (red)
   *  - no application yet → the student's own status (ACTIVE/PENDING)
   */
  const deriveStudentStatus = (s: Student): string => {
    if (s.status === 'SUSPENDED' || s.status === 'INACTIVE') return s.status;
    return regByStudent.get(s.id)?.status ?? s.status;
  };

  /**
   * Grant/revoke a student-facing download permission
   * (`allow_marksheet_download` / `allow_certificate_download`, migration
   * 0038). Only the super admin can flip it — a DB trigger blocks
   * self-grants, same as the admit-card flag.
   */
  const handleStudentDownloadPermission = (
    field: 'allowMarksheetDownload' | 'allowCertificateDownload',
    next: boolean,
    label: { bn: string; en: string }
  ) => {
    if (!inst) return;
    updateInstitution.mutate(
      {
        id: inst.id,
        data:
          field === 'allowMarksheetDownload'
            ? { allowMarksheetDownload: next }
            : { allowCertificateDownload: next },
      },
      {
        onSuccess: () =>
          toast(
            'success',
            next
              ? (isBn ? `${label.bn} অনুমতি চালু হয়েছে` : `${label.en} enabled`)
              : (isBn ? `${label.bn} অনুমতি বাতিল হয়েছে` : `${label.en} revoked`)
          ),
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : (isBn ? 'সংরক্ষণ ব্যর্থ' : 'Save failed')
          ),
      }
    );
  };

  const effectiveRollFrom =
    rollRangeDraft && rollRangeDraft.id === inst?.id
      ? rollRangeDraft.from
      : (inst?.markEntryRollFrom ?? "");
  const effectiveRollTo =
    rollRangeDraft && rollRangeDraft.id === inst?.id
      ? rollRangeDraft.to
      : (inst?.markEntryRollTo ?? "");

  const hasDirtyRollRange = Boolean(
    inst &&
      (normalizeRollDigits(effectiveRollFrom) !== normalizeRollDigits(inst.markEntryRollFrom) ||
        normalizeRollDigits(effectiveRollTo) !== normalizeRollDigits(inst.markEntryRollTo)),
  );

  /**
   * Grant/revoke this institution's admit-card download permission
   * (`institutions.allow_admit_card_download`, migration 0033).
   */
  const handleAdmitPermission = (next: boolean) => {
    if (!inst) return;
    updateInstitution.mutate(
      { id: inst.id, data: { allowAdmitCardDownload: next } },
      {
        onSuccess: () =>
          toast(
            'success',
            next
              ? (isBn ? 'প্রবেশপত্র ডাউনলোডের অনুমতি চালু হয়েছে' : 'Admit card download enabled')
              : (isBn ? 'প্রবেশপত্র ডাউনলোডের অনুমতি বাতিল হয়েছে' : 'Admit card download revoked')
          ),
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : (isBn ? 'সংরক্ষণ ব্যর্থ' : 'Save failed')
          ),
      }
    );
  };

  /**
   * Grant/revoke this institution's blind mark-entry permission and persist any
   * entered roll-range bounds (`allow_mark_entry`, `mark_entry_roll_from`,
   * `mark_entry_roll_to`, migration 0043).
   */
  const handleMarkEntryPermission = (next: boolean) => {
    if (!inst) return;
    const normalized = normalizeRollRangePair(effectiveRollFrom, effectiveRollTo);
    updateInstitution.mutate(
      {
        id: inst.id,
        data: {
          allowMarkEntry: next,
          markEntryRollFrom: normalized.from,
          markEntryRollTo: normalized.to,
        },
      },
      {
        onSuccess: () => {
          setRollRangeDraft(null);
          toast(
            'success',
            next
              ? (isBn ? 'নম্বর প্রবেশের অনুমতি চালু হয়েছে' : 'Mark entry enabled')
              : (isBn ? 'নম্বর প্রবেশের অনুমতি বন্ধ করা হয়েছে' : 'Mark entry restricted')
          );
        },
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : (isBn ? 'সংরক্ষণ ব্যর্থ' : 'Save failed')
          ),
      }
    );
  };

  const handleMarkEntryRangeSave = (clear = false) => {
    if (!inst) return;
    const normalized = clear
      ? { from: null, to: null, swapped: false }
      : normalizeRollRangePair(effectiveRollFrom, effectiveRollTo);
    updateInstitution.mutate(
      {
        id: inst.id,
        data: {
          markEntryRollFrom: normalized.from,
          markEntryRollTo: normalized.to,
        },
      },
      {
        onSuccess: () => {
          setRollRangeDraft(null);
          toast(
            'success',
            clear
              ? (isBn ? 'রোল রেঞ্জ মুছে ফেলা হয়েছে (সকল রোল)' : 'Roll range cleared (all rolls)')
              : `${isBn ? 'রোল রেঞ্জ সংরক্ষিত' : 'Roll range saved'}: ${formatRollRangeLabel(normalized.from, normalized.to, isBn)}`
          );
        },
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : (isBn ? 'সংরক্ষণ ব্যর্থ' : 'Save failed')
          ),
      }
    );
  };

  const handleSaveMultipleRanges = (ranges: MarkEntryRollRange[]) => {
    if (!inst) return;
    updateInstitution.mutate(
      {
        id: inst.id,
        data: {
          markEntryRollRanges: ranges,
        },
      },
      {
        onSuccess: () => {
          setRollRangeDraft(null);
          toast(
            'success',
            isBn ? 'রোল রেঞ্জসমূহ সফলভাবে সংরক্ষিত হয়েছে' : 'Roll ranges saved successfully'
          );
        },
        onError: (err) =>
          toast(
            'error',
            err instanceof Error ? err.message : (isBn ? 'সংরক্ষণ ব্যর্থ' : 'Save failed')
          ),
      }
    );
  };

  const handleStartEdit = () => {
    if (!inst) return;
    setEditForm({
      name: inst.name || "",
      nameEn: inst.nameEn || "",
      code: inst.code || "",
      email: inst.email || "",
      phone: inst.phone || "",
      address: inst.address || "",
      city: inst.city || "",
      district: inst.district || "",
      contactPerson: inst.contactPerson || "",
      contactPersonPhone: inst.contactPersonPhone || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!inst) return;
    if (!editForm.name.trim()) {
      toast("error", isBn ? "প্রতিষ্ঠানের নাম আবশ্যক" : "Institution name is required");
      return;
    }
    setUpdating(true);
    try {
      await updateInstitution.mutateAsync({
        id: inst.id,
        data: {
          name: editForm.name.trim(),
          nameEn: editForm.nameEn.trim(),
          code: editForm.code.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          address: editForm.address.trim(),
          city: editForm.city.trim(),
          district: editForm.district.trim(),
          contactPerson: editForm.contactPerson.trim(),
          contactPersonPhone: editForm.contactPersonPhone.trim(),
        },
      });
      toast("success", isBn ? "প্রতিষ্ঠানের নাম ও তথ্য সফলভাবে আপডেট হয়েছে" : "Institution name and details updated successfully");
      setShowEditModal(false);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : (isBn ? "আপডেট ব্যর্থ হয়েছে" : "Update failed"));
    } finally {
      setUpdating(false);
    }
  };

  if (!mounted) return <InstitutionSkeleton isDark={isDark} />;
  if (!inst) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0a0a0b]' : 'bg-zinc-50'}`}><p className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Institution not found</p></div>;

  const totalPaid = payments.reduce((s, p) => s + (p.status === 'PAID' ? p.amount : 0), 0);
  const totalDue = payments.reduce((s, p) => s + (p.status === 'PENDING' ? p.amount : 0), 0);

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-md"
    : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  const stats = [
    { label: isBn ? 'শিক্ষার্থী' : 'Students', value: students.length, icon: Users },
    { label: isBn ? 'আবেদন' : 'Applications', value: regs.length, icon: Building2 },
    { label: isBn ? 'সংগ্রহিত' : 'Collected', value: '৳' + totalPaid.toLocaleString(), icon: CreditCard },
    { label: isBn ? 'সার্টিফিকেট' : 'Certificates', value: certs.length, icon: Award },
  ];

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/[0.08] text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{isBn ? inst.name : (inst.nameEn || inst.name)}</h1>
                <Badge status={inst.status} />
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{inst.code} · {inst.city}, {inst.district}</p>
            </div>
          </div>
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-opacity shrink-0"
          >
            <Edit className="h-3.5 w-3.5" />
            {isBn ? 'নাম বা তথ্য পরিবর্তন' : 'Edit Name / Details'}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
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

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8">
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <Tabs defaultValue="students">
                  <TabsList className={isDark ? 'bg-white/[0.04]' : 'bg-zinc-100'}>
                    <TabsTrigger value="students" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'শিক্ষার্থী' : 'Students'}
                    </TabsTrigger>
                    <TabsTrigger value="applications" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'আবেদন' : 'Applications'}
                    </TabsTrigger>
                    <TabsTrigger value="results" className={isDark ? 'data-[state=active]:bg-white/[0.08]' : 'data-[state=active]:bg-white'}>
                      {isBn ? 'ফলাফল' : 'Results'}
                    </TabsTrigger>
                  </TabsList>

                  <div className="p-5">
                    <TabsContent value="students">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'নাম' : 'Name'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>ID</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো শিক্ষার্থী পাওয়া যায়নি' : 'No students found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            students.slice(0, 10).map(s => (
                              <TableRow key={s.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{s.firstName} {s.lastName}</TableCell>
                                <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{s.studentId}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{s.class}</TableCell>
                                <TableCell><Badge status={deriveStudentStatus(s)} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="applications">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>App ID</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'পরীক্ষা' : 'Exam'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {regs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো আবেদন পাওয়া যায়নি' : 'No applications found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            regs.slice(0, 10).map(r => (
                              <TableRow key={r.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{r.registrationNumber}</TableCell>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.studentName}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.examName}</TableCell>
                                <TableCell><Badge status={r.status} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="results">
                      <Table>
                        <TableHeader>
                          <TableRow className={isDark ? 'border-white/[0.04] hover:bg-transparent' : 'border-zinc-100 hover:bg-transparent'}>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শিক্ষার্থী' : 'Student'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'শ্রেণী' : 'Class'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট' : 'Total'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'গ্রেড' : 'Grade'}</TableHead>
                            <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বৃত্তি' : 'Scholarship'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className={`text-center py-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                {isBn ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            results.slice(0, 10).map(r => (
                              <TableRow key={r.id} className={isDark ? 'border-white/[0.04] hover:bg-white/[0.02]' : 'border-zinc-100 hover:bg-zinc-50/50'}>
                                <TableCell className={`text-sm font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.studentName}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.className}</TableCell>
                                <TableCell className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.totalMarks}/{r.totalFullMarks}</TableCell>
                                <TableCell className={`text-[11px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{r.grade}</TableCell>
                                    <TableCell><Badge status={r.scholarshipStatus}>{r.scholarshipStatus}</Badge></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Institution Info */}
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'প্রতিষ্ঠান তথ্য' : 'Institution Details'}</h3>
                <button
                  onClick={handleStartEdit}
                  className={`text-xs flex items-center gap-1 transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  <Edit className="h-3 w-3" />
                  {isBn ? 'সম্পাদনা' : 'Edit'}
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ইমেইল' : 'Email'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ফোন' : 'Phone'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'ঠিকানা' : 'Address'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.address}, {inst.city}, {inst.district}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className={`h-4 w-4 ${iconColor} mt-0.5`} />
                  <div>
                    <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</p>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>{inst.contactPerson}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions */}
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'অনুমতি' : 'Permissions'}</h3>
              </div>
              <div className="p-5">
                <Switch
                  checked={inst.allowAdmitCardDownload ?? false}
                  onCheckedChange={handleAdmitPermission}
                  disabled={updateInstitution.isPending}
                  label="Admit card download"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <FileCheck className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{isBn ? 'প্রবেশপত্র ডাউনলোড' : 'Admit card download'}</p>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {isBn
                          ? 'চালু থাকলে প্রতিষ্ঠান নিজের প্রবেশপত্র দেখতে, প্রিন্ট ও ডাউনলোড করতে পারবে'
                          : 'When on, the institution can view, print and download its own admit cards'}
                      </p>
                    </div>
                  </div>
                </Switch>
                <p className={`text-[11px] mt-3 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {isBn
                    ? 'প্রবেশপত্র তৈরি হয় সুপার অ্যাডমিনের পক্ষ থেকে — এখানে শুধু ডাউনলোডের অনুমতি দেওয়া হয়।'
                    : 'Cards are generated by the super admin — this toggle only grants the download.'}
                </p>
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  <Switch
                    checked={inst.allowMarkEntry ?? false}
                    onCheckedChange={handleMarkEntryPermission}
                    disabled={updateInstitution.isPending}
                    label="Mark entry permission"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <ListChecks className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-[12px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                            {isBn ? 'নম্বর প্রবেশের অনুমতি (মার্ক এন্ট্রি)' : 'Mark entry permission'}
                          </p>
                          {inst.allowMarkEntry && (
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                              {formatMultipleRollRangesLabel(inst.markEntryRollRanges, inst.markEntryRollFrom, inst.markEntryRollTo, isBn)}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {isBn
                            ? 'চালু থাকলে প্রতিষ্ঠান অন্য প্রতিষ্ঠানের শিক্ষার্থীদের নম্বর দিতে পারবে (নির্ধারিত রোল রেঞ্জের মধ্যে)'
                            : 'When on, the institution can enter blind marks for students within the permitted roll range below'}
                        </p>
                      </div>
                    </div>
                  </Switch>

                  <div className={`mt-3 rounded-md border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-zinc-200/80 bg-zinc-50/70'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {isBn ? 'অনুমোদিত রোল রেঞ্জ' : 'Permitted roll ranges'}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {formatMultipleRollRangesLabel(inst.markEntryRollRanges, inst.markEntryRollFrom, inst.markEntryRollTo, isBn)}
                      </span>
                    </div>

                    {inst.markEntryRollRanges && inst.markEntryRollRanges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {inst.markEntryRollRanges.map((r, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono ${
                              isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-200/70 text-zinc-800"
                            }`}
                          >
                            {r.className && (
                              <span className="font-sans text-brand-accent font-semibold">{r.className}:</span>
                            )}
                            {r.from}–{r.to}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className={`text-[10px] mb-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {isBn
                        ? 'ফাঁকা রাখলে সকল রোল অনুমোদিত; নির্দিষ্ট রোল ব্লক দিতে শুরুর ও শেষ রোল লিখুন অথবা একাধিক শ্রেণি কনফিগার করুন।'
                        : 'Leave empty to allow all rolls, or set From / To roll numbers, or configure multiple class ranges.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={effectiveRollFrom}
                        onChange={(e) =>
                          setRollRangeDraft({
                            id: inst.id,
                            from: normalizeRollDigits(e.target.value),
                            to: effectiveRollTo,
                          })
                        }
                        placeholder={isBn ? 'শুরুর রোল' : 'From roll'}
                        inputMode="numeric"
                        disabled={updateInstitution.isPending}
                        className={`h-8 w-28 text-center text-xs font-mono ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
                        aria-label={isBn ? 'শুরুর রোল' : 'From roll'}
                      />
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>→</span>
                      <Input
                        value={effectiveRollTo}
                        onChange={(e) =>
                          setRollRangeDraft({
                            id: inst.id,
                            from: effectiveRollFrom,
                            to: normalizeRollDigits(e.target.value),
                          })
                        }
                        placeholder={isBn ? 'শেষ রোল' : 'To roll'}
                        inputMode="numeric"
                        disabled={updateInstitution.isPending}
                        className={`h-8 w-28 text-center text-xs font-mono ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-zinc-200 text-zinc-900'}`}
                        aria-label={isBn ? 'শেষ রোল' : 'To roll'}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={hasDirtyRollRange ? 'default' : 'secondary'}
                        disabled={!hasDirtyRollRange || updateInstitution.isPending}
                        onClick={() => handleMarkEntryRangeSave(false)}
                      >
                        <Save className="mr-1 h-3 w-3" />
                        {isBn ? 'সংরক্ষণ' : 'Save'}
                      </Button>
                      {(inst.markEntryRollFrom || inst.markEntryRollTo || effectiveRollFrom || effectiveRollTo) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={updateInstitution.isPending}
                          onClick={() => handleMarkEntryRangeSave(true)}
                          title={isBn ? 'সকল রোল অনুমোদন করুন' : 'Clear range (all rolls)'}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          {isBn ? 'সব রোল' : 'All rolls'}
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full mt-2.5 h-8 text-xs flex items-center justify-center gap-1.5"
                      onClick={() => setManageRangesOpen(true)}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {isBn ? 'একাধিক রোল রেঞ্জ ও শ্রেণি কনফিগার করুন' : 'Configure Multiple Roll Ranges'}
                    </Button>
                  </div>
                </div>
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  <Switch
                    checked={inst.allowMarksheetDownload ?? false}
                    onCheckedChange={(next) =>
                      handleStudentDownloadPermission('allowMarksheetDownload', next, {
                        bn: 'মার্কশিট ডাউনলোডের',
                        en: 'Marksheet download',
                      })
                    }
                    disabled={updateInstitution.isPending}
                    label="Marksheet download"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <FileText className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                      <div className="min-w-0">
                        <p className={`text-[12px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{isBn ? 'মার্কশিট ডাউনলোড (শিক্ষার্থী)' : 'Marksheet download (students)'}</p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {isBn
                            ? 'চালু থাকলে এই প্রতিষ্ঠানের শিক্ষার্থীরা নিজের মার্কশিট পাতা ও ডাউনলোড অপশন দেখতে পারবে'
                            : 'When on, this institution’s students see the Marksheet section and its download option'}
                        </p>
                      </div>
                    </div>
                  </Switch>
                </div>
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
                  <Switch
                    checked={inst.allowCertificateDownload ?? false}
                    onCheckedChange={(next) =>
                      handleStudentDownloadPermission('allowCertificateDownload', next, {
                        bn: 'সার্টিফিকেট ডাউনলোডের',
                        en: 'Certificate download',
                      })
                    }
                    disabled={updateInstitution.isPending}
                    label="Certificate download"
                  >
                    <div className="min-w-0 flex items-start gap-3">
                      <Award className={`h-4 w-4 ${iconColor} mt-0.5 shrink-0`} />
                      <div className="min-w-0">
                        <p className={`text-[12px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>{isBn ? 'সার্টিফিকেট ডাউনলোড (শিক্ষার্থী)' : 'Certificate download (students)'}</p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {isBn
                            ? 'চালু থাকলে শিক্ষার্থীরা নিজের সার্টিফিকেট দেখতে, যাচাই ও ডাউনলোড করতে পারবে'
                            : 'When on, students can view, verify and download their own certificates'}
                        </p>
                      </div>
                    </div>
                  </Switch>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className={`${card}`}>
              <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরিসংখ্যান' : 'Statistics'}</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'মোট শিক্ষার্থী' : 'Total Students'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{students.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'সক্রিয় শিক্ষার্থী' : 'Active Students'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{students.filter(s => s.status === 'ACTIVE').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'অনুমোদিত আবেদন' : 'Approved Applications'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{regs.filter(r => r.status === 'APPROVED').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>{isBn ? 'বকেয়া' : 'Due Amount'}</span>
                  <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>৳{totalDue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Institution Modal */}
        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          title={isBn ? 'প্রতিষ্ঠানের নাম ও তথ্য পরিবর্তন' : 'Edit Institution Name & Details'}
          maxWidth="max-w-xl"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                {isBn ? 'প্রতিষ্ঠানের নাম (বাংলা / প্রধান)' : 'Institution Name (Bangla / Primary)'} *
              </label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={isBn ? 'প্রতিষ্ঠানের নাম লিখুন' : 'Enter institution name'}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {isBn ? 'প্রতিষ্ঠানের নাম (ইংরেজি)' : 'Institution Name (English)'}
              </label>
              <Input
                value={editForm.nameEn}
                onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                placeholder={isBn ? 'ইংরেজি নাম (ঐচ্ছিক)' : 'English name (optional)'}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'কোড' : 'Code'}</label>
              <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder={isBn ? 'কোড' : 'Code'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ইমেইল' : 'Email'}</label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder={isBn ? 'ইমেইল' : 'email@example.com'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ফোন' : 'Phone'}</label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder={isBn ? 'ফোন নম্বর' : 'Phone'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</label>
              <Input value={editForm.contactPerson} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} placeholder={isBn ? 'ব্যক্তির নাম' : 'Contact person'} />
            </div>
            <div className="col-span-2">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder={isBn ? 'ঠিকানা' : 'Address'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'শহর' : 'City'}</label>
              <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder={isBn ? 'শহর' : 'City'} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={`block text-xs mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'জেলা' : 'District'}</label>
              <Input value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} placeholder={isBn ? 'জেলা' : 'District'} />
            </div>
          </div>
          <ModalFooter>
            <button
              onClick={() => setShowEditModal(false)}
              className={`px-4 py-2 rounded-md text-[11px] font-medium transition-colors ${isDark ? 'bg-white/[0.08] text-zinc-300 hover:text-white' : 'bg-zinc-100 text-zinc-700 hover:text-zinc-900'}`}
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={updating}
              className="px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {updating ? (isBn ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (isBn ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes')}
            </button>
          </ModalFooter>
        </Modal>

        <ManageRollRangesModal
          open={manageRangesOpen}
          onClose={() => setManageRangesOpen(false)}
          institution={inst || null}
          onSave={handleSaveMultipleRanges}
          isDark={isDark}
          isBn={isBn}
          saving={updateInstitution.isPending}
        />
      </div>
    </div>
  );
}

function InstitutionSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${card} rounded-md h-[52px]`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <div className={`${card} rounded-md h-64`} />
          </div>
          <div className="col-span-4 space-y-6">
            <div className={`${card} rounded-md h-48`} />
            <div className={`${card} rounded-md h-48`} />
          </div>
        </div>
      </div>
    </div>
  );
}
