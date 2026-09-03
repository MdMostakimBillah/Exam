"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { login } from "@/lib/auth/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLang();
  const isDark = theme === "dark";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { initializeDemoData(); }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = login(email);
      if (user) {
        if (user.role === 'SUPER_ADMIN') router.push('/super-admin');
        else if (user.role === 'INSTITUTION_ADMIN') router.push('/i');
        else router.push('/i');
      } else {
        setError("Invalid email address");
      }
      setLoading(false);
    }, 500);
  };

  const quickLogin = (email: string) => {
    setEmail(email);
  };

  const bg = isDark ? "bg-[#080808]" : "bg-gray-50";
  const text = isDark ? "text-zinc-100" : "text-gray-900";
  const textSec = isDark ? "text-zinc-500" : "text-gray-500";
  const card = isDark ? "bg-[#0D0D0D]/80 border-white/[0.04] backdrop-blur-sm" : "bg-white border-gray-200/50";

  return (
    <div className={`min-h-screen flex items-center justify-center px-6 ${bg} relative overflow-hidden`}>
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fadeInUp">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold text-lg transition-transform duration-300 group-hover:scale-105 ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>B</div>
          </Link>
          <h1 className={`text-2xl font-semibold ${text}`}>{t("login.welcomeBack")}</h1>
          <p className={`text-sm mt-2 ${textSec}`}>{t("login.signInDesc")}</p>
        </div>

        <div className={`rounded-2xl border p-6 ${card} shadow-xl shadow-black/20`}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs text-zinc-500 mb-2 font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-2 font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                defaultValue="demo123"
              />
            </div>
            {error && <p className="text-xs text-red-400 animate-fadeIn">{error}</p>}
            <Button type="submit" className="w-full" isLoading={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-600 text-center mb-4">{t("login.quickLogin")}</p>
            <div className="space-y-2">
              {[
                { label: t("login.superAdmin"), email: 'admin@scholarx.local' },
                { label: t("login.instAdmin"), email: 'institution@scholarx.local' },
                { label: t("login.student"), email: 'student@scholarx.local' },
              ].map(acc => (
                <button
                  key={acc.email}
                  onClick={() => quickLogin(acc.email)}
                  className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-200 group"
                >
                  <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{acc.label}</span>
                  <span className="text-zinc-600 font-mono text-[10px]">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8 animate-fadeIn">
          <Link href="/" className="hover:text-zinc-400 transition-colors">&larr; {t("login.backToHome")}</Link>
        </p>
      </div>
    </div>
  );
}
