import * as React from "react";
import { cn } from "@/lib/utils/helpers";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <select
      className={cn(
        'flex h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/30 focus-visible:border-gray-400/30',
        'hover:border-gray-300',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'appearance-none cursor-pointer',
        'dark:bg-white/5 dark:border-white/10 dark:text-white dark:focus-visible:ring-white/20',
        className
      )}
      ref={ref}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-white text-gray-900 dark:bg-[#0D0D0D]">{opt.label}</option>
      ))}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
