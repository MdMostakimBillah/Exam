"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils/helpers";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name announced by screen readers for the switch. */
  label?: string;
  /** Extra classes for the clickable <label> wrapper (padding, borders, hover…). */
  className?: string;
  /** Left-side row content — clicking it toggles the switch. */
  children?: ReactNode;
}

/**
 * Production toggle switch.
 *
 * - Real `<input type="checkbox" role="switch">` → keyboard, form semantics and
 *   screen readers work out of the box; the visible track is styled via `peer`.
 * - ON track uses `--brand-accent` with a `--brand-accent-fg` knob, so it stays
 *   contrast-safe with any branding color AND with the monochrome defaults
 *   (dark default = white track / black knob, light = black track / white knob).
 * - Pass row content as `children` to make the whole row the click target.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
  children,
}: SwitchProps) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      {children}
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition duration-200 motion-reduce:transition-none",
          checked
            ? "bg-brand-accent hover:brightness-110"
            : "bg-zinc-300 hover:bg-zinc-400 dark:bg-white/[0.16] dark:hover:bg-white/25",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--brand-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white",
          "dark:peer-focus-visible:ring-offset-[#141416]",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-black/10 transition-transform duration-200 ease-out motion-reduce:transition-none",
            checked
              ? "translate-x-[22px] bg-brand-accent-fg"
              : "translate-x-0.5 bg-white"
          )}
        />
      </span>
    </label>
  );
}
