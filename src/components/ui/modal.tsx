import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

function Modal({ open, onClose, title, description, children, maxWidth = 'max-w-lg' }: ModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className={cn(
        'relative z-50 w-full rounded-2xl border border-white/[0.06] bg-[#0D0D0D] p-6 shadow-2xl shadow-black/50 animate-scaleIn',
        'backdrop-blur-xl',
        maxWidth
      )}>
        <div className="flex items-start justify-between mb-5">
          <div>
            {title && <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>}
            {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-2 mt-6 pt-5 border-t border-white/[0.06]', className)}>
      {children}
    </div>
  );
}

export { Modal, ModalFooter };
