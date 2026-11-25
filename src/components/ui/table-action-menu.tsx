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
  /**
   * Dropdown placement relative to the 3-dot trigger button.
   * - "auto": dynamically flips to "top" when space below the button is tight (< 220px)
   * - "top": always opens above the button (bottom-anchored)
   * - "bottom": always opens below the button (top-anchored)
   */
  placement?: "auto" | "top" | "bottom";
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight?: number;
  isTop: boolean;
}

export function TableActionMenu({
  id,
  openId,
  onToggle,
  isDark,
  children,
  placement = "auto",
}: TableActionMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<MenuCoords>({ right: 0, isTop: false });
  const isOpen = openId === id;

  const calculatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Standard action menus in tables are 140px-220px high
    const menuHeight = menuRef.current?.offsetHeight || 180;

    const shouldShowTop =
      (placement === "top" && spaceAbove >= 100) ||
      (placement !== "bottom" && (spaceBelow < menuHeight + 20 || spaceBelow < 220) && spaceAbove > spaceBelow);

    if (shouldShowTop) {
      setCoords({
        bottom: Math.max(8, window.innerHeight - rect.top + 4),
        right,
        maxHeight: Math.max(120, spaceAbove - 16),
        isTop: true,
      });
    } else {
      setCoords({
        top: Math.max(8, rect.bottom + 4),
        right,
        maxHeight: Math.max(120, spaceBelow - 16),
        isTop: false,
      });
    }
  }, [placement]);

  useEffect(() => {
    if (isOpen) {
      calculatePos();
      const onScrollOrResize = () => calculatePos();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
      };
    }
  }, [isOpen, calculatePos]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      calculatePos();
    }
    onToggle(isOpen ? null : id);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
          isDark ? "hover:bg-white/[0.08] text-zinc-400" : "hover:bg-zinc-100 text-zinc-500",
          isOpen && (isDark ? "bg-white/[0.08] text-zinc-200" : "bg-zinc-100 text-zinc-800")
        )}
        aria-label="Actions"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onToggle(null)} />
          <div
            ref={menuRef}
            className={cn(
              "fixed z-50 w-44 rounded-md border py-1 shadow-xl overflow-y-auto animate-scaleIn",
              coords.isTop ? "origin-bottom-right" : "origin-top-right",
              isDark
                ? "bg-[#1a1a1c] border-white/[0.08] shadow-black/60"
                : "bg-white border-zinc-200 shadow-zinc-900/15"
            )}
            style={{
              top: coords.top,
              bottom: coords.bottom,
              right: coords.right,
              maxHeight: coords.maxHeight,
            }}
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
    <button type="button" onClick={onClick} className={cn("flex items-center gap-2 w-full px-3 py-2 text-[11px]", colors[variant])}>
      {children}
    </button>
  );
}

export function TableActionDivider({ isDark }: { isDark: boolean }) {
  return <div className={cn("border-t my-0.5", isDark ? "border-white/[0.06]" : "border-zinc-100")} />;
}
