import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className={cn("flex items-center justify-between py-4", className)}>
      <p className="text-xs text-zinc-600">
        Page <span className="text-zinc-400 font-medium">{currentPage}</span> of <span className="text-zinc-400 font-medium">{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) page = i + 1;
          else if (currentPage <= 3) page = i + 1;
          else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
          else page = currentPage - 2 + i;
          return (
            <Button
              key={page}
              variant={page === currentPage ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 text-xs"
            >
              {page}
            </Button>
          );
        })}
        <Button variant="ghost" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { Pagination };
