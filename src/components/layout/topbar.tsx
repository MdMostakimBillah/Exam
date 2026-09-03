"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { Search, Bell, ChevronDown, Command, Sun, Moon, Globe, Settings, LogOut } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuCheckboxItem } from "../ui/dropdown-menu";
import { getCurrentUser, logout } from "@/lib/auth/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

function Topbar({ sidebarCollapsed }: TopbarProps) {
  const router = useRouter();
  const user = getCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const { lang: language, setLang } = useLang();

  const isDark = theme === 'dark';
  const isBn = language === 'bn';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

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
          'flex items-center gap-3 rounded-xl border px-4 py-2 text-sm transition-all duration-200',
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
        <button className={cn(
          'rounded-xl p-2.5 transition-all duration-200 relative',
          isDark 
            ? 'text-zinc-500 hover:text-white hover:bg-white/[0.05]' 
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        )}>
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {user && (
          <DropdownMenu
            align="right"
            trigger={
              <button className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200',
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
              onClick={() => router.push(user.role === 'SUPER_ADMIN' ? '/super-admin/settings' : '/i/settings')}
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
}

export { Topbar };
