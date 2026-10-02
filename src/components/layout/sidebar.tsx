"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/helpers";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, FileText, Award,
  CreditCard, BarChart3, Bell, Settings,
  ClipboardList, FileCheck, School, BookOpen,
  CalendarDays, GraduationCap, LogOut, ChevronRight, BookMarked, Hash, X,
  LifeBuoy, ChevronsLeft, ChevronsRight, ArrowRight, ArrowLeft
} from "lucide-react";
import { useAuth, logout } from "@/lib/auth/auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";

/** Which viewport edge the rail is docked to. */
type SidebarSide = "left" | "right";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Below lg the sidebar is a drawer — true slides it in over the content. */
  mobileOpen?: boolean;
  /** Closes the drawer (hamburger toggle / scrim click / link navigation). */
  onClose?: () => void;
  /** Docked edge — 'left' (default) or 'right'; flipped by the footer button. */
  side?: SidebarSide;
  /** Moves the rail to the opposite edge. */
  onFlipSide?: () => void;
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
  { label: 'Support', labelBn: 'সাপোর্ট', icon: LifeBuoy, href: '/super-admin/support' },
  { label: 'Settings', labelBn: 'সেটিংস', icon: Settings, href: '/super-admin/settings' },
];

const Sidebar = React.memo(function Sidebar({
  collapsed = false, onToggle, mobileOpen = false, onClose, side = "left", onFlipSide,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const { user } = useAuth();

  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  /* ── Rail tooltips (icons-only mode) ──────────────────────────────────
     Collapsed, the nav rows are glyphs only, so each one carries its label
     in a floating tip. State-driven rather than a CSS group-hover child:
     the nav scrolls (overflow-y-auto), which would clip an absolutely
     positioned child, and a fixed box positioned from getBoundingClientRect
     stays glued to the row even while scrolling. Mounted ONLY while visible
     so an off-screen tip can never widen the document (the animation suite
     asserts zero horizontal overflow). */
  const [tip, setTip] = React.useState<
    { id: number; text: string; x: number; y: number; dir: "l" | "r" } | null
  >(null);
  const tipId = React.useRef(0);

  const showTip = React.useCallback(
    (text: string, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      // Anchor to the RAIL's outer edge, not the control's: a collapsed nav
      // row ends at 48px (px-3 gutter) while the rail is 72px, so the control
      // edge would drop the tip on top of the icons it is labelling.
      const rail = el.closest("aside");
      const railBox = rail ? rail.getBoundingClientRect() : r;
      tipId.current += 1;
      setTip({
        id: tipId.current,
        text,
        x: side === "left" ? railBox.right + 10 : railBox.left - 10,
        y: r.top + r.height / 2,
        dir: side === "left" ? "l" : "r",
      });
    },
    [side]
  );
  const hideTip = React.useCallback(() => setTip(null), []);

  // Any scroll/resize/route change invalidates the measured anchor point.
  React.useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip]);
  React.useEffect(() => setTip(null), [pathname]);

  /** Handlers for an icon-only control; null while labels are visible. */
  const tipFor = (text: string, enabled: boolean) =>
    enabled
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(text, e.currentTarget),
          onMouseLeave: hideTip,
          onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(text, e.currentTarget),
          onBlur: hideTip,
        }
      : {};

  // Association branding (super-admin editable in Settings → Branding)
  const { data: brandData } = useBranding();
  const brand = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (isBn ? brand.brandNameBn : brand.brandName) || brand.brandName;

  const slug = React.useMemo(() => {
    const match = pathname.match(/^\/i\/([^/]+)/);
    return match ? match[1] : '';
  }, [pathname]);

  const institutionNav: NavItem[] = React.useMemo(() => [
    { label: 'Dashboard', labelBn: 'ড্যাশবোর্ড', icon: LayoutDashboard, href: `/i/${slug}` },
    { label: 'Registrations', labelBn: 'নিবন্ধন', icon: ClipboardList, href: `/i/${slug}/registrations` },
    { label: 'Students', labelBn: 'শিক্ষার্থী', icon: Users, href: `/i/${slug}/students` },
    { label: 'Admit Cards', labelBn: 'প্রবেশপত্র', icon: FileCheck, href: `/i/${slug}/admit-cards` },
    { label: 'Marks', labelBn: 'নম্বর', icon: BookOpen, href: `/i/${slug}/marks` },
    { label: 'Results', labelBn: 'ফলাফল', icon: Award, href: `/i/${slug}/results` },
    { label: 'Certificates', labelBn: 'সার্টিফিকেট', icon: GraduationCap, href: `/i/${slug}/certificates` },
    { label: 'Payments', labelBn: 'পেমেন্ট', icon: CreditCard, href: `/i/${slug}/payments` },
    { label: 'Reports', labelBn: 'রিপোর্ট', icon: BarChart3, href: `/i/${slug}/reports` },
    { label: 'Help & Support', labelBn: 'সাহায্য', icon: LifeBuoy, href: `/i/${slug}/help` },
    { label: 'Settings', labelBn: 'সেটিংস', icon: Settings, href: `/i/${slug}/settings` },
  ], [slug]);

  const navItems = user?.role === 'SUPER_ADMIN' ? superAdminNav : institutionNav;

  // Desktop can collapse the rail to icons; the mobile drawer must always
  // show labels and stay 240px wide regardless of that flag.
  const showLabels = !collapsed || mobileOpen;

  const handleLogout = async () => {
    onClose?.();
    await logout();
    router.push('/login');
  };

  // Entrance direction mirrors the dock: the rail slides in from its own edge.
  const enterX = side === 'right' ? '6px' : '-6px';

  return (
    <aside
      data-side={side}
      data-collapsed={collapsed && !mobileOpen ? 'true' : 'false'}
      className={cn(
        'fixed top-0 z-40 h-screen flex flex-col',
        side === 'right' ? 'right-0' : 'left-0',
        'transition-transform duration-200 ease-out',
        collapsed && !mobileOpen ? 'w-[72px]' : 'w-[240px]',
        isDark ? 'bg-[#0D0D0D]' : 'bg-white',
        mobileOpen
          ? 'translate-x-0 shadow-2xl shadow-black/40'
          : side === 'right' ? 'translate-x-full' : '-translate-x-full',
        'lg:translate-x-0 lg:shadow-none'
      )}
    >
      {/* Close — drawer only (lg:hidden); desktop collapses via onToggle */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close menu"
          className={cn(
            'lg:hidden absolute top-4 z-10 p-2 rounded-md transition-colors',
            side === 'right' ? 'left-2.5' : 'right-2.5',
            isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b shrink-0 anim-enter',
        isDark ? 'bg-[#0D0D0D] border-white/[0.04]' : 'bg-white border-gray-200/50'
      )} style={{ '--anim-delay': '0.05s', '--anim-dur': '0.4s', '--anim-x': enterX, '--anim-y': '0px' } as React.CSSProperties}>
        <div className={cn(
          'flex items-center',
          showLabels
            // pr-9/pl-9 reserves the room of the drawer's close (X) button
            ? (side === 'right' ? 'h-16 px-5 pl-9 lg:pl-5' : 'h-16 px-5 pr-9 lg:pr-5')
            : (side === 'right'
              ? 'h-16 px-4 pl-9 lg:pl-4 justify-center w-full'
              : 'h-16 px-4 pr-9 lg:pr-4 justify-center w-full')
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
            {showLabels && (
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
        {navItems.map((item, i) => {
          const isDashboard = item.href === '/super-admin' || /^\/i\/[^/]+$/.test(item.href);
          const isActive = isDashboard
            ? pathname === item.href || pathname === item.href + '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          const label = isBn ? item.labelBn : item.label;
          return (
            <button
              key={item.href}
              aria-label={label}
              onClick={() => {
                hideTip();
                const navigationEvent = new CustomEvent("app:before-navigation", { cancelable: true });
                if (!window.dispatchEvent(navigationEvent)) return;
                router.push(item.href);
                onClose?.();
              }}
              /* Mount-only stagger: React keeps these DOM nodes across
                 navigations (stable keys), so the CSS animation fires once
                 when the sidebar first appears and never replays. */
              className={cn(
                'group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 anim-enter',
                isActive
                  ? 'bg-brand-accent text-brand-accent-fg font-medium'
                  : isDark
                    ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}
              style={{
                '--anim-delay': `${0.1 + Math.min(i, 12) * 0.03}s`,
                '--anim-dur': '0.4s',
                '--anim-x': enterX,
                '--anim-y': '0px',
              } as React.CSSProperties}
              {...tipFor(label, !showLabels && !mobileOpen)}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {showLabels && (
                <span className="flex-1 text-left">{label}</span>
              )}
              {isActive && showLabels && (
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 text-brand-accent-fg opacity-50'
                )} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse / expand — rides the rail's outer edge so it is reachable
          in BOTH states; half of it overhangs the content side. Hidden below
          lg, where the sidebar is a drawer with its own X. */}
      {onToggle && !mobileOpen && (
        <button
          type="button"
          data-sidebar-toggle="1"
          onClick={onToggle}
          aria-label={collapsed
            ? (isBn ? 'সাইডবার প্রসারিত করুন' : 'Expand sidebar')
            : (isBn ? 'সাইডবার সংকুচিত করুন' : 'Collapse sidebar')}
          className={cn(
            'hidden lg:flex absolute top-1/2 z-50 h-6 w-6 -translate-y-1/2 items-center justify-center',
            'rounded-full border shadow-md transition-colors duration-200',
            side === 'left' ? '-right-3' : '-left-3',
            isDark
              ? 'border-white/10 bg-[#141414] text-zinc-400 hover:text-white hover:bg-[#1b1b1b]'
              : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          )}
          {...tipFor(collapsed
            ? (isBn ? 'সাইডবার প্রসারিত করুন' : 'Expand sidebar')
            : (isBn ? 'সাইডবার সংকুচিত করুন' : 'Collapse sidebar'), true)}
        >
          {collapsed
            ? (side === 'left' ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />)
            : (side === 'left' ? <ChevronsLeft className="h-3.5 w-3.5" /> : <ChevronsRight className="h-3.5 w-3.5" />)}
        </button>
      )}

      {/* Sign out + side flip. Rendered even when the rail is icon-only so
          neither action becomes unreachable after collapsing. */}
      {user && (
        <div className={cn(
          'border-t shrink-0',
          showLabels ? 'p-3' : 'p-2',
          isDark ? 'bg-[#0D0D0D] border-white/[0.04]' : 'bg-white border-gray-200/50'
        )}>
          <div className={cn('flex gap-1', showLabels ? 'flex-row items-center' : 'flex-col')}>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={isBn ? 'প্রস্থান' : 'Sign out'}
              className={cn(
                'flex items-center rounded-md text-sm transition-all duration-200',
                showLabels
                  ? 'flex-1 gap-3 px-3 py-2.5'
                  : 'h-9 w-full justify-center gap-0 px-0',
                isDark
                  ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}
              {...tipFor(isBn ? 'প্রস্থান' : 'Sign out', !showLabels)}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {showLabels && <span>{isBn ? 'প্রস্থান' : 'Sign out'}</span>}
            </button>

            {onFlipSide && (
              <button
                type="button"
                data-sidebar-flip="1"
                onClick={() => { hideTip(); onFlipSide(); }}
                aria-label={side === 'left'
                  ? (isBn ? 'সাইডবার ডানে সরান' : 'Move sidebar to the right')
                  : (isBn ? 'সাইডবার বামে সরান' : 'Move sidebar to the left')}
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-md transition-all duration-200',
                  showLabels ? 'h-9 w-9' : 'h-9 w-full',
                  isDark
                    ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )}
                {...tipFor(side === 'left'
                  ? (isBn ? 'সাইডবার ডানে সরান' : 'Move sidebar to the right')
                  : (isBn ? 'সাইডবার বামে সরান' : 'Move sidebar to the left'), !showLabels)}
              >
                {side === 'left' ? <ArrowRight className="h-[18px] w-[18px]" /> : <ArrowLeft className="h-[18px] w-[18px]" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating tip — mounted only while a control is hovered/focused.
          Portaled to <body>: the rail carries a (non-none) transform, which
          would otherwise become the containing block for this fixed box and
          push the tip off-screen whenever the rail is docked right. */}
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          aria-hidden
          data-rail-tip="1"
          className="pointer-events-none fixed z-[60]"
          style={{ left: tip.x, top: tip.y, transform: `translate(${tip.dir === 'l' ? '0' : '-100%'}, -50%)` }}
        >
          <span
            key={tip.id}
            className={cn(
              'anim-enter block whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium shadow-lg ring-1',
              isDark ? 'bg-zinc-800 text-white ring-white/10' : 'bg-gray-900 text-white ring-black/10'
            )}
            style={{
              '--anim-delay': '0s',
              '--anim-dur': '0.18s',
              '--anim-x': tip.dir === 'l' ? '-6px' : '6px',
              '--anim-y': '0px',
            } as React.CSSProperties}
          >
            {tip.text}
          </span>
        </div>,
        document.body
      )}
    </aside>
  );
});

export { Sidebar };
