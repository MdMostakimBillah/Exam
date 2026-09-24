"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, FileText, Award,
  CreditCard, BarChart3, Bell, Settings,
  ClipboardList, FileCheck, School, BookOpen,
  CalendarDays, GraduationCap, LogOut, ChevronRight, BookMarked, Hash
} from "lucide-react";
import { useAuth, logout } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { useInstitutionBySlug } from "@/lib/storage/institutions";

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
  { label: 'Classes', labelBn: 'শ্রেণী', icon: BookMarked, href: '/super-admin/classes' },
  { label: 'Exams', labelBn: 'পরীক্ষা', icon: FileText, href: '/super-admin/exams' },
  { label: 'Routine', labelBn: 'রুটিন', icon: CalendarDays, href: '/super-admin/routine' },
  { label: 'Registrations', labelBn: 'নিবন্ধন', icon: ClipboardList, href: '/super-admin/registrations' },
  { label: 'Roll Numbers', labelBn: 'রোল নম্বর', icon: Hash, href: '/super-admin/roll-numbers' },
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

const Sidebar = React.memo(function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const { user } = useAuth();

  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  // Association branding (super-admin editable in Settings → Branding)
  const { data: brandData } = useBranding();
  const brand = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (isBn ? brand.brandNameBn : brand.brandName) || brand.brandName;

  const slug = React.useMemo(() => {
    const match = pathname.match(/^\/i\/([^/]+)/);
    return match ? match[1] : '';
  }, [pathname]);

  // Institution logo for the bottom user block (institution pages only;
  // super-admin has no institution → keeps the initials circle).
  const { data: inst } = useInstitutionBySlug(slug);

  const institutionNav: NavItem[] = React.useMemo(() => [
    { label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: LayoutDashboard, href: `/i/${slug}` },
    { label: 'Registrations', labelBn: 'নিবন্ধন', icon: ClipboardList, href: `/i/${slug}/registrations` },
    { label: 'Students', labelBn: 'শিক্ষার্থী', icon: Users, href: `/i/${slug}/students` },
    { label: 'Results', labelBn: 'ফলাফল', icon: Award, href: `/i/${slug}/results` },
    { label: 'Certificates', labelBn: 'সার্টিফিকেট', icon: GraduationCap, href: `/i/${slug}/certificates` },
    { label: 'Payments', labelBn: 'পেমেন্ট', icon: CreditCard, href: `/i/${slug}/payments` },
    { label: 'Reports', labelBn: 'রিপোর্ট', icon: BarChart3, href: `/i/${slug}/reports` },
    { label: 'Settings', labelBn: 'সেটিংস', icon: Settings, href: `/i/${slug}/settings` },
  ], [slug]);

  const navItems = user?.role === 'SUPER_ADMIN' ? superAdminNav : institutionNav;

  const handleLogout = async () => {
    await logout();
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
            {brand.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.brandLogo}
                alt={brand.brandShort}
                className={cn(
                  'h-9 w-9 shrink-0 rounded-md object-contain bg-white/90 p-0.5 ring-1',
                  isDark ? 'ring-white/15' : 'ring-black/10'
                )}
              />
            ) : (
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-bold text-[10px] transition-transform duration-300',
                'bg-brand-accent text-brand-accent-fg'
              )}>
                {brand.brandShort}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0">
                <span className={cn(
                  'block truncate text-sm font-semibold tracking-tight',
                  isDark ? 'text-white' : 'text-gray-900'
                )}>{brand.brandShort}</span>
                <p
                  className={cn('truncate text-[10px]', isDark ? 'text-zinc-500' : 'text-gray-500')}
                  title={brandName}
                >{brandName}</p>
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
          const isDashboard = item.href === '/super-admin' || /^\/i\/[^/]+$/.test(item.href);
          const isActive = isDashboard
            ? pathname === item.href || pathname === item.href + '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200',
                isActive
                  ? 'bg-brand-accent text-brand-accent-fg font-medium'
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
                  'h-3.5 w-3.5 text-brand-accent-fg opacity-50'
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
            'flex items-center gap-3 px-3 py-2.5 rounded-md',
            isDark ? 'bg-white/[0.04]' : 'bg-gray-50'
          )}>
            {inst?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={inst.logo}
                alt={inst.name}
                className={cn(
                  'h-8 w-8 shrink-0 rounded-md object-contain bg-white/90 p-0.5 ring-1',
                  isDark ? 'ring-white/15' : 'ring-black/10'
                )}
              />
            ) : (
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold',
                'bg-brand-accent text-brand-accent-fg'
              )}>
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
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
              'flex w-full items-center gap-3 rounded-md px-3 py-2.5 mt-1 text-sm transition-all duration-200',
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
});

export { Sidebar };
