import * as React from "react";
import { cn, getInitials } from "@/lib/utils/helpers";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

function Avatar({ className, name, src, size = 'md', ...props }: AvatarProps) {
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-sm' };
  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-zinc-700 dark:to-zinc-800',
        'transition-all duration-200',
        sizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="aspect-square h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-gray-600 dark:text-zinc-300 bg-transparent">
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

export { Avatar };
