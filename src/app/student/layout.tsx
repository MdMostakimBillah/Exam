"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clearStudentSession, type StudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { LogOut, LayoutDashboard, CreditCard, ChevronRight } from "lucide-react";

interface StudentLayoutProps {
  children: React.ReactNode;
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [student, setStudent] = useState<StudentSession | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("scholarx_student_session");
    if (!stored) {
      router.push("/student/login");
      return;
    }
    try {
      setStudent(JSON.parse(stored));
    } catch {
      router.push("/student/login");
    }
  }, [router]);

  const handleLogout = () => {
    clearStudentSession();
    router.push("/student/login");
  };

  if (!mounted || !student) return null;

  const navItems = [
    { label: isBn ? "ড্যাশবোর্ড" : "Dashboard", icon: LayoutDashboard, href: "/student/dashboard" },
    { label: isBn ? "পেমেন্ট" : "Payments", icon: CreditCard, href: "/student/payments" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      {/* Top Header */}
      <header className={cn(
        "sticky top-0 z-40 border-b",
        isDark ? "bg-[#0D0D0D]/80 backdrop-blur-xl border-white/[0.04]" : "bg-white/80 backdrop-blur-xl border-zinc-200"
      )}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/student/dashboard" className="flex items-center gap-2.5">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[10px]",
                isDark ? "bg-white text-black" : "bg-black text-white"
              )}>
                B
              </div>
              <span className={cn("text-sm font-semibold hidden sm:block", isDark ? "text-white" : "text-zinc-900")}>
                BMA Student
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className={`text-xs font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                {student.firstName} {student.lastName}
              </p>
              <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {student.studentId}
              </p>
            </div>
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold",
              isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-600"
            )}>
              {student.firstName.charAt(0)}{student.lastName.charAt(0)}
            </div>
            <button
              onClick={handleLogout}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
              )}
              title={isBn ? "প্রস্থান" : "Logout"}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className={cn("border-b", isDark ? "border-white/[0.04]" : "border-zinc-200")}>
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2",
                    active
                      ? isDark
                        ? "border-white text-white"
                        : "border-zinc-900 text-zinc-900"
                      : isDark
                        ? "border-transparent text-zinc-500 hover:text-zinc-300"
                        : "border-transparent text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
