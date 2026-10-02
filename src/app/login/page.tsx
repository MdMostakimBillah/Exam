"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { checkAccountLockout, loginWithLockout } from "@/lib/auth/server-auth";
import { useAuth } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { cn } from "@/lib/utils/helpers";
import { ArrowRight, Eye, EyeOff, Lock, AlertCircle, ShieldCheck, Sun, Moon } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { lang: language } = useLang();
  // The session is created by a Server Action, i.e. the cookies are written
  // on the server. The browser Supabase client has no way to notice that —
  // it only discovers a session on a full page load or a storage event, and
  // cookie writes fire neither. Without an explicit refresh the shared
  // AuthProvider still reports `user: null`, so /i bounces straight back to
  // /login (instantly) and /super-admin after 3s: credentials correct,
  // "sign-in does nothing". Hydrate the context BEFORE navigating.
  const { refresh } = useAuth();
  const { data: brandData } = useBranding();
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

  if (!mounted) return null;

  // ── Theme-aware surfaces ──────────────────────────────────────────────
  // BOTH sides follow the light/dark toggle: the brand panel is no longer a
  // hardcoded near-black slab — it gets a matching light treatment (soft
  // zinc wash + dark grid + dark text) while dark keeps the original look.
  const b = brandData ?? BRANDING_DEFAULTS;
  const brandName =
    (isBn ? b.brandNameBn : b.brandName) ||
    (isBn ? "বাংলাদেশ মাদ্রাসা এসোসিয়েশন" : "Bangladesh Madrasah Association");

  const panelBg = isDark ? "bg-[#0a0a0b] text-white" : "bg-zinc-50 text-zinc-900";
  const mainBg = isDark ? "bg-[#0a0a0b]" : "bg-white";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const badge = isDark
    ? "border-white/10 bg-white/5 text-zinc-400"
    : "border-zinc-200 bg-white text-zinc-500";
  const accentText = isDark
    ? "from-blue-400 via-sky-400 to-cyan-300"
    : "from-blue-600 via-sky-600 to-cyan-600";
  const inputBase =
    "w-full h-11 rounded-lg px-4 text-sm outline-none transition-all duration-200";
  const inputSkin = isDark
    ? "border border-white/[0.08] bg-white/[0.03] text-white placeholder:text-zinc-600 focus:border-white/25 focus:ring-2 focus:ring-white/10"
    : "border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100";

  // Render function (NOT a nested component — a fresh component type each
  // render would remount the logo <img> on every keystroke).
  const brandMark = (size = "h-10 w-10 text-base") =>
    b.brandLogo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={b.brandLogo}
        alt={brandName}
        className={cn(
          size,
          "shrink-0 rounded-full object-contain bg-white ring-1",
          isDark ? "ring-white/15" : "ring-zinc-200"
        )}
      />
    ) : (
      <div
        className={cn(
          size,
          "flex shrink-0 items-center justify-center rounded-full bg-brand-accent font-bold text-brand-accent-fg"
        )}
      >
        B
      </div>
    );

  return (
    <div className={cn("min-h-screen flex flex-col lg:flex-row", mainBg)}>
      {/* ── Left: brand panel ── */}
      <aside
        className={cn(
          "relative hidden lg:flex lg:w-[46%] shrink-0 flex-col justify-between overflow-hidden border-r p-10 xl:p-14",
          isDark ? "border-white/[0.06]" : "border-zinc-200",
          panelBg
        )}
      >
        {/* Soft wash — same hue on both themes, tuned opacity */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br via-transparent to-transparent",
            isDark ? "from-blue-600/12" : "from-blue-500/10"
          )}
        />
        {/* Quiet grid texture */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${isDark ? "rgba(255,255,255,0.05)" : "rgba(24,24,27,0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? "rgba(255,255,255,0.05)" : "rgba(24,24,27,0.05)"} 1px, transparent 1px)`,
            backgroundSize: "56px 56px",
          }}
        />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          {brandMark()}
          <span className="min-w-0 truncate text-sm font-semibold">{brandName}</span>
        </div>

        {/* Pitch — one badge, one headline, one line. No card grid. */}
        <div className="relative max-w-xl animate-fadeInUp">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em]",
              badge
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {isBn ? "পরীক্ষা সিস্টেম" : "Examination System"}
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-[1.14] tracking-tight xl:text-4xl">
            {isBn ? (
              <>
                একটি প্ল্যাটফর্মে <br className="hidden sm:block" />
                সম্পূর্ণ{" "}
                <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", accentText)}>
                  পরীক্ষা ব্যবস্থাপনা
                </span>
              </>
            ) : (
              <>
                Every step of the{" "}
                <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", accentText)}>
                  examination
                </span>
                , in one place.
              </>
            )}
          </h1>

          <p className={cn("mt-4 max-w-md text-sm leading-relaxed", muted)}>
            {isBn
              ? "নিবন্ধন থেকে প্রবেশপত্র, নম্বর, ফলাফল ও যাচাইযোগ্য সনদ — সবকিছু একই সংযুক্ত কার্যপ্রবাহে।"
              : "From enrolment and admit cards to marks, results and verifiable certificates — one connected workflow."}
          </p>
        </div>

        {/* Trust line */}
        <p
          className={cn(
            "relative flex items-center gap-2 text-[11px]",
            isDark ? "text-zinc-600" : "text-zinc-400"
          )}
        >
          <ShieldCheck
            className={cn("h-3.5 w-3.5 shrink-0", isDark ? "text-emerald-400/70" : "text-emerald-700")}
          />
          {isBn
            ? "ভূমিকাভিত্তিক প্রবেশ · লক করা প্রচেষ্টা · সব লগইন নিরীক্ষিত"
            : "Role-based access · lockout-protected · every sign-in audit-logged"}
        </p>
      </aside>

      {/* ── Right: sign-in ── */}
      <main
        className={cn("relative flex flex-1 items-center justify-center px-6 py-14", mainBg)}
      >
        {/* Theme toggle — flips BOTH sides at once */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isBn ? "থিম বদলান" : "Toggle theme"}
          title={isBn ? "থিম বদলান" : "Toggle theme"}
          className={cn(
            "absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
            isDark
              ? "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
          )}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="w-full max-w-[380px] animate-fadeInUp">
          {/* Compact brand — the panel is hidden below lg */}
          <div className="mb-9 flex flex-col items-center gap-2.5 lg:hidden">
            {brandMark("h-12 w-12 text-lg")}
            <span className="max-w-full truncate text-sm font-semibold">{brandName}</span>
          </div>

          <div className="mb-7">
            <h2
              className={cn(
                "text-2xl font-semibold tracking-tight",
                isDark ? "text-white" : "text-zinc-900"
              )}
            >
              {isBn ? "সাইন ইন" : "Sign in"}
            </h2>
            <p className="mt-1.5 text-[13px] text-zinc-500">
              {isBn
                ? "পরবর্তী ধাপে যেতে আপনার অ্যাকাউন্টে প্রবেশ করুন"
                : "Welcome back — enter your details to continue"}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className={cn("block text-[13px] mb-2 font-medium", muted)}
              >
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
                className={cn(inputBase, inputSkin, locked && "opacity-50 cursor-not-allowed")}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className={cn("block text-[13px] mb-2 font-medium", muted)}
              >
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
                    inputBase,
                    "pr-11",
                    inputSkin,
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={locked}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-fadeIn">
                <Lock className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-500">
                    {isBn ? "অ্যাকাউন্ট লক করা হয়েছে" : "Account Locked"}
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-500/70 mt-0.5">
                    {isBn ? `পুনরায় চেষ্টা করুন ${formatTime(retryAfter)} পর` : `Try again in ${formatTime(retryAfter)}`}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !locked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-fadeIn">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || locked}
              className={cn(
                "w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
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
                "inline-flex items-center gap-2 text-[13px] font-medium transition-colors",
                isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              &larr; {isBn ? "হোমে ফিরুন" : "Back to home"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
