"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { login } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initializeDemoData();
    setMounted(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = login(email, password);
      if (user) {
        if (user.role === 'SUPER_ADMIN') router.push('/super-admin');
        else router.push('/i');
      } else {
        setError(isBn ? "ভুল ইমেইল বা পাসওয়ার্ড" : "Invalid email or password");
      }
      setLoading(false);
    }, 600);
  };

  const quickLogin = (email: string) => {
    setEmail(email);
    setPassword('admin123');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex">
      {/* Left Side — Animated Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0a0a0b]">
        {/* Animated gradient mesh */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-transparent" />
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px] animate-float" />
          <div className="absolute top-1/2 -left-16 w-[400px] h-[400px] rounded-full bg-purple-500/8 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-500/6 blur-[100px] animate-float" style={{ animationDelay: '4s' }} />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Floating orbs */}
        <div className="absolute top-[15%] left-[20%] w-3 h-3 rounded-full bg-blue-400/30 animate-float" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[35%] left-[60%] w-2 h-2 rounded-full bg-purple-400/30 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[60%] left-[30%] w-4 h-4 rounded-full bg-indigo-400/20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[80%] left-[70%] w-2 h-2 rounded-full bg-blue-300/25 animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[25%] left-[80%] w-3 h-3 rounded-full bg-violet-400/20 animate-float" style={{ animationDelay: '1.5s' }} />

        {/* Rotating rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]">
          <div className="absolute inset-0 rounded-full border border-white/[0.03] animate-spin-slow" />
          <div className="absolute inset-8 rounded-full border border-white/[0.04] animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '30s' }} />
          <div className="absolute inset-16 rounded-full border border-white/[0.03] animate-spin-slow" style={{ animationDuration: '25s' }} />
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className="max-w-md text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/[0.06] border border-white/[0.08] mb-8 animate-scaleIn backdrop-blur-sm">
              <span className="text-3xl font-bold text-white">B</span>
            </div>

            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              {isBn ? 'বাংলাদেশ মাদ্রাসা এসোসিয়েশন' : 'Bangladesh Education Society'}
            </h1>
            <p className="text-lg text-zinc-400 mb-12 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              {isBn ? 'স্কলারশিপ পরীক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম' : 'Scholarship Examination Management Platform'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className={`flex-1 flex items-center justify-center px-6 ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} relative`}>
        {/* Subtle ambient glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/3 blur-[120px] rounded-full" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-md bg-white text-black font-bold text-xl mb-4">B</div>
          </div>

          <div className="animate-fadeInUp">
            <h2 className={`text-2xl font-bold tracking-tight mb-8 ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? 'সাইন ইন' : 'Sign in'}
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? 'ইমেইল' : 'Email'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isBn ? 'আপনার ইমেইল লিখুন' : 'you@example.com'}
                  required
                  className={cn(
                    "w-full h-11 px-4 rounded-md text-sm transition-all duration-200 outline-none",
                    isDark
                      ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                      : "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                  )}
                />
              </div>

              <div>
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? 'পাসওয়ার্ড' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isBn ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter your password'}
                    required
                    className={cn(
                      "w-full h-11 px-4 pr-11 rounded-md text-sm transition-all duration-200 outline-none",
                      isDark
                        ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                        : "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors",
                      isDark ? "text-zinc-600 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                    )}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 animate-fadeIn">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-11 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                  isDark
                    ? "bg-white text-black hover:bg-white/90 active:scale-[0.98]"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]",
                  loading && "opacity-60 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isBn ? 'সাইন ইন' : 'Sign in'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick login */}
            <div className="mt-8">
              <div className="relative">
                <div className={`absolute inset-0 flex items-center ${isDark ? "text-zinc-700" : "text-zinc-300"}`}>
                  <div className="w-full border-t border-current" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className={`px-3 ${isDark ? "bg-[#0a0a0b] text-zinc-600" : "bg-zinc-50 text-zinc-400"}`}>
                    {isBn ? 'অথবা দ্রুত প্রবেশ' : 'Quick access'}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => quickLogin('admin@scholarx.local')}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-md border transition-all duration-200 group",
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
                      : "border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-md bg-gradient-to-br from-blue-500/10 to-blue-600/5 flex items-center justify-center")}>
                      <span className="text-xs font-bold">S</span>
                    </div>
                    <span className={cn("text-sm font-medium", isDark ? "text-zinc-300 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-900")}>
                      {isBn ? 'সুপার অ্যাডমিন' : 'Super Admin'}
                    </span>
                  </div>
                  <ArrowRight className={cn("h-3.5 w-3.5 transition-all duration-200 group-hover:translate-x-0.5", isDark ? "text-zinc-600 group-hover:text-zinc-400" : "text-zinc-400 group-hover:text-zinc-600")} />
                </button>
              </div>
            </div>

            <p className={`text-center text-xs mt-8 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              <Link href="/" className={cn("hover:underline transition-colors", isDark ? "hover:text-zinc-400" : "hover:text-zinc-600")}>
                &larr; {isBn ? 'হোমে ফিরুন' : 'Back to home'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
