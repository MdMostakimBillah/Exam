"use client";

import { cn } from "@/lib/utils/helpers";

interface LoadingBarProps {
  isLoading: boolean;
  isDark?: boolean;
}

export function LoadingBar({ isLoading, isDark = false }: LoadingBarProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px]">
      <div
        className={cn(
          "h-full animate-loadingBar",
          isDark ? "bg-white" : "bg-zinc-900"
        )}
      />
    </div>
  );
}
