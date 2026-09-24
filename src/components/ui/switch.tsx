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
 * Production toggle switch with a 3D physical look.
 *
 * Depth model (same idea as a real rocker switch):
 * - The TRACK is a milled groove: dark inner shadow on top, light inner
 *   highlight on the bottom (recessed into the card).
 * - The KNOB is a domed button: vertical gloss gradient + drop shadow so it
 *   reads as raised above the track; it presses in on :active.
 * - State changes the depth, not just the color: OFF sits deep in the groove
 *   (flush, no outer shadow), ON pops OUT (outer drop shadow around the track,
 *   knob lifted higher) in the Branding accent color.
 *
 * A real `<input type="checkbox" role="switch">` drives it → keyboard, form
 * semantics and screen readers work out of the box (styled via `peer`).
 * Contrast stays safe with any branding color AND the monochrome defaults
 * (dark default = white track / black knob, light = black track / white knob)
 * because the knob uses `--brand-accent-fg`.
 *
 * Pass row content as `children` to make the whole row the click target.
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
        "group flex items-center justify-between gap-4",
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
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition duration-300 motion-reduce:transition-none",
          checked
            ? // ON — lit groove that also casts a shadow: whole switch pops out.
              "bg-brand-accent hover:brightness-110 " +
              "shadow-[inset_0_2px_4px_rgba(0,0,0,0.35),inset_0_-1px_1px_rgba(255,255,255,0.35),0_2px_4px_rgba(0,0,0,0.3)]"
            : // OFF — deep milled groove, flush with the surface.
              "bg-zinc-300 hover:bg-zinc-400 dark:bg-white/[0.14] dark:hover:bg-white/20 " +
              "shadow-[inset_0_2px_3px_rgba(0,0,0,0.3),inset_0_-1px_1px_rgba(255,255,255,0.65)]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--brand-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white",
          "dark:peer-focus-visible:ring-offset-[#141416]",
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        )}
      >
        <span
          className={cn(
            "pointer-events-none relative inline-block h-5 w-5 overflow-hidden rounded-full bg-brand-accent-fg transition-transform duration-300",
            "ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
            // springy overshoot slide + press-in on hold
            checked
              ? "translate-x-[22px] shadow-[0_3px_5px_rgba(0,0,0,0.4),0_0_0_1px_rgba(0,0,0,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              : "translate-x-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]",
            "group-active:scale-90"
          )}
        >
          {/* domed gloss highlight */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/40 via-transparent to-transparent" />
        </span>
      </span>
    </label>
  );
}
