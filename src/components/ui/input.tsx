import * as React from "react";
import { cn } from "@/lib/utils/helpers";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900',
        'placeholder:text-gray-400',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/30 focus-visible:border-gray-400/30',
        'hover:border-gray-300',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-zinc-500',
        'dark:focus-visible:ring-white/20 dark:hover:border-white/20',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
