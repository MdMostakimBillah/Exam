"use client";
import { createContext, useContext, useCallback, useEffect, useSyncExternalStore, ReactNode } from "react";
import translations from "@/lib/i18n/translations.json";

type Lang = "en" | "bn";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

function getNestedValue(obj: unknown, path: string): string | Record<string, string> | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current as string | Record<string, string> | undefined;
}

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  return (localStorage.getItem("scholarx-lang") as Lang) || "en";
}

function subscribe(callback: () => void) {
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
  }
  return () => {};
}

function getSnapshot(): Lang {
  return getStoredLang();
}

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, () => "en" as Lang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("lang-bn", lang === "bn");
      document.body.classList.toggle("lang-bn", lang === "bn");
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("scholarx-lang", l);
    window.dispatchEvent(new Event("storage"));
  }, []);

  const t = useCallback(
    (key: string): string => {
      const val = getNestedValue(translations, key);
      if (val && typeof val === "object" && lang in val) {
        return (val as Record<string, string>)[lang];
      }
      if (typeof val === "string") return val;
      return key;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
