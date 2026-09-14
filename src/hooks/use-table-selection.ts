"use client";
import { useState, useCallback, useMemo } from "react";

export function useTableSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCount = selectedIds.size;

  const allSelected = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const someSelected = useMemo(() => {
    if (selectedIds.size === 0) return false;
    return !allSelected && items.some((item) => selectedIds.has(item.id));
  }, [items, selectedIds, allSelected]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.every((item) => prev.has(item.id))) {
        return new Set();
      }
      return new Set(items.map((item) => item.id));
    });
  }, [items]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const getSelectedItems = useCallback(
    <K extends keyof T>(fields: K[]): Pick<T, K>[] => {
      return items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => {
          const obj = {} as Pick<T, K>;
          fields.forEach((f) => { obj[f] = item[f]; });
          return obj;
        });
    },
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
    isSelected,
    getSelectedItems,
  };
}
