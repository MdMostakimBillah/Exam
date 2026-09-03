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
  children: React.ReactNode;
  className?: string;
}

function Tabs({ defaultValue, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);
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
    <div className={cn('flex border-b -mb-px', isDark ? 'border-white/[0.04]' : 'border-zinc-200', className)}>
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

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { activeTab } = React.useContext(TabsContext);
  if (activeTab !== value) return null;
  return <div className={cn('py-5 animate-fadeIn', className)}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
