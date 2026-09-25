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

  const dialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (focusable || dialogRef.current)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center", overlayPadding)}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
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
            {title && <h2 id={titleId} className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{title}</h2>}
            {description && <p id={descriptionId} className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className={`rounded-md p-1.5 transition-all ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}>
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
