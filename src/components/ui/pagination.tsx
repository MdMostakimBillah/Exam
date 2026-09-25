import * as React from "react";
import { cn } from "@/lib/utils/helpers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  if (totalPages <= 1) return null;
  const isBn = lang === "bn";
  return (
    <div className={cn("flex items-center justify-between py-4", className)}>
      <p className={cn("text-xs", theme === "dark" ? "text-zinc-400" : "text-zinc-600")}>
        {isBn ? "পৃষ্ঠা" : "Page"} <span className="font-medium">{currentPage}</span> {isBn ? "/" : "of"} <span>{totalPages}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="h-8 w-8" aria-label={isBn ? "আগের পৃষ্ঠা" : "Previous page"}>
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
              aria-label={isBn ? `পৃষ্ঠা ${page}` : `Page ${page}`}
            >
              {page}
            </Button>
          );
        })}
        <Button variant="ghost" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="h-8 w-8" aria-label={isBn ? "পরের পৃষ্ঠা" : "Next page"}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { Pagination };
