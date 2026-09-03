"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, FileText, Award,
  CreditCard, BarChart3, Bell, Settings,
  ClipboardList, FileCheck, School, BookOpen,
  GraduationCap, LogOut, ChevronRight
} from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface NavItem {
  label: string;
  labelBn: string;
  icon: React.ElementType;
  href: string;
}

const superAdminNav: NavItem[] = [
  { label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: LayoutDashboard, href: '/super-admin' },
  { label: 'Institutions', labelBn: 'প্রতিষ্ঠান', icon: Building2, href: '/super-admin/institutions' },
  { label: 'Students', labelBn: 'শিক্ষার্থী', icon: Users, href: '/super-admin/students' },
  { label: 'Exams', labelBn: 'পরীক্ষা', icon: FileText, href: '/super-admin/exams' },
  { label: 'Registrations', labelBn: 'নিবন্ধন', icon: ClipboardList, href: '/super-admin/registrations' },
  { label: 'Exam Centers', labelBn: 'পরীক্ষা কেন্দ্র', icon: School, href: '/super-admin/exam-centers' },
  { label: 'Admit Cards', labelBn: 'প্রবেশপত্র', icon: FileCheck, href: '/super-admin/admit-cards' },
  { label: 'Marks', labelBn: 'নম্বর', icon: BookOpen, href: '/super-admin/marks' },
  { label: 'Results', labelBn: 'ফলাফল', icon: Award, href: '/super-admin/results' },
  { label: 'Certificates', labelBn: 'সার্টিফিকেট', icon: GraduationCap, href: '/super-admin/certificates' },
  { label: 'Payments', labelBn: 'পেমেন্ট', icon: CreditCard, href: '/super-admin/payments' },
  { label: 'Reports', labelBn: 'রিপোর্ট', icon: BarChart3, href: '/super-admin/reports' },
  { label: 'Notifications', labelBn: 'বিজ্ঞপ্তি', icon: Bell, href: '/super-admin/notifications' },
  { label: 'Settings', labelBn: 'সেটিংস', icon: Settings, href: '/super-admin/settings' },
];

const institutionNav: NavItem[] = [
  { label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: LayoutDashboard, href: '/i' },
  { label: 'Students', labelBn: 'শিক্ষার্থী', icon: Users, href: '/i/students' },
  { label: 'Exams', labelBn: 'পরীক্ষা', icon: FileText, href: '/i/exams' },
  { label: 'Registrations', labelBn: 'নিবন্ধন', icon: ClipboardList, href: '/i/registrations' },
  { label: 'Results', labelBn: 'ফলাফল', icon: Award, href: '/i/results' },
  { label: 'Certificates', labelBn: 'সার্টিফিকেট', icon: GraduationCap, href: '/i/certificates' },
  { label: 'Payments', labelBn: 'পেমেন্ট', icon: CreditCard, href: '/i/payments' },
  { label: 'Settings', labelBn: 'সেটিংস', icon: Settings, href: '/i/settings' },
];

function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getCurrentUser();
  const navItems = user?.role === 'SUPER_ADMIN' ? superAdminNav : institutionNav;
  const { theme } = useTheme();
  const { lang: language, t } = useLang();

  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 h-screen flex flex-col',
      'transition-all duration-200',
      collapsed ? 'w-[72px]' : 'w-[240px]'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b shrink-0',
        isDark ? 'bg-[#0D0D0D] border-white/[0.04]' : 'bg-white border-gray-200/50'
      )}>
        <div className={cn(
          'flex items-center',
          collapsed ? 'h-16 px-4 justify-center w-full' : 'h-16 px-5'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl font-bold text-[10px] transition-transform duration-300',
              isDark ? 'bg-white text-black' : 'bg-black text-white'
            )}>
              BMES
            </div>
            {!collapsed && (
              <div>
                <span className={cn(
                  'text-sm font-semibold tracking-tight',
                  isDark ? 'text-white' : 'text-gray-900'
                )}>BMES</span>
                <p className={cn(
                  'text-[10px]',
                  isDark ? 'text-zinc-500' : 'text-gray-500'
                )}>Management</p>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-4 px-3 space-y-1',
        isDark ? 'bg-[#0D0D0D]' : 'bg-white'
      )}>
        {navItems.map((item) => {
          const isActive = item.href === '/super-admin' || item.href === '/i'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? isDark
                    ? 'bg-white text-black font-medium'
                    : 'bg-black text-white font-medium'
                  : isDark
                    ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <span className="flex-1 text-left">{isBn ? item.labelBn : item.label}</span>
              )}
              {isActive && !collapsed && (
                <ChevronRight className={cn(
                  'h-3.5 w-3.5',
                  isDark ? 'text-black/50' : 'text-white/60'
                )} />
              )}
            </button>
          );
        })}
      </nav>

      {/* User & Logout */}
      {user && !collapsed && (
        <div className={cn(
          'border-t p-3 shrink-0',
          isDark ? 'bg-[#0D0D0D] border-white/[0.04]' : 'bg-white border-gray-200/50'
        )}>
          <div className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl',
            isDark ? 'bg-white/[0.04]' : 'bg-gray-50'
          )}>
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold',
              isDark ? 'bg-white text-black' : 'bg-black text-white'
            )}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium truncate',
                isDark ? 'text-white' : 'text-gray-900'
              )}>{user.name}</p>
              <p className={cn(
                'text-[10px] truncate',
                isDark ? 'text-zinc-500' : 'text-gray-500'
              )}>{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 mt-1 text-sm transition-all duration-200',
              isDark
                ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span>{isBn ? 'প্রস্থান' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </aside>
  );
}

export { Sidebar };
