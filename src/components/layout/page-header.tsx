"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { useTheme } from "@/contexts/theme-context";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

function PageHeader({ title, description, children, className }: PageHeaderProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={cn("flex items-start justify-between mb-8", className)}>
      <div className="space-y-1">
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{title}</h1>
        {description && <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export { PageHeader };
