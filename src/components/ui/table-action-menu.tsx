"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

interface TableActionMenuProps {
  id: string;
  openId: string | null;
  onToggle: (id: string | null) => void;
  isDark: boolean;
  children: React.ReactNode;
}

export function TableActionMenu({ id, openId, onToggle, isDark, children }: TableActionMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const isOpen = openId === id;

  const updatePos = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePos();
      const onScroll = () => updatePos();
      window.addEventListener("scroll", onScroll, true);
      return () => window.removeEventListener("scroll", onScroll, true);
    }
  }, [isOpen, updatePos]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => onToggle(isOpen ? null : id)}
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
          isDark ? "hover:bg-white/[0.08] text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
        )}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onToggle(null)} />
          <div
            className={cn(
              "fixed z-50 w-40 rounded-md border py-1 shadow-lg",
              isDark ? "bg-[#1a1a1c] border-white/[0.08]" : "bg-white border-zinc-200"
            )}
            style={{ top: pos.top, right: pos.right }}
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}

interface TableActionItemProps {
  onClick: () => void;
  isDark?: boolean;
  variant?: "default" | "danger" | "success" | "warning";
  children: React.ReactNode;
}

export function TableActionItem({ onClick, isDark, variant = "default", children }: TableActionItemProps) {
  const colors = {
    default: isDark ? "text-zinc-400 hover:bg-white/[0.05] hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
    danger: isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50",
    success: isDark ? "text-emerald-400 hover:bg-white/[0.04]" : "text-emerald-600 hover:bg-emerald-50",
    warning: isDark ? "text-amber-400 hover:bg-white/[0.04]" : "text-amber-600 hover:bg-amber-50",
  };
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 w-full px-3 py-2 text-[11px]", colors[variant])}>
      {children}
    </button>
  );
}

export function TableActionDivider({ isDark }: { isDark: boolean }) {
  return <div className={cn("border-t my-0.5", isDark ? "border-white/[0.06]" : "border-zinc-100")} />;
}
