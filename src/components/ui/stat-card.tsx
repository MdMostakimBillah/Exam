import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { Card, CardContent } from "./card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

function StatCard({ title, value, change, icon: Icon, description, className }: StatCardProps) {
  return (
    <Card className={cn("group hover-lift", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-zinc-100 tracking-tight">{value}</p>
            {change !== undefined && (
              <div className={cn('flex items-center gap-1 text-xs', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{Math.abs(change)}% from last month</span>
              </div>
            )}
            {description && <p className="text-xs text-zinc-600">{description}</p>}
          </div>
          <div className="rounded-xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 p-3 group-hover:from-zinc-700/80 group-hover:to-zinc-800/80 transition-all duration-300 group-hover:scale-110">
            <Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { StatCard };
