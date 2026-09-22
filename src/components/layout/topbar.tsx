"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { Search, Bell, ChevronDown, Command, Sun, Moon, Globe, Settings, LogOut, Calendar, Check } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem } from "../ui/dropdown-menu";
import { useAuth, logout } from "@/lib/auth/auth";
import { useSessions, useCurrentSession, useSetCurrentSession } from "@/lib/storage/sessions";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/storage/notifications";
import { Notification } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

const Topbar = React.memo(function Topbar({ sidebarCollapsed }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { lang: language, setLang } = useLang();
  const { user } = useAuth();
  const { data: currentSession } = useCurrentSession();
  const { data: sessions = [] } = useSessions();
  const setCurrentSession = useSetCurrentSession();

  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const slug = React.useMemo(() => {
    const match = pathname.match(/^\/i\/([^/]+)/);
    return match ? match[1] : '';
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSessionSwitch = async (sessionId: string) => {
    if (sessionId !== currentSession?.id) {
      await setCurrentSession.mutateAsync(sessionId);
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // ---- Notifications bell ----
  const { data: notifList, isLoading: notifsLoading, isError: notifsError } = useNotifications(user?.id || '');
  const unreadCount = React.useMemo(() => (notifList || []).filter(n => !n.read).length, [notifList]);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markReadMutation.mutate(n.id);
    if (n.link) { router.push(n.link); return; }
    // No link stored (old notifications): open the notifications list
    if (isSuperAdmin) router.push('/super-admin/notifications');
    else if (slug) router.push(`/i/${slug}/settings`);
  };

  const notifDotColor = (type: Notification['type']) =>
    type === 'success' ? 'bg-emerald-500'
    : type === 'warning' ? 'bg-amber-500'
    : type === 'error' ? 'bg-red-500'
    : 'bg-sky-500';

  return (
    <header className={cn(
      'fixed top-0 right-0 z-30 h-16 flex items-center justify-between px-6 transition-all duration-200',
      'backdrop-blur-2xl',
      isDark 
        ? 'bg-white/5 border-white/10' 
        : 'bg-white/60 border-white/80',
      'left-[240px]'
    )}>
      {/* Search */}
      <div className="flex items-center gap-4">
        <button className={cn(
          'flex items-center gap-3 rounded-md border px-4 py-2 text-sm transition-all duration-200',
          isDark 
            ? 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1]' 
            : 'border-gray-200/50 bg-gray-50/80 text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-300'
        )}>
          <Search className="h-4 w-4" />
          <span>{isBn ? 'অনুসন্ধান...' : 'Search...'}</span>
          <kbd className={cn(
            'flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono',
            isDark ? 'border-white/[0.06] bg-white/[0.04] text-zinc-600' : 'border-gray-200 bg-white text-gray-400'
          )}>
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Session Switcher */}
        {currentSession && (
          <DropdownMenu
            align="right"
            trigger={
              <button className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium border transition-all duration-200',
                isDark
                  ? 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-300'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
              )}>
                <Calendar className="h-3.5 w-3.5" />
                <span>{currentSession.name}</span>
                {isSuperAdmin && sessions.length > 1 && (
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                )}
              </button>
            }
          >
            <DropdownMenuLabel className={isDark ? 'text-zinc-400' : 'text-gray-600'}>
              {isBn ? 'একাডেমিক সেশন' : 'Academic Session'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.04]' : 'bg-gray-200/50'} />
            {sessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                onClick={() => handleSessionSwitch(session.id)}
                className={cn(
                  'flex items-center gap-2',
                  isDark ? 'text-white' : 'text-gray-700'
                )}
              >
                <Check className={cn(
                  'h-3.5 w-3.5',
                  session.id === currentSession.id ? 'opacity-100' : 'opacity-0'
                )} />
                <span>{session.name}</span>
                {session.isCurrent && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    isDark ? 'bg-white/10 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                  )}>
                    {isBn ? 'বর্তমান' : 'Current'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenu>
        )}

        <DropdownMenu
          align="right"
          trigger={
            <button
              aria-label={isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}
              className={cn(
                'rounded-md p-2.5 transition-all duration-200 relative',
                isDark
                  ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              )}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          }
        >
          <div className="w-[320px]">
            <div className="flex items-center justify-between px-3 py-2">
              <span className={cn('text-xs font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                {isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => user && markAllReadMutation.mutate(user.id)}
                  className={cn('text-[10px] font-medium hover:underline', isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900')}
                >
                  {isBn ? 'সব পঠিত করুন' : 'Mark all read'}
                </button>
              )}
            </div>
            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'} />

            <div className="max-h-[320px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {notifsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin text-zinc-400" />
                </div>
              ) : notifsError ? (
                <p className={cn('px-3 py-6 text-center text-xs', isDark ? 'text-red-400/80' : 'text-red-500')}>
                  {isBn
                    ? 'বিজ্ঞপ্তি লোড করা যায়নি — 0008 মাইগ্রেশন চালান'
                    : 'Could not load notifications — run migration 0008'}
                </p>
              ) : !notifList || notifList.length === 0 ? (
                <p className={cn('px-3 py-6 text-center text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                  {isBn ? 'কোন বিজ্ঞপ্তি নেই' : 'No notifications yet'}
                </p>
              ) : (
                notifList.slice(0, 12).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full text-left flex gap-2.5 rounded-md px-3 py-2.5 transition-all',
                      isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-zinc-100',
                      !n.read && (isDark ? 'bg-white/[0.02]' : 'bg-zinc-50')
                    )}
                  >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', n.read ? 'bg-transparent' : notifDotColor(n.type))} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[13px] font-medium truncate', n.read ? (isDark ? 'text-zinc-400' : 'text-zinc-600') : (isDark ? 'text-white' : 'text-zinc-900'))}>
                        {n.title}
                      </span>
                      <span className={cn('block text-[11px] truncate', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                        {n.message}
                      </span>
                      <span className={cn('block text-[10px] mt-0.5', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                        {formatDate(n.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'} />
            <DropdownMenuItem
              onClick={() => router.push(isSuperAdmin ? '/super-admin/notifications' : (slug ? `/i/${slug}/settings` : '/'))}
              className={cn('justify-center text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}
            >
              {isBn ? 'সব বিজ্ঞপ্তি দেখুন' : 'View all notifications'}
            </DropdownMenuItem>
          </div>
        </DropdownMenu>

        {user && (
          <DropdownMenu
            align="right"
            trigger={
              <button className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200',
                isDark 
                  ? 'hover:bg-white/[0.05]' 
                  : 'hover:bg-gray-100'
              )}>
                <Avatar name={user.name} size="sm" />
                <div className="flex flex-col items-start">
                  <span className={cn(
                    'text-sm font-medium',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}>{user.name}</span>
                  <span className={cn(
                    'text-xs',
                    isDark ? 'text-zinc-500' : 'text-gray-500'
                  )}>{user.role.replace('_', ' ')}</span>
                </div>
                <ChevronDown className={cn('h-4 w-4', isDark ? 'text-zinc-500' : 'text-gray-400')} />
              </button>
            }
          >
            <DropdownMenuLabel className={isDark ? 'text-zinc-400' : 'text-gray-600'}>
              {isBn ? 'সেটিংস' : 'Settings'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.04]' : 'bg-gray-200/50'} />
            
            <DropdownMenuLabel className={cn(
              'text-xs font-normal py-0',
              isDark ? 'text-zinc-500' : 'text-gray-400'
            )}>
              {isBn ? 'থিম' : 'Theme'}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem 
              checked={theme === 'dark'} 
              onCheckedChange={() => theme !== 'dark' && toggleTheme()}
              className={isDark ? 'text-white' : 'text-gray-700'}
            >
              <Moon className="h-4 w-4 mr-2" /> {isBn ? 'ডার্ক' : 'Dark'}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={theme === 'light'} 
              onCheckedChange={() => theme !== 'light' && toggleTheme()}
              className={isDark ? 'text-white' : 'text-gray-700'}
            >
              <Sun className="h-4 w-4 mr-2" /> {isBn ? 'লাইট' : 'Light'}
            </DropdownMenuCheckboxItem>
            
            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.04]' : 'bg-gray-200/50'} />
            
            <DropdownMenuLabel className={cn(
              'text-xs font-normal py-0',
              isDark ? 'text-zinc-500' : 'text-gray-400'
            )}>
              {isBn ? 'ভাষা' : 'Language'}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem 
              checked={language === 'en'} 
              onCheckedChange={() => setLang('en')}
              className={isDark ? 'text-white' : 'text-gray-700'}
            >
              <Globe className="h-4 w-4 mr-2" /> English
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem 
              checked={language === 'bn'} 
              onCheckedChange={() => setLang('bn')}
              className={isDark ? 'text-white' : 'text-gray-700'}
            >
              <Globe className="h-4 w-4 mr-2" /> বাংলা
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator className={isDark ? 'bg-white/[0.04]' : 'bg-gray-200/50'} />
            
            <DropdownMenuItem 
              onClick={() => router.push(user.role === 'SUPER_ADMIN' ? '/super-admin/settings' : `/i/${slug}/settings`)}
              className={isDark ? 'text-zinc-300' : 'text-gray-700'}
            >
              <Settings className="h-4 w-4 mr-2" /> {isBn ? 'সেটিংস' : 'Settings'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} destructive>
              <LogOut className="h-4 w-4 mr-2" /> {isBn ? 'প্রস্থান' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
});

export { Topbar };
