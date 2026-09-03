import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { FileX } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center animate-fadeIn", className)}>
      <div className="rounded-2xl bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 p-4 mb-5 border border-white/[0.04]">
        {icon || <FileX className="h-6 w-6 text-zinc-500" />}
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-2">{title}</h3>
      <p className="text-xs text-zinc-600 max-w-sm mb-6 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

export { EmptyState };
