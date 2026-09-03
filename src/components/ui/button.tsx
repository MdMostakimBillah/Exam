import * as React from "react";
import { cn } from "@/lib/utils/helpers";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: 'bg-black text-white hover:bg-gray-800 active:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-zinc-100 dark:active:bg-zinc-200',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:active:bg-white/20 border border-gray-200/50 dark:border-white/10',
      ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5 dark:active:bg-white/10',
      destructive: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
      outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-white/5 dark:active:bg-white/10',
      success: 'bg-green-600 text-white hover:bg-green-500 active:bg-green-700',
    };
    const sizes = {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-11 px-6 text-sm',
      icon: 'h-9 w-9',
    };
    return (
      <button
        className={cn(
          'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        <span className={isLoading ? 'opacity-70' : ''}>{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
