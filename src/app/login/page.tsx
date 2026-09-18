"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginWithLockout } from "@/lib/auth/server-auth";
import { useAuth } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ArrowRight, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
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
      const result = await loginWithLockout(email, password);

      if (result.locked) {
        setLocked(true);
        setRetryAfter(result.retryAfter || 300);
        setError(isBn
          ? `অ্যাকাউন্ট লক করা হয়েছে। ${formatTime(result.retryAfter || 300)} অপেক্ষা করুন।`
          : `Account locked. Wait ${formatTime(result.retryAfter || 300)}.`
        );
      } else if (result.success && result.user) {
        // Auth provider's onAuthStateChange will automatically pick up the session
        if (result.user.role === "SUPER_ADMIN") router.push("/super-admin");
        else router.push("/i");
      } else {
        setError(isBn ? "ভুল ইমেইল বা পাসওয়ার্ড" : result.error || "Invalid email or password");
      }
    } catch {
      setError(isBn ? "সংযোগে সমস্যা" : "Connection error");
    }

    setLoading(false);
  };

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
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className="max-w-md text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/[0.06] border border-white/[0.08] mb-8 animate-scaleIn backdrop-blur-sm">
              <span className="text-3xl font-bold text-white">B</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
              {isBn ? "বাংলাদেশ মাদ্রাসা এসোসিয়েশন" : "Bangladesh Madrasah Association"}
            </h1>
            <p className="text-lg text-zinc-400 mb-12 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
              {isBn ? "স্কলারশিপ পরীক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম" : "Scholarship Examination Management Platform"}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className={`flex-1 flex items-center justify-center px-6 ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} relative`}>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/3 blur-[120px] rounded-full" />

        <div className="w-full max-w-[400px] relative z-10">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-md bg-white text-black font-bold text-xl mb-4">B</div>
          </div>

          <div className="animate-fadeInUp">
            <h2 className={`text-2xl font-bold tracking-tight mb-8 ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "সাইন ইন" : "Sign in"}
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "ইমেইল" : "Email"}
                </label>
                <input
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
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "পাসওয়ার্ড" : "Password"}
                </label>
                <div className="relative">
                  <input
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
                  isDark
                    ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]",
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
              <p className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                {isBn ? "প্রথমবার লগইন? আপনার প্রতিষ্ঠানের অ্যাডমিনের সাথে যোগাযোগ করুন" : "First time login? Contact your institution admin"}
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link href="/student/login" className={cn("text-xs font-medium transition-colors", isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600")}>
                {isBn ? "শিক্ষার্থী পোর্টাল" : "Student Portal"} &rarr;
              </Link>
            </div>

            <p className={`text-center text-xs mt-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              <Link href="/" className={cn("hover:underline transition-colors", isDark ? "hover:text-zinc-400" : "hover:text-zinc-600")}>
                &larr; {isBn ? "হোমে ফিরুন" : "Back to home"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
