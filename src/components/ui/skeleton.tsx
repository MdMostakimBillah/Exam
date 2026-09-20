import * as React from "react";
import { cn } from "@/lib/utils/helpers";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-zinc-200 dark:bg-white/[0.06] bg-[length:200%_100%] relative overflow-hidden',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] dark:via-white/[0.04] to-transparent animate-shimmer" />
    </div>
  );
}

export { Skeleton };
