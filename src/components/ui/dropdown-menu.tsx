"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { useTheme } from "@/contexts/theme-context";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[200px] rounded-xl border p-1.5 shadow-2xl animate-scaleIn backdrop-blur-xl',
            isDark
              ? 'border-white/[0.06] bg-[#0D0D0D]'
              : 'border-zinc-200 bg-white',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={cn('px-3 py-2 text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500', className)}>
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return <div className={cn('my-1.5 border-t', isDark ? 'border-white/[0.06]' : 'border-zinc-200', className)} />;
}

function DropdownMenuItem({ children, onClick, className, destructive }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 cursor-pointer',
        isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700',
        destructive ? 'text-red-500 hover:text-red-600' : '',
        className
      )}
    >
      {children}
    </button>
  );
}

function DropdownMenuCheckboxItem({ children, checked, onCheckedChange, className }: {
  children: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange?.(!checked);
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 cursor-pointer',
        isDark ? 'hover:bg-white/[0.05] text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700',
        className
      )}
    >
      <div className={cn(
        'h-4 w-4 rounded border flex items-center justify-center transition-all',
        checked
          ? isDark ? 'bg-white border-white' : 'bg-zinc-900 border-zinc-900'
          : isDark ? 'border-zinc-600' : 'border-zinc-300'
      )}>
        {checked && (
          <svg className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {children}
    </button>
  );
}

export { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem };
