import * as React from "react";
import { cn } from "@/lib/utils/helpers";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: string;
  variant?: 'default' | 'secondary' | 'outline';
}

function Badge({ className, status, variant = 'default', children, ...props }: BadgeProps) {
  const getStatusClasses = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'ACTIVE' || s === 'OPEN' || s === 'APPROVED' || s === 'PAID' || s === 'CONFIRMED' || s === 'PUBLISHED' || s === 'VERIFIED' || s === 'GENERATED' || s === 'ELIGIBLE' || s === 'TALENT_POOL' || s === 'GENERAL') {
      return 'badge-success';
    }
    if (s === 'PENDING' || s === 'PAYMENT_PENDING' || s === 'DRAFT' || s === 'REVIEW') {
      return 'badge-warning';
    }
    if (s === 'REJECTED' || s === 'SUSPENDED' || s === 'FAILED' || s === 'NOT_ELIGIBLE' || s === 'ERROR') {
      return 'badge-danger';
    }
    if (s === 'REFUNDED') {
      return 'badge-accent';
    }
    if (s === 'CLOSED' || s === 'ARCHIVED' || s === 'INACTIVE') {
      return 'badge-muted';
    }
    return 'badge-info';
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
