"use client";
import Link from "next/link";
import { useState } from "react";
import {
  LifeBuoy, Phone, Mail, Clock, Send, LogIn, CheckCircle2,
  AlertTriangle, CircleDot, CheckCircle, PlusCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth";
import { useLang } from "@/contexts/language-context";
import { useToast } from "@/components/ui/toast";
import { useHelpdeskContact, useCreateSupportReport, useMySupportReports, SupportCategory } from "@/lib/storage/support";
import { useInstitutionById } from "@/lib/storage/institutions";
import { formatDate } from "@/lib/storage/storage";
import { SupportReport } from "@/lib/types";
import { PageEntrance } from "@/components/animation";

const CATEGORIES: { value: SupportCategory; en: string; bn: string }[] = [
  { value: "login", en: "Login / Account", bn: "লগইন / অ্যাকাউন্ট" },
  { value: "registration", en: "Student Registration", bn: "শিক্ষার্থী নিবন্ধন" },
  { value: "payment", en: "Payment", bn: "পেমেন্ট" },
  { value: "exam", en: "Exam / Marks", bn: "পরীক্ষা / নম্বর" },
  { value: "results", en: "Results", bn: "ফলাফল" },
  { value: "certificates", en: "Certificates / Admit Card", bn: "সার্টিফিকেট / প্রবেশপত্র" },
  { value: "other", en: "Other website problem", bn: "অন্যান্য ওয়েবসাইট সমস্যা" },
];

const STATUS_META = {
  open: { icon: CircleDot, cls: "bg-amber-500/10 text-amber-500 border-amber-500/20", en: "Open", bn: "খোলা" },
  in_progress: { icon: AlertTriangle, cls: "bg-blue-500/10 text-blue-500 border-blue-500/20", en: "In Progress", bn: "চলমান" },
  resolved: { icon: CheckCircle, cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", en: "Resolved", bn: "সমাধান হয়েছে" },
} as const;

function StatusPill({ status, isBn }: { status: SupportReport["status"]; isBn: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.open;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {isBn ? meta.bn : meta.en}
    </span>
  );
}

export default function HelpPage() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const { toast } = useToast();
  const { user, loading } = useAuth();

  const { data: contact } = useHelpdeskContact();
  const createReport = useCreateSupportReport();
  const { data: myReports = [] } = useMySupportReports(user?.id ?? "");
  const { data: institution } = useInstitutionById(user?.institutionId ?? "");

  const [form, setForm] = useState({
    reporterName: "",
    reporterEmail: "",
    reporterPhone: "",
    category: "other" as SupportCategory,
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  // Seed the reporter fields from the signed-in profile once.
  const seededFor = user?.id ?? "";
  const [seededForId, setSeededForId] = useState("");
  if (user && seededForId !== seededFor) {
    setSeededForId(seededFor);
    setForm((f) => ({
      ...f,
      reporterName: f.reporterName || user.name || "",
      reporterEmail: f.reporterEmail || user.email || "",
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.reporterName.trim() || !form.subject.trim() || !form.message.trim()) {
      toast("error", isBn ? "নাম, বিষয় ও সমস্যার বিবরণ প্রয়োজন" : "Name, subject and problem description are required");
      return;
    }
    try {
      await createReport.mutateAsync({
        userId: user.id,
        institutionId: user.institutionId,
        institutionName: institution?.name,
        reporterName: form.reporterName.trim(),
        reporterEmail: form.reporterEmail.trim() || undefined,
        reporterPhone: form.reporterPhone.trim() || undefined,
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
      setForm((f) => ({ ...f, category: "other", subject: "", message: "" }));
      toast("success", isBn ? "আপনার সমস্যা জমা হয়েছে" : "Your problem has been reported");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : (isBn ? "পাঠানো যায়নি" : "Could not submit the report"));
    }
  };

  const hotline = contact?.phone?.trim();
  const supportEmail = contact?.email?.trim();
  const hours = contact?.hours?.trim();

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-accent text-brand-accent-fg font-bold text-sm">S</div>
            <span className="text-sm font-semibold text-zinc-100">ScholarX</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">About</Link>
            <Link href="/features" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Contact</Link>
            <Link href="/help" className="text-sm text-zinc-300">Help</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/register" className="text-sm bg-brand-accent text-brand-accent-fg hover:opacity-90 px-4 py-1.5 rounded-md font-medium transition-colors">Register</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <PageEntrance>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-accent-soft text-brand-accent">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <span className="text-xs uppercase tracking-wider text-zinc-600">Help &amp; Support</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            {isBn ? "ওয়েবসাইটের সমস্যা জানান" : "Report a Website Problem"}
          </h1>
          <p className="text-lg text-zinc-500 mb-12 max-w-2xl">
            {isBn
              ? "প্ল্যাটফর্ম ব্যবহারে কোনো সমস্যা হলে এখানে জানান। নিচের নম্বরে সরাসরি যোগাযোগ করতে পারেন।"
              : "Facing a functional problem on the platform? Report it here, or contact us directly on the number below."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* ── Contact details (number set by the super admin) ── */}
            <div className="space-y-4">
              <div className="rounded-md border border-white/[0.06] bg-[#111111] p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-600 mb-4">
                  {isBn ? "সাপোর্টে যোগাযোগ" : "Contact Support"}
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-zinc-800/50 p-2"><Phone className="h-4 w-4 text-zinc-400" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-600 mb-0.5">{isBn ? "হটলাইন নম্বর" : "Helpline Number"}</p>
                      {hotline ? (
                        <a href={`tel:${hotline.replace(/\s+/g, "")}`} className="text-sm text-zinc-100 hover:text-brand-accent transition-colors break-all">
                          {hotline}
                        </a>
                      ) : (
                        <p className="text-sm text-zinc-600">{isBn ? "শীঘ্রই যোগ করা হবে" : "Coming soon"}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-zinc-800/50 p-2"><Mail className="h-4 w-4 text-zinc-400" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-600 mb-0.5">{isBn ? "ইমেইল" : "Email"}</p>
                      <p className="text-sm text-zinc-300 break-all">{supportEmail || "support@scholarx.com"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-zinc-800/50 p-2"><Clock className="h-4 w-4 text-zinc-400" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-600 mb-0.5">{isBn ? "সেবার সময়" : "Available"}</p>
                      <p className="text-sm text-zinc-300 break-words">{hours || (isBn ? "রবি–বৃহস্পতি, সকাল ৯টা – সন্ধ্যা ৬টা" : "Sun – Thu, 9:00 AM – 6:00 PM")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reporter's own reports — status the super admin set */}
              {user && myReports.length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-[#111111] p-5">
                  <p className="text-xs uppercase tracking-wider text-zinc-600 mb-4">
                    {isBn ? "আমার আগের অভিযোগ" : "My Previous Reports"}
                  </p>
                  <div className="space-y-3">
                    {myReports.slice(0, 5).map((r) => (
                      <div key={r.id} className="border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-zinc-300 break-words">{r.subject}</p>
                          <StatusPill status={r.status} isBn={isBn} />
                        </div>
                        <p className="text-[11px] text-zinc-600 mt-1">{formatDate(r.createdAt)}</p>
                        {r.adminNote && (
                          <p className="text-[11px] text-zinc-500 mt-1.5 rounded-md bg-white/[0.04] p-2 break-words">
                            💬 {r.adminNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Report form ── */}
            <div className="md:col-span-2">
              {!loading && !user ? (
                <div className="rounded-md border border-white/[0.06] bg-[#111111] p-8 text-center">
                  <div className="rounded-full bg-zinc-800/60 p-3 w-fit mx-auto mb-4">
                    <LogIn className="h-6 w-6 text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    {isBn ? "সমস্যা জানাতে সাইন ইন করুন" : "Sign in to report a problem"}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
                    {isBn
                      ? "আপনার প্রতিষ্ঠান ও অভিযোগের অবস্থা যাচাই করতে সাইন ইন প্রয়োজন।"
                      : "We need your account so we can track the report against your institution."}
                  </p>
                  <Link href="/login" className="inline-flex items-center gap-2 bg-brand-accent text-brand-accent-fg hover:opacity-90 px-5 py-2.5 rounded-md text-sm font-medium transition-colors">
                    <LogIn className="h-4 w-4" /> {isBn ? "সাইন ইন" : "Sign in"}
                  </Link>
                </div>
              ) : submitted ? (
                <div className="rounded-md border border-white/[0.06] bg-[#111111] p-8 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-3 w-fit mx-auto mb-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    {isBn ? "অভিযোগ জমা হয়েছে" : "Problem Reported"}
                  </h3>
                  <p className="text-sm text-zinc-500 mb-6">
                    {isBn
                      ? "সাপোর্ট টিম দ্রুত যাচাই করবে। অবস্থা ও উত্তর ডান পাশের তালিকায় দেখুন।"
                      : "Our support team will review it shortly. You can track the status and reply in the list beside."}
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="inline-flex items-center gap-2 border border-white/10 text-zinc-300 hover:bg-white/5 px-5 py-2.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {isBn ? "আরেকটি সমস্যা জানান" : "Report another problem"}
                  </button>
                </div>
              ) : loading ? (
                <div className="rounded-md border border-white/[0.06] bg-[#111111] h-[420px] animate-pulse" />
              ) : (
                <form onSubmit={handleSubmit} className="rounded-md border border-white/[0.06] bg-[#111111] p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{isBn ? "আপনার নাম" : "Your Name"} *</label>
                      <input
                        value={form.reporterName}
                        onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                        required
                        className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500"
                        placeholder={isBn ? "নাম লিখুন" : "Your name"}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{isBn ? "ইমেইল" : "Email"}</label>
                      <input
                        type="email"
                        value={form.reporterEmail}
                        onChange={(e) => setForm({ ...form, reporterEmail: e.target.value })}
                        className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{isBn ? "ফোন (ঐচ্ছিক)" : "Phone (optional)"}</label>
                      <input
                        value={form.reporterPhone}
                        onChange={(e) => setForm({ ...form, reporterPhone: e.target.value })}
                        className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500"
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{isBn ? "সমস্যার ধরন" : "Problem Type"}</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as SupportCategory })}
                        className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value} className="bg-[#0D0D0D] text-zinc-100">
                            {isBn ? c.bn : c.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">{isBn ? "বিষয়" : "Subject"} *</label>
                    <input
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      required
                      className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500"
                      placeholder={isBn ? "সমস্যাটির সংক্ষিপ্ত বিষয়" : "Short summary of the problem"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">{isBn ? "সমস্যার বিস্তারিত" : "Problem Description"} *</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      required
                      rows={6}
                      className="w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
                      placeholder={isBn ? "কোন পেজে, কী করার সময় সমস্যা হলো লিখুন..." : "Which page and what were you trying to do when it failed..."}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createReport.isPending}
                    className="inline-flex items-center gap-2 bg-brand-accent text-brand-accent-fg hover:opacity-90 px-5 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {createReport.isPending ? (
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isBn ? "সমস্যা জানান" : "Submit Problem"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        </PageEntrance>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-accent text-brand-accent-fg font-bold text-xs">S</div>
            <span className="text-sm font-semibold text-zinc-300">ScholarX</span>
          </div>
          <p className="text-xs text-zinc-700">© 2026 ScholarX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
