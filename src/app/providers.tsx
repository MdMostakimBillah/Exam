"use client";
import { ReactNode } from "react";
import { LangProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { QueryProvider } from "@/lib/query-provider";
import { AccentColor } from "@/components/branding/accent-color";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AccentColor />
      <AuthProvider>
        <ThemeProvider>
          <LangProvider>
            <ToastProvider>{children}</ToastProvider>
          </LangProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
