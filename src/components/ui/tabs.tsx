"use client";
import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { useTheme } from "@/contexts/theme-context";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({ activeTab: '', setActiveTab: () => {} });

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internalTab, setInternalTab] = React.useState(defaultValue);
  const activeTab = value ?? internalTab;
  const setActiveTab = (tab: string) => {
    if (value === undefined) setInternalTab(tab);
    onValueChange?.(tab);
  };
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div role="tablist" className={cn('flex border-b -mb-px', isDark ? 'border-white/[0.04]' : 'border-zinc-200', className)}>
      {children}
    </div>
  );
}

function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      aria-controls={`tabpanel-${value}`}
      aria-selected={activeTab === value}
      tabIndex={activeTab === value ? 0 : -1}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') || []);
        if (tabs.length === 0) return;
        const currentIndex = tabs.indexOf(event.currentTarget);
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }}
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px relative',
        activeTab === value
          ? isDark ? 'border-white text-zinc-100' : 'border-zinc-900 text-zinc-900'
          : isDark ? 'border-transparent text-zinc-500 hover:text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-700',
        className
      )}
    >
      {children}
      {activeTab === value && (
        <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent ${isDark ? 'via-white/50' : 'via-zinc-900/50'} to-transparent`} />
      )}
    </button>
  );
}

function TabsContent({ value, children, className, keepMounted = false }: { value: string; children: React.ReactNode; className?: string; keepMounted?: boolean }) {
  const { activeTab } = React.useContext(TabsContext);
  const active = activeTab === value;
  if (!active && !keepMounted) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!active}
      className={cn('py-5 animate-fadeIn', className)}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
