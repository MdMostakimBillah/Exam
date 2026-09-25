"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { checkAccountLockout, loginWithLockout } from "@/lib/auth/server-auth";
import { useAuth } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import {
  ArrowRight, Eye, EyeOff, Lock, AlertCircle, ShieldCheck,
  UserPlus, ClipboardList, FileText, BookOpen, Award, BarChart3,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  // The session is created by a Server Action, i.e. the cookies are written
  // on the server. The browser Supabase client has no way to notice that —
  // it only discovers a session on a full page load or a storage event, and
  // cookie writes fire neither. Without an explicit refresh the shared
  // AuthProvider still reports `user: null`, so /i bounces straight back to
  // /login (instantly) and /super-admin after 3s: credentials correct,
  // "sign-in does nothing". Hydrate the context BEFORE navigating.
  const { refresh } = useAuth();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev <= 1) {
          setLocked(false);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter > 0]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setLoading(true);
    setError("");

    try {
      const lockoutResult = await checkAccountLockout(email);

      if (lockoutResult.locked) {
        setLocked(true);
        setRetryAfter(lockoutResult.retryAfter || 300);
        setError(isBn
          ? `অ্যাকাউন্ট লক করা হয়েছে। ${formatTime(lockoutResult.retryAfter || 300)} অপেক্ষা করুন।`
          : `Account locked. Wait ${formatTime(lockoutResult.retryAfter || 300)}.`
        );
        setLoading(false);
        return;
      }

      // loginWithLockout (server action) records every attempt in
      // login_attempts, which is what actually arms the 3-strikes lockout.
      // The old client-side login() never wrote to that table, so
      // checkAccountLockout() always read an empty table — brute force was
      // unlimited. See audit C2.
      const result = await loginWithLockout(email, password);

      if (result.success && result.user) {
        // Hydrate the shared auth context first — see the useAuth() note above.
        const sessionUser = await refresh();
        const target = result.user.role === "SUPER_ADMIN" ? "/super-admin" : "/i";
        if (sessionUser) {
          router.push(target);
        } else {
          // refresh() re-read the cookie this action just wrote and still saw
          // nothing (cookies blocked or overridden in this browser). A full
          // load re-initialises everything from the cookie and lets middleware
          // decide, instead of looping silently back to this screen.
          window.location.assign(target);
        }
      } else if (result.locked) {
        setLocked(true);
        setRetryAfter(result.retryAfter || 300);
        setError(isBn
          ? `অ্যাকাউন্ট লক করা হয়েছে। ${formatTime(result.retryAfter || 300)} অপেক্ষা করুন।`
          : `Account locked. Wait ${formatTime(result.retryAfter || 300)}.`);
      } else {
        setError(isBn ? "ভুল ইমেইল বা পাসওয়ার্ড" : "Invalid email or password");
      }
    } catch {
      setError(isBn ? "সংযোগে সমস্যা" : "Connection error");
    }

    setLoading(false);
  };

  // Left panel — the "Examination System" pitch. Static copy, kept out of the
  // JSX so the panel markup stays readable. Tints are fixed palette colours
  // (not --brand-accent) because this surface is always dark, whatever accent
  // the tenant has saved.
  const examFeatures = [
    {
      icon: UserPlus,
      title: isBn ? "ছাত্র নিবন্ধন" : "Student Registration",
      desc: isBn ? "বাল্ক এনরোলমেন্ট, ইমপোর্ট ও যাচাই" : "Bulk enrolment, import & validation",
      tint: "bg-blue-500/10 text-blue-300",
    },
    {
      icon: ClipboardList,
      title: isBn ? "প্রবেশপত্র" : "Admit Cards",
      desc: isBn ? "QR সহ প্রিন্ট-রেডি কার্ড" : "QR-enabled cards, ready to print",
      tint: "bg-sky-500/10 text-sky-300",
    },
    {
      icon: FileText,
      title: isBn ? "পরীক্ষা ব্যবস্থাপনা" : "Examinations",
      desc: isBn ? "বিষয়, রুটিন ও গ্রেডিং" : "Subjects, routine & grading",
      tint: "bg-indigo-500/10 text-indigo-300",
    },
    {
      icon: BookOpen,
      title: isBn ? "নম্বর ও ফলাফল" : "Marks & Results",
      desc: isBn ? "এন্ট্রি থেকে প্রকাশিত ফলাফল" : "Mark entry through to published results",
      tint: "bg-violet-500/10 text-violet-300",
    },
    {
      icon: Award,
      title: isBn ? "সনদ ও যাচাই" : "Certificates",
      desc: isBn ? "অনলাইনে তাৎক্ষণিক যাচাই" : "Issue once, verify instantly online",
      tint: "bg-emerald-500/10 text-emerald-300",
    },
    {
      icon: BarChart3,
      title: isBn ? "রিপোর্ট ও বিশ্লেষণ" : "Reports & Analytics",
      desc: isBn ? "লাইভ ড্যাশবোর্ড ও এক্সপোর্ট" : "Live dashboards and exports",
      tint: "bg-amber-500/10 text-amber-300",
    },
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0a0a0b]">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent" />
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px] animate-float" />
          <div className="absolute top-1/2 -left-16 w-[400px] h-[400px] rounded-full bg-purple-500/8 blur-[100px] animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-500/6 blur-[100px] animate-float" style={{ animationDelay: "4s" }} />
        </div>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
        <div className="absolute top-[15%] left-[20%] w-3 h-3 rounded-full bg-blue-400/30 animate-float" />
        <div className="absolute top-[35%] left-[60%] w-2 h-2 rounded-full bg-purple-400/30 animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute top-[60%] left-[30%] w-4 h-4 rounded-full bg-indigo-400/20 animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-[80%] left-[70%] w-2 h-2 rounded-full bg-blue-300/25 animate-float" style={{ animationDelay: "3s" }} />
        <div className="absolute top-[25%] left-[80%] w-3 h-3 rounded-full bg-violet-400/20 animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
          <div className="absolute inset-0 rounded-full border border-white/[0.03] animate-spin-slow" />
          <div className="absolute inset-8 rounded-full border border-white/[0.04] animate-spin-slow" style={{ animationDirection: "reverse", animationDuration: "30s" }} />
          <div className="absolute inset-16 rounded-full border border-white/[0.03] animate-spin-slow" style={{ animationDuration: "25s" }} />
        </div>
        {/* Scroll guard: if a short viewport can't fit the pitch, the panel
            scrolls instead of clipping (auto margins collapse to 0 when the
            content overflows, so nothing is lost off the top). */}
        <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto p-8 sm:p-10 xl:p-14">
          <div className="mx-auto my-auto flex w-full max-w-2xl flex-col gap-6">
            {/* Headline */}
            <div className="max-w-xl animate-fadeInUp" style={{ animationDelay: "0.08s" }}>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {isBn ? "পরীক্ষা সিস্টেম" : "Examination System"}
              </span>

              <h1 className="mt-5 text-3xl font-bold leading-[1.14] tracking-tight text-white xl:text-4xl">
                {isBn ? (
                  <>
                    একটি প্ল্যাটফর্মে <br className="hidden sm:block" />
                    সম্পূর্ণ <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">পরীক্ষা ব্যবস্থাপনা</span>
                  </>
                ) : (
                  <>
                    Every step of the{" "}
                    <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent">
                      examination
                    </span>
                    , in one place.
                  </>
                )}
              </h1>

              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                {isBn
                  ? "নিবন্ধন থেকে প্রবেশপত্র, নম্বর, ফলাফল ও যাচাইযোগ্য সনদ — সবকিছু একই সংযুক্ত কার্যপ্রবাহে।"
                  : "From enrolment and admit cards to marks, results and verifiable certificates — one connected workflow."}
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-3">
              {examFeatures.map((f, i) => (
                <div
                  key={f.title}
                  className="group flex items-start gap-3 rounded-md border border-white/[0.07] bg-white/[0.04] p-3.5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.07] animate-fadeInUp"
                  style={{ animationDelay: `${0.16 + i * 0.06}s` }}
                >
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-transform duration-300 group-hover:scale-110", f.tint)}>
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-tight text-white">{f.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust line */}
            <p className="flex items-center gap-2 text-[11px] text-zinc-600 animate-fadeInUp" style={{ animationDelay: "0.56s" }}>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
              {isBn
                ? "ভূমিকাভিত্তিক প্রবেশ · লক করা প্রচেষ্টা · সব লগইন নিরীক্ষিত"
                : "Role-based access · lockout-protected · every sign-in audit-logged"}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className={`flex-1 flex items-center justify-center px-6 ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} relative`}>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/3 blur-[120px] rounded-full" />

        <div className="w-full max-w-[400px] relative z-10">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-md bg-brand-accent text-brand-accent-fg font-bold text-xl mb-4">B</div>
          </div>

          <div className="animate-fadeInUp">
            <h2 className={`text-2xl font-bold tracking-tight mb-8 ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "সাইন ইন" : "Sign in"}
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "ইমেইল" : "Email"}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isBn ? "আপনার ইমেইল লিখুন" : "you@example.com"}
                  required
                  disabled={locked}
                  className={cn(
                    "w-full h-11 px-4 rounded-md text-sm transition-all duration-200 outline-none",
                    isDark
                      ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                      : "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>

              <div>
                <label htmlFor="login-password" className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "পাসওয়ার্ড" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isBn ? "আপনার পাসওয়ার্ড লিখুন" : "Enter your password"}
                    required
                    disabled={locked}
                    className={cn(
                      "w-full h-11 px-4 pr-11 rounded-md text-sm transition-all duration-200 outline-none",
                      isDark
                        ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                        : "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={locked}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors",
                      isDark ? "text-zinc-600 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Lockout Warning */}
              {locked && retryAfter > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-md bg-amber-500/10 border border-amber-500/20 animate-fadeIn">
                  <Lock className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-400">
                      {isBn ? "অ্যাকাউন্ট লক করা হয়েছে" : "Account Locked"}
                    </p>
                    <p className="text-[11px] text-amber-400/70 mt-0.5">
                      {isBn ? `পুনরায় চেষ্টা করুন ${formatTime(retryAfter)} পর` : `Try again in ${formatTime(retryAfter)}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && !locked && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 animate-fadeIn">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || locked}
                className={cn(
                  "w-full h-11 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                  "bg-brand-accent text-brand-accent-fg hover:opacity-90 active:scale-[0.98]",
                  (loading || locked) && "opacity-60 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : locked ? (
                  <>
                    <Lock className="h-4 w-4" />
                    {formatTime(retryAfter)}
                  </>
                ) : (
                  <>
                    {isBn ? "সাইন ইন" : "Sign in"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link
                href="/"
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium transition-colors",
                  isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                &larr; {isBn ? "হোমে ফিরুন" : "Back to home"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
