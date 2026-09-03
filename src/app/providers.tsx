"use client";
import { ReactNode } from "react";
import { LangProvider } from "@/contexts/language-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>{children}</ToastProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
