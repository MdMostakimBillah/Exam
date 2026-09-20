"use client";

import { cn } from "@/lib/utils/helpers";

interface PageLoadingProps {
  isDark?: boolean;
  message?: string;
}

export function PageLoading({ isDark = false, message }: PageLoadingProps) {
  return (
    <div className={cn("min-h-screen", isDark ? "bg-[#0a0a0b]" : "bg-zinc-50")}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={cn("h-8 w-48 rounded-md", isDark ? "bg-white/[0.06]" : "bg-zinc-200")} />
          {message && (
            <div className={cn("h-4 w-64 rounded mt-2", isDark ? "bg-white/[0.04]" : "bg-zinc-200/60")} />
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={cn("rounded-md h-[52px]", isDark ? "bg-white/[0.04]" : "bg-zinc-200/60")} />
          ))}
        </div>
        <div className={cn("rounded-md h-12 mb-6", isDark ? "bg-white/[0.04]" : "bg-zinc-200/60")} />
        <div className={cn("rounded-md h-64", isDark ? "bg-white/[0.04]" : "bg-zinc-200/60")} />
      </div>
    </div>
  );
}
