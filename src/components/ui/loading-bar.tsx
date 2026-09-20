"use client";

interface LoadingBarProps {
  isLoading: boolean;
}

export function LoadingBar({ isLoading }: LoadingBarProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px]">
      <div className="h-full animate-loadingBar bg-zinc-900 dark:bg-white" />
    </div>
  );
}
