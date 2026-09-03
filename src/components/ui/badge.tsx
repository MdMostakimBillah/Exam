import * as React from "react";
import { cn } from "@/lib/utils/helpers";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: string;
  variant?: 'default' | 'secondary' | 'outline';
}

function Badge({ className, status, variant = 'default', children, ...props }: BadgeProps) {
  const getStatusClasses = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE' || s === 'APPROVED' || s === 'PAID' || s === 'PUBLISHED' || s === 'VERIFIED' || s === 'GENERATED' || s === 'ELIGIBLE') {
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
    if (s === 'PENDING' || s === 'PAYMENT_PENDING' || s === 'DRAFT' || s === 'REVIEW') {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    if (s === 'REJECTED' || s === 'SUSPENDED' || s === 'FAILED' || s === 'NOT_ELIGIBLE' || s === 'ERROR') {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    if (s === 'CLOSED' || s === 'ARCHIVED' || s === 'INACTIVE' || s === 'REFUNDED') {
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all duration-200',
        status ? getStatusClasses(status) : 'dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 bg-zinc-100 text-zinc-600 border-zinc-200',
        className
      )}
      {...props}
    >
      {children || status}
    </div>
  );
}

export { Badge };
