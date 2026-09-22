"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { X } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  width?: string;
  height?: string;
  overlayPadding?: string;
  containerClassName?: string;
  headerClassName?: string;
}

function Modal({ open, onClose, title, description, children, maxWidth = 'max-w-lg', maxHeight = 'max-h-[90vh]', width, height, overlayPadding = 'p-4', containerClassName, headerClassName }: ModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const resolvedMaxWidth = maxWidth ?? (width ? 'max-w-none' : 'max-w-lg');
  const resolvedHeight = height ?? maxHeight ?? 'max-h-[90vh]';

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center", overlayPadding)}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className={cn(
        'relative z-50 w-full rounded-md p-6 shadow-2xl animate-scaleIn backdrop-blur-xl flex flex-col overflow-hidden',
        isDark
          ? 'border border-white/[0.06] bg-[#0D0D0D] shadow-black/50'
          : 'border border-zinc-200 bg-white shadow-zinc-200/50',
        resolvedMaxWidth,
        resolvedHeight,
        width,
        containerClassName
      )}>
        <div className={cn("flex items-start justify-between mb-5 shrink-0", headerClassName)}>
          <div>
            {title && <h2 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{title}</h2>}
            {description && <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{description}</p>}
          </div>
          <button onClick={onClose} className={`rounded-md p-1.5 transition-all ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={cn('flex justify-end gap-2 mt-6 pt-5 border-t sticky bottom-0 -mb-6 -mx-6 px-6 pb-6', isDark ? 'border-white/[0.06] bg-[#0D0D0D]' : 'border-zinc-200 bg-white', className)}>
      {children}
    </div>
  );
}

export { Modal, ModalFooter };
