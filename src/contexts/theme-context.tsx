"use client";
import * as React from "react";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
    document.body.classList.remove("dark");
    document.body.classList.add("light");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
    document.body.classList.remove("light");
    document.body.classList.add("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [theme, setThemeState] = useState<Theme>("dark");

  // Load theme when user changes (login/logout)
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Logged in: try localStorage first, then Supabase profile
      const storageKey = `scholarx-theme-${user.id}`;
      const stored = localStorage.getItem(storageKey) as Theme | null;
      if (stored) {
        setThemeState(stored);
        applyTheme(stored);
      } else {
        // Load from Supabase profile
        const supabase = createClient();
        supabase.from("profiles").select("theme").eq("id", user.id).single()
          .then(({ data }: { data: { theme: string | null } | null }) => {
            const dbTheme = (data?.theme as Theme) || "dark";
            setThemeState(dbTheme);
            applyTheme(dbTheme);
            localStorage.setItem(storageKey, dbTheme);
          });
      }
    } else {
      // Not logged in: use default
      setThemeState("dark");
      applyTheme("dark");
    }
  }, [user, authLoading]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark";
      applyTheme(newTheme);

      if (user) {
        const storageKey = `scholarx-theme-${user.id}`;
        localStorage.setItem(storageKey, newTheme);
        // Persist to Supabase
        const supabase = createClient();
        supabase.from("profiles").update({ theme: newTheme }).eq("id", user.id).then();
      }

      return newTheme;
    });
  }, [user]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);

    if (user) {
      const storageKey = `scholarx-theme-${user.id}`;
      localStorage.setItem(storageKey, t);
      const supabase = createClient();
      supabase.from("profiles").update({ theme: t }).eq("id", user.id).then();
    }
  }, [user]);

  const value = React.useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
