"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { Card, CardContent } from "./card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

function StatCard({ title, value, change, icon: Icon, description, className }: StatCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Card className={cn("group hover-lift", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{value}</p>
            {change !== undefined && (
              <div className={cn('flex items-center gap-1 text-xs', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{Math.abs(change)}%</span>
              </div>
            )}
            {description && <p className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{description}</p>}
          </div>
          <div className={`rounded-xl p-3 transition-all duration-300 group-hover:scale-110 ${isDark ? "bg-zinc-800/80 group-hover:bg-zinc-700/80" : "bg-zinc-100 group-hover:bg-zinc-200"}`}>
            <Icon className={`h-5 w-5 transition-colors ${isDark ? "text-zinc-400 group-hover:text-zinc-300" : "text-zinc-500 group-hover:text-zinc-700"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { StatCard };
