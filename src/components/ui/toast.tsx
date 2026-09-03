"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: string; type: ToastType; message: string; }

const ToastContext = React.createContext<{
  toast: (type: ToastType, message: string) => void;
}>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  const colors = { success: 'text-emerald-400', error: 'text-red-400', warning: 'text-amber-400', info: 'text-blue-400' };
  const bgColors = { success: 'bg-emerald-500/10', error: 'bg-red-500/10', warning: 'bg-amber-500/10', info: 'bg-blue-500/10' };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={cn(
              'flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0D0D0D] px-5 py-4 shadow-2xl shadow-black/40 animate-slideInRight',
              'backdrop-blur-xl min-w-[300px]'
            )}>
              <div className={cn('rounded-lg p-1.5', bgColors[t.type])}>
                <Icon className={cn('h-4 w-4 shrink-0', colors[t.type])} />
              </div>
              <span className="text-sm text-zinc-200 flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-2 rounded-lg p-1 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05] transition-all">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
