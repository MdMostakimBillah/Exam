"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const keys = Object.keys(localStorage);
    const themeKey = keys.find(k => k.startsWith('scholarx-theme-'));
    if (themeKey) {
      const stored = localStorage.getItem(themeKey);
      return stored !== 'light';
    }
  } catch {}
  return true;
}

export default function SuperAdminLoading() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(getInitialDark());
  }, []);

  return (
    <div className={isDark ? "bg-[#0a0a0b] min-h-screen" : "bg-zinc-50 min-h-screen"}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <Skeleton className={`h-8 w-48 rounded-md mb-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
          <Skeleton className={`h-4 w-64 rounded-md ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className={`h-[52px] rounded-md ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className={`h-[52px] rounded-md ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className={`col-span-12 lg:col-span-7 h-64 rounded-md ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
          <Skeleton className={`col-span-12 lg:col-span-5 h-64 rounded-md ${isDark ? "bg-white/[0.04]" : "bg-zinc-200"}`} />
        </div>
      </div>
    </div>
  );
}
