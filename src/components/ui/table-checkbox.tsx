"use client";
import { cn } from "@/lib/utils/helpers";

interface TableCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function TableCheckbox({ checked, indeterminate = false, onChange, className }: TableCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "h-4 w-4 rounded-sm border-2 flex items-center justify-center transition-all duration-150",
        checked || indeterminate
          ? "bg-brand-accent border-brand-accent"
          : "border-zinc-300 dark:border-zinc-600 hover:border-brand-accent",
        className
      )}
    >
      {checked && (
        <svg className="h-3 w-3 text-brand-accent-fg" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg className="h-2.5 w-2.5 text-brand-accent-fg" viewBox="0 0 10 10" fill="none">
          <path d="M2 5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
