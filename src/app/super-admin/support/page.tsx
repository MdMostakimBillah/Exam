"use client";
import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { formatDate } from "@/lib/storage/storage";
import { SupportReport, SupportStatus } from "@/lib/types";
import { useInstitutionName } from "@/lib/storage/institutions";
import {
  useSupportReports, useUpdateSupportReport, useDeleteSupportReport,
  useHelpdeskContact, useSaveHelpdeskContact, HelpdeskContact,
} from "@/lib/storage/support";
import {
  LifeBuoy, Search, Phone, Mail, Clock, Eye, Trash2, Save,
  CircleDot, AlertTriangle, CheckCircle, Send, Building2,
} from "lucide-react";

const STATUS_OPTIONS: SupportStatus[] = ["open", "in_progress", "resolved"];

const STATUS_LABELS: Record<SupportStatus, { en: string; bn: string }> = {
  open: { en: "Open", bn: "খোলা" },
  in_progress: { en: "In Progress", bn: "চলমান" },
  resolved: { en: "Resolved", bn: "সমাধান" },
};

const CATEGORY_LABELS: Record<string, { en: string; bn: string }> = {
  login: { en: "Login / Account", bn: "লগইন / অ্যাকাউন্ট" },
  registration: { en: "Student Registration", bn: "শিক্ষার্থী নিবন্ধন" },
  payment: { en: "Payment", bn: "পেমেন্ট" },
  exam: { en: "Exam / Marks", bn: "পরীক্ষা / নম্বর" },
  results: { en: "Results", bn: "ফলাফল" },
  certificates: { en: "Certificates / Admit Card", bn: "সার্টিফিকেট / প্রবেশপত্র" },
  other: { en: "Other website problem", bn: "অন্যান্য ওয়েবসাইট সমস্যা" },
};

/** Inline status badge matching the Badge component's colour language. */
function StatusBadge({ status, isBn }: { status: SupportStatus; isBn: boolean }) {
  const cls =
    status === "open"
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : status === "in_progress"
        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  const Icon = status === "open" ? CircleDot : status === "in_progress" ? AlertTriangle : CheckCircle;
  return (
    <Badge className={`border text-[10px] ${cls}`}>
      <Icon className="h-3 w-3 mr-1" />
      {isBn ? STATUS_LABELS[status].bn : STATUS_LABELS[status].en}
    </Badge>
  );
}

export default function SupportPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  // Stored Bangla institution names render as name_en in English.
  const instName = useInstitutionName();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { data: reports = [], isLoading } = useSupportReports();
  const updateReport = useUpdateSupportReport();
  const deleteReport = useDeleteSupportReport();

  // ── Help desk contact (the number every institution is told to call) ──
  const { data: contactData } = useHelpdeskContact();
  const saveContact = useSaveHelpdeskContact();
  const [contact, setContact] = useState<HelpdeskContact>({ phone: "", email: "", hours: "" });
  const [contactSeeded, setContactSeeded] = useState(false);
  useEffect(() => {
    if (contactData && !contactSeeded) {
      setContact(contactData);
      setContactSeeded(true);
    }
  }, [contactData, contactSeeded]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SupportStatus>("all");
  const [selected, setSelected] = useState<SupportReport | null>(null);
  const [reply, setReply] = useState("");

  const counts = useMemo(() => ({
    all: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    in_progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  }), [reports]);

  const filtered = useMemo(() => reports.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      r.subject.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q) ||
      r.reporterName.toLowerCase().includes(q) ||
      ((r.institutionName || "") !== "" && instName(r.institutionName).toLowerCase().includes(q));
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [reports, search, statusFilter, instName]);

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-md" : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const subtext = isDark ? "text-zinc-500" : "text-zinc-500";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";
  const inputCls = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20"
    : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400";

  const handleSaveContact = async () => {
    try {
      await saveContact.mutateAsync(contact);
      toast("success", isBn ? "সাপোর্ট নম্বর সংরক্ষিত হয়েছে" : "Support contact saved");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : (isBn ? "সংরক্ষণ ব্যর্থ" : "Save failed"));
    }
  };

  const openDetail = (r: SupportReport) => {
    setSelected(r);
    setReply(r.adminNote || "");
  };

  const handleStatus = async (status: SupportStatus) => {
    if (!selected) return;
    const res = await updateReport.mutateAsync({ id: selected.id, data: { status, adminNote: reply.trim() || undefined } });
    if (res) {
      setSelected(res);
      toast("success", isBn ? "স্ট্যাটাস আপডেট হয়েছে" : "Status updated");
    } else {
      toast("error", isBn ? "আপডেট ব্যর্থ" : "Update failed");
    }
  };

  const handleDelete = async (r: SupportReport) => {
    if (!confirm(isBn ? `এই অভিযোগ মুছে ফেলবেন? "${r.subject}"` : `Delete this report? "${r.subject}"`)) return;
    const ok = await deleteReport.mutateAsync(r.id);
    if (ok) {
      if (selected?.id === r.id) setSelected(null);
      toast("success", isBn ? "অভিযোগ মুছে ফেলা হয়েছে" : "Report deleted");
    } else {
      toast("error", isBn ? "মোছা যায়নি" : "Could not delete");
    }
  };

  if (!mounted) return <SupportSkeleton isDark={isDark} />;

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent-soft text-brand-accent">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                {isBn ? "সাপোর্ট ও সমস্যা" : "Support & Problems"}
              </h1>
            </div>
            <p className={`text-sm mt-1 ${subtext}`}>
              {isBn
                ? "প্রতিষ্ঠানগুলোর জমা দেওয়া ওয়েবসাইট সমস্যা এবং সাপোর্ট নম্বর"
                : "Website problems reported by institutions, and the support number they call"}
            </p>
          </div>
        </div>

        {/* Help desk contact — only the super admin can set this */}
        <div className={`${card} p-5 mb-6`}>
          <div className="flex items-center gap-2 mb-4">
            <Phone className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "সাপোর্ট যোগাযোগ (সব প্রতিষ্ঠান এই নম্বরে যোগাযোগ করবে)" : "Support Contact (shown to every institution)"}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${labelCls}`}>{isBn ? "হটলাইন নম্বর" : "Helpline Number"}</label>
              <div className="relative">
                <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                <input
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className={`w-full h-10 rounded-md border pl-9 pr-3 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${labelCls}`}>{isBn ? "সাপোর্ট ইমেইল" : "Support Email"}</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="support@example.com"
                  className={`w-full h-10 rounded-md border pl-9 pr-3 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
            </div>
            <div>
              <label className={`block text-xs mb-1.5 font-medium ${labelCls}`}>{isBn ? "সেবার সময়" : "Available Hours"}</label>
              <div className="relative">
                <Clock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                <input
                  value={contact.hours}
                  onChange={(e) => setContact({ ...contact, hours: e.target.value })}
                  placeholder={isBn ? "রবি–বৃহস্পতি, সকাল ৯টা – সন্ধ্যা ৬টা" : "Sun – Thu, 9:00 AM – 6:00 PM"}
                  className={`w-full h-10 rounded-md border pl-9 pr-3 text-sm outline-none transition-colors ${inputCls}`}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-zinc-200 dark:border-white/[0.04]">
            <button
              onClick={handleSaveContact}
              disabled={saveContact.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saveContact.isPending
                ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Save className="h-4 w-4" />}
              {isBn ? "সংরক্ষণ করুন" : "Save Contact"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {([
            { key: "all" as const, label: isBn ? "মোট" : "Total", icon: LifeBuoy },
            { key: "open" as const, label: isBn ? "খোলা" : "Open", icon: CircleDot },
            { key: "in_progress" as const, label: isBn ? "চলমান" : "In Progress", icon: AlertTriangle },
            { key: "resolved" as const, label: isBn ? "সমাধান" : "Resolved", icon: CheckCircle },
          ]).map((s) => (
            <div key={s.key} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 bg-brand-accent-soft text-brand-accent">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{counts[s.key]}</p>
                <p className={`text-[11px] ${subtext}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <input
                type="text"
                placeholder={isBn ? "বিষয়, প্রতিষ্ঠান বা নামে অনুসন্ধান..." : "Search by subject, institution or name..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-md text-sm border transition-colors focus:outline-none ${inputCls}`}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", ...STATUS_OPTIONS] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === key
                      ? isDark ? "bg-white/[0.1] text-white" : "bg-zinc-200 text-zinc-900"
                      : isDark ? "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {key === "all"
                    ? (isBn ? "সব" : "All")
                    : (isBn ? STATUS_LABELS[key as SupportStatus].bn : STATUS_LABELS[key as SupportStatus].en)}
                  <span className="ml-1.5 opacity-60">{counts[key as keyof typeof counts]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reports table */}
        <div className={`${card} overflow-hidden`}>
          <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <LifeBuoy className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "জমা দেওয়া সমস্যা" : "Reported Problems"}
              </h3>
              <span className={`text-[11px] ${subtext}`}>({filtered.length})</span>
            </div>
          </div>

          {isLoading && reports.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className={`h-14 w-14 rounded-md flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <LifeBuoy className="h-7 w-7 text-brand-accent" />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "কোনো অভিযোগ নেই" : "No reports"}
              </p>
              <p className={`text-xs mt-1 ${subtext}`}>
                {isBn ? "/help পেজ থেকে এলে এখানে দেখা যাবে" : "Reports submitted from the /help page will appear here"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                  <TableHead>{isBn ? "বিষয়" : "Subject"}</TableHead>
                  <TableHead>{isBn ? "প্রতিষ্ঠান" : "Institution"}</TableHead>
                  <TableHead>{isBn ? "রিপোর্টার" : "Reporter"}</TableHead>
                  <TableHead>{isBn ? "ধরন" : "Category"}</TableHead>
                  <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                  <TableHead>{isBn ? "স্ট্যাটাস" : "Status"}</TableHead>
                  <TableHead className="text-right">{isBn ? "কার্যক্রম" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                      <span className="line-clamp-2">{r.subject}</span>
                    </TableCell>
                    <TableCell className="text-[12px]">
                      {r.institutionName ? (
                        <span className={`inline-flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                          <Building2 className="h-3.5 w-3.5 opacity-60" />
                          {instName(r.institutionName)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px]">
                      <p className={isDark ? "text-zinc-300" : "text-zinc-700"}>{r.reporterName}</p>
                      {r.reporterPhone && <p className="text-[11px] text-zinc-500">{r.reporterPhone}</p>}
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-500">
                      {isBn ? (CATEGORY_LABELS[r.category]?.bn || r.category) : (CATEGORY_LABELS[r.category]?.en || r.category)}
                    </TableCell>
                    <TableCell className="text-[11px] text-zinc-500">{formatDate(r.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={r.status} isBn={isBn} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(r)}
                          title={isBn ? "বিস্তারিত" : "View"}
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${isDark ? "hover:bg-white/[0.08] text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          title={isBn ? "মুছুন" : "Delete"}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject}
        description={selected ? `${formatDate(selected.createdAt)} · ${isBn ? (CATEGORY_LABELS[selected.category]?.bn || selected.category) : (CATEGORY_LABELS[selected.category]?.en || selected.category)}` : undefined}
        maxWidth="max-w-2xl"
      >
        {selected && (
          <div className="space-y-5">
            <div className={`rounded-md border p-4 ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className={`text-[11px] uppercase tracking-wider ${subtext}`}>{isBn ? "রিপোর্টার" : "Reporter"}</p>
                  <p className={isDark ? "text-zinc-200" : "text-zinc-800"}>{selected.reporterName}</p>
                  {selected.reporterEmail && <p className="text-[12px] text-zinc-500">{selected.reporterEmail}</p>}
                  {selected.reporterPhone && <p className="text-[12px] text-zinc-500">{selected.reporterPhone}</p>}
                </div>
                <div>
                  <p className={`text-[11px] uppercase tracking-wider ${subtext}`}>{isBn ? "প্রতিষ্ঠান" : "Institution"}</p>
                  <p className={isDark ? "text-zinc-200" : "text-zinc-800"}>{selected.institutionName ? instName(selected.institutionName) : "—"}</p>
                </div>
              </div>
            </div>

            <div>
              <p className={`text-[11px] uppercase tracking-wider mb-1.5 ${subtext}`}>{isBn ? "সমস্যার বিবরণ" : "Problem Description"}</p>
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {selected.message}
              </p>
            </div>

            <div>
              <p className={`text-[11px] uppercase tracking-wider mb-1.5 ${subtext}`}>{isBn ? "স্ট্যাটাস" : "Status"}</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatus(s)}
                    disabled={updateReport.isPending}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors border ${
                      selected.status === s
                        ? "border-brand-accent/40 bg-brand-accent-soft text-brand-accent"
                        : isDark
                          ? "border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {isBn ? STATUS_LABELS[s].bn : STATUS_LABELS[s].en}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-[11px] uppercase tracking-wider mb-1.5 ${subtext}`}>
                {isBn ? "উত্তর / মন্তব্য (রিপোর্টার দেখতে পাবেন)" : "Reply / Note (visible to the reporter)"}
              </label>
              <textarea
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={isBn ? "সমাধানের ধরন বা পরামর্শ লিখুন..." : "What was done, or what the institution should do..."}
                className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none resize-none transition-colors ${inputCls}`}
              />
            </div>
          </div>
        )}
        <ModalFooter>
          <button
            onClick={() => setSelected(null)}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-zinc-300 hover:text-white" : "bg-zinc-100 text-zinc-700 hover:text-zinc-900"}`}
          >
            {isBn ? "বন্ধ" : "Close"}
          </button>
          <button
            onClick={() => handleStatus(selected?.status || "open")}
            disabled={updateReport.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {updateReport.isPending
              ? <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Send className="h-4 w-4" />}
            {isBn ? "উত্তর সংরক্ষণ" : "Save Reply"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function SupportSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-64 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-300"}`} />
          <div className={`h-4 w-96 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-300/80"}`} />
        </div>
        <div className={`${card} h-40 rounded-md mb-6`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className={`${card} h-[52px] rounded-md`} />)}
        </div>
        <div className={`${card} h-72 rounded-md`} />
      </div>
    </div>
  );
}
