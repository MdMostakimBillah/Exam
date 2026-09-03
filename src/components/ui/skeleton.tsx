import * as React from "react";
import { cn } from "@/lib/utils/helpers";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-lg bg-gradient-to-r from-zinc-800/50 via-zinc-800 to-zinc-800/50 bg-[length:200%_100%] relative overflow-hidden', className)}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
    </div>
  );
}

export { Skeleton };
