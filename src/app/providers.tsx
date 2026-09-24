"use client";
import { ReactNode } from "react";
import { LangProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider, useAuth } from "@/lib/auth/auth-provider";
import { QueryProvider } from "@/lib/query-provider";
import { AccentColor } from "@/components/branding/accent-color";
import { useExamsRealtimeSync } from "@/lib/storage/exams";

/** App-wide live exam sync: status changes made by the super admin appear
 *  on every signed-in institution's screen immediately (no reload). */
function ExamsLiveSync() {
  const { user } = useAuth();
  useExamsRealtimeSync(!!user);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AccentColor />
      <AuthProvider>
        <ExamsLiveSync />
        <ThemeProvider>
          <LangProvider>
            <ToastProvider>{children}</ToastProvider>
          </LangProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
