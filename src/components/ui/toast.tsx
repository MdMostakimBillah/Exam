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

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctxValue = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ToastList = React.memo(function ToastList({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  const colors = { success: 'text-emerald-400', error: 'text-red-400', warning: 'text-amber-400', info: 'text-blue-400' };
  const bgColors = { success: 'bg-emerald-500/10', error: 'bg-red-500/10', warning: 'bg-amber-500/10', info: 'bg-blue-500/10' };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(t => {
        const Icon = icons[t.type];
        return (
          <ToastItem key={t.id} t={t} Icon={Icon} colors={colors} bgColors={bgColors} dismiss={dismiss} />
        );
      })}
    </div>
  );
});

const ToastItem = React.memo(function ToastItem({
  t,
  Icon,
  colors,
  bgColors,
  dismiss,
}: {
  t: Toast;
  Icon: React.ElementType;
  colors: Record<string, string>;
  bgColors: Record<string, string>;
  dismiss: (id: string) => void;
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-md px-5 py-4 shadow-2xl animate-slideInRight backdrop-blur-xl min-w-[300px]',
      'border border-white/[0.06] bg-[#0D0D0D] shadow-black/40',
      'dark:border-white/[0.06] dark:bg-[#0D0D0D]',
    )}>
      <div className={cn('rounded-md p-1.5', bgColors[t.type])}>
        <Icon className={cn('h-4 w-4 shrink-0', colors[t.type])} />
      </div>
      <span className="text-sm flex-1 text-zinc-200">{t.message}</span>
      <button onClick={() => dismiss(t.id)} className="ml-2 rounded-md p-1 transition-all text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.05]">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
