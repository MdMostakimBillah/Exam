"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";

/**
 * Entrance-animation primitives.
 *
 * Lightweight by design: every animation is a one-shot CSS keyframe driven by
 * `--anim-*` custom properties (see `globals.css`), so nothing here runs
 * continuously, forces layout, or ships a runtime animation library. All
 * motion uses `transform`/`opacity` (GPU-friendly) and every class honours
 * `prefers-reduced-motion` through a single global override.
 *
 * Building blocks:
 *   PageEntrance    – opacity-only page wrapper (safe around fixed-position
 *                     toolbars/modals — it never sets transform/filter).
 *   FadeIn          – generic fade + rise (+ optional blur/scale) container.
 *   StaggerContainer/StaggerItem – sequential card/row entrance.
 *   AnimatedCounter – counts 0 → real value once real data is present.
 *   ChartEntrance   – chart section fade; pair with the `anim-bar` class and
 *                     `chartBarStyle()` so bars grow upward after it lands.
 */

/** Inline-style bag for the `--anim-*` keyframe variables. */
export type EntranceStyle = React.CSSProperties & {
  "--anim-delay"?: string;
  "--anim-dur"?: string;
  "--anim-x"?: string;
  "--anim-y"?: string;
  "--anim-s"?: string;
  "--anim-filter"?: string;
};

/** `true` when the OS/app requests reduced motion (SSR-safe: starts `false`). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Absolute entrance timeline from component mount. Pass a spec target
 * (e.g. `clock(0.65)` for lower sections) and it returns the remaining CSS
 * delay — so a section that mounts at 650ms starts instantly, while one that
 * mounts at 300ms waits the remaining 350ms. Data that arrives late is never
 * held back by the animation (elapsed targets clamp to 0).
 *
 * The returned value is monotonically non-increasing across re-renders,
 * which matters: shrinking an animation-delay can never re-trigger a
 * finished CSS animation, so auto-refreshes never replay the entrance.
 */
export function useEntranceClock(): (targetSeconds: number) => number {
  const originRef = React.useRef<number | null>(null);
  if (originRef.current === null && typeof performance !== "undefined") {
    originRef.current = performance.now();
  }
  return React.useCallback((target: number) => {
    const origin = originRef.current ?? 0;
    return Math.max(0, target - (performance.now() - origin) / 1000);
  }, []);
}

interface EntranceProps {
  /** Seconds to wait before the element starts moving. Default 0. */
  delay?: number;
  /** Animation length in seconds. Default 0.5. */
  duration?: number;
  /** Upward travel in px. Default 10. */
  y?: number;
  /** Horizontal travel in px (sidebar uses a small negative value). */
  x?: number;
  /** Start scale — cards use 0.98 for the subtle "settle" feel. */
  scale?: number;
  /** Entrance blur in px (welcome heading only — never on containers). */
  blur?: number;
  className?: string;
  children: React.ReactNode;
}

function entranceStyle({ delay = 0, duration = 0.5, y = 10, x = 0, scale = 1, blur = 0 }: Omit<EntranceProps, "className" | "children">): EntranceStyle {
  return {
    "--anim-delay": `${delay}s`,
    "--anim-dur": `${duration}s`,
    "--anim-x": `${x}px`,
    "--anim-y": `${y}px`,
    "--anim-s": String(scale),
    // Unset → the keyframes resolve `filter: none` (no containing block).
    ...(blur > 0 ? { "--anim-filter": `blur(${blur}px)` } : {}),
  };
}

/**
 * Page-level wrapper: a quiet opacity fade with **no transform/filter**, so
 * fixed-position toolbars, selection bars and inline modals inside the page
 * keep their viewport positioning. Key it by pathname (in a layout) to run
 * once per genuine page mount — filters, modals and in-page updates never
 * replay it.
 */
export function PageEntrance({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("anim-page", className)}>{children}</div>;
}

/** Generic one-shot fade + rise (optionally scale/blur) container. */
export function FadeIn({ className, children, ...opts }: EntranceProps) {
  return (
    <div className={cn("anim-enter", className)} style={entranceStyle(opts)}>
      {children}
    </div>
  );
}

const StaggerContext = React.createContext({ base: 0.35, increment: 0.04 });

/**
 * Groups items that should appear in sequence. Renders a plain container —
 * the motion lives on each `StaggerItem`.
 */
export function StaggerContainer({
  delay = 0.35,
  increment = 0.04,
  className,
  children,
}: {
  /** Seconds before the first item starts. */
  delay?: number;
  /** Extra delay added per item, in seconds. */
  increment?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ base: delay, increment }), [delay, increment]);
  return (
    <StaggerContext.Provider value={value}>
      <div className={className}>{children}</div>
    </StaggerContext.Provider>
  );
}

/**
 * One item inside a `StaggerContainer`. `index` is the item's position
 * (plus any offset when wrapping a later grid so the cascade continues).
 */
export function StaggerItem({
  index,
  delay,
  duration = 0.45,
  y = 10,
  scale = 1,
  className,
  children,
}: {
  index: number;
  /** Explicit start time in seconds — overrides the container's schedule
   *  (used to keep an inner AnimatedCounter in sync with its card). */
  delay?: number;
  duration?: number;
  y?: number;
  scale?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { base, increment } = React.useContext(StaggerContext);
  return (
    <FadeIn delay={delay ?? base + index * increment} duration={duration} y={y} scale={scale} className={className}>
      {children}
    </FadeIn>
  );
}

/**
 * Counts from 0 to `value` with a short ease-out. Never animates toward a
 * guessed number: it only runs with the `value` it was given, settles
 * immediately when that value never changes, and jumps straight to the
 * target under reduced motion. Later data updates ease from the currently
 * displayed figure instead of replaying the whole entrance.
 */
export function AnimatedCounter({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 900,
  delay = 0,
  className,
}: {
  value: number;
  /** Formats the interpolated figure (currency, rounding, …). */
  format?: (n: number) => string;
  /** Count length in ms. */
  duration?: number;
  /** Hold time before counting starts, in seconds. */
  delay?: number;
  className?: string;
}) {
  // SSR + first client render start at 0, so hydration always matches; the
  // effect then counts up (or, for reduced motion, snaps to the target).
  const [display, setDisplay] = React.useState(0);
  const displayRef = React.useRef(0);
  const hasRunRef = React.useRef(false);
  const reduced = usePrefersReducedMotion();
  // Freeze the entrance delay at mount: the clock-derived delay can shrink on
  // later re-renders, and it must never restart a count already in flight.
  const delayRef = React.useRef(delay);

  React.useEffect(() => {
    if (reduced) {
      hasRunRef.current = true;
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    // First run counts from 0; later data refreshes ease from what's shown.
    const from = hasRunRef.current ? displayRef.current : 0;
    hasRunRef.current = true;
    if (from === value || Number.isNaN(value)) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const startAt = performance.now() + delayRef.current * 1000;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - startAt) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — quick, no bounce
      const next = from + (value - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        displayRef.current = value;
        setDisplay(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, duration]);

  return <span className={className}>{format(display)}</span>;
}

/**
 * Fades a chart section in on the lower-section schedule. Bars inside it
 * should carry the `anim-bar` class plus `chartBarStyle(index)` so they grow
 * upward just after the card lands.
 */
export function ChartEntrance({
  delay = 0.7,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <FadeIn delay={delay} duration={0.5} y={12} className={className}>
      {children}
    </FadeIn>
  );
}

/** Inline `--anim-delay` for one bar inside a `ChartEntrance`. */
export function chartBarStyle(index: number, base = 0.78, step = 0.035): EntranceStyle {
  return { "--anim-delay": `${base + index * step}s` };
}
