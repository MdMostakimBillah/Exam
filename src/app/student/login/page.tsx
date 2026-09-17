"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginStudent, setStudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { ArrowRight, Eye, EyeOff, Lock, AlertCircle, User } from "lucide-react";

export default function StudentLoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [studentId, setStudentId] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const result = await loginStudent(studentId, phoneOrEmail);

      if (result.locked) {
        setLocked(true);
        setRetryAfter(result.retryAfter || 300);
        setError(
          isBn
            ? `অ্যাকাউন্ট লক করা হয়েছে। ${formatTime(result.retryAfter || 300)} অপেক্ষা করুন।`
            : `Account locked. Wait ${formatTime(result.retryAfter || 300)}.`
        );
      } else if (result.success && result.student) {
        setStudentSession(result.student);
        router.push("/student/dashboard");
      } else {
        setError(isBn ? "ভুল শিক্ষার্থী আইডি বা তথ্য" : "Invalid student ID or credentials");
      }
    } catch {
      setError(isBn ? "সংযোগে সমস্যা" : "Connection error");
    }

    setLoading(false);
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"} relative`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 px-4">
        <div className="animate-fadeInUp">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-xl bg-white text-black font-bold text-2xl mb-4 shadow-lg">
              B
            </div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "শিক্ষার্থী পোর্টাল" : "Student Portal"}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? "বাংলাদেশ মাদ্রাসা এসোসিয়েশন" : "Bangladesh Madrasah Association"}
            </p>
          </div>

          {/* Login Card */}
          <div className={cn(
            "rounded-xl p-6 shadow-xl",
            isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200"
          )}>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "শিক্ষার্থী আইডি" : "Student ID"}
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder={isBn ? "যেমন: STU-2024-0001" : "e.g., STU-2024-0001"}
                    required
                    disabled={locked}
                    className={cn(
                      "w-full h-11 pl-10 pr-4 rounded-lg text-sm transition-all duration-200 outline-none",
                      isDark
                        ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                        : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[13px] mb-2 font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "ফোন নম্বর বা ইমেইল" : "Phone or Email"}
                </label>
                <input
                  type="text"
                  value={phoneOrEmail}
                  onChange={(e) => setPhoneOrEmail(e.target.value)}
                  placeholder={isBn ? "নিবন্ধিত ফোন বা ইমেইল" : "Registered phone or email"}
                  required
                  disabled={locked}
                  className={cn(
                    "w-full h-11 px-4 rounded-lg text-sm transition-all duration-200 outline-none",
                    isDark
                      ? "bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-2 focus:ring-white/5"
                      : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100",
                    locked && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>

              {/* Lockout Warning */}
              {locked && retryAfter > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-fadeIn">
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
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-fadeIn">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || locked}
                className={cn(
                  "w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
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
          </div>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            <p className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
              {isBn ? "প্রশাসনিক লগইন?" : "Admin login?"}{" "}
              <Link href="/login" className={cn("font-medium transition-colors", isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900")}>
                {isBn ? "এখানে ক্লিক করুন" : "Click here"}
              </Link>
            </p>
            <Link href="/" className={cn("text-xs transition-colors inline-block", isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600")}>
              &larr; {isBn ? "হোমে ফিরুন" : "Back to home"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
