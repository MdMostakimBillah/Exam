import * as React from "react";
import { cn } from "@/lib/utils/helpers";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-8", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { PageHeader };
