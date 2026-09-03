import * as React from "react";
import { Modal, ModalFooter } from "./modal";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  variant?: 'destructive' | 'default';
}

function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = 'Confirm', variant = 'destructive' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-4">
        <div className="rounded-lg bg-red-500/20 p-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
        </div>
        <p className="text-xs text-red-300">This action cannot be undone.</p>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmText}</Button>
      </ModalFooter>
    </Modal>
  );
}

export { ConfirmDialog };
