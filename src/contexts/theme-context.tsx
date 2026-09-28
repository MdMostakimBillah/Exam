"use client";
import * as React from "react";
import { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/client";

// Runs before the browser paints on the client, is a plain effect during SSR
// (no "useLayoutEffect does nothing on the server" warning).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Signed-out choice (login / landing page toggle). Same `scholarx-theme-`
 *  prefix getInitialTheme() scans, so a guest pick survives reloads. */
const GUEST_STORAGE_KEY = "scholarx-theme-guest";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Native form controls (date/time pickers) follow `color-scheme`, NOT the
  // .dark class — without this, dark mode draws black picker icons on dark inputs.
  root.style.colorScheme = theme;
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

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  // Check localStorage first for immediate theme (avoids flash)
  try {
    const keys = Object.keys(localStorage);
    const themeKey = keys.find(k => k.startsWith('scholarx-theme-'));
    if (themeKey) {
      const stored = localStorage.getItem(themeKey) as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
    }
  } catch {}
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // SSR can't see localStorage, so the server always renders dark — the
  // FIRST client render must be dark too, or every page hydrates with a
  // theme mismatch (React regenerates the whole tree: console error + a
  // duplicate render on each load). The stored preference is applied in a
  // layout effect below, which runs BEFORE the first paint, so a light
  // theme still appears instantly with no flash.
  const [theme, setThemeState] = useState<Theme>("dark");

  // Apply theme immediately on mount
  useIsomorphicLayoutEffect(() => {
    const stored = getInitialTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Not logged in: default dark, but keep the guest's explicit choice —
      // the login/landing theme toggle must stick across reloads instead of
      // being stomped back to dark on every auth-state change.
      const guest = getInitialTheme();
      setThemeState(guest);
      applyTheme(guest);
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
      } else {
        localStorage.setItem(GUEST_STORAGE_KEY, newTheme);
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
    } else {
      localStorage.setItem(GUEST_STORAGE_KEY, t);
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
