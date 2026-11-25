"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Shield, Info, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useClasses } from "@/lib/storage/classes";
import {
  type MarkEntryRollRange,
  normalizeRollDigits,
  normalizeRollRangePair,
  normalizeRollRanges,
} from "@/lib/marks/roll-range";
import type { Institution } from "@/lib/types";

interface ManageRollRangesModalProps {
  open: boolean;
  onClose: () => void;
  institution: Institution | null;
  onSave: (ranges: MarkEntryRollRange[]) => Promise<void> | void;
  isDark: boolean;
  isBn: boolean;
  saving?: boolean;
}

export function ManageRollRangesModal({
  open,
  onClose,
  institution,
  onSave,
  isDark,
  isBn,
  saving = false,
}: ManageRollRangesModalProps) {
  const bi = (bn: string, en: string) => (isBn ? bn : en);
  const { data: classes = [] } = useClasses();

  const [ranges, setRanges] = useState<MarkEntryRollRange[]>([]);

  useEffect(() => {
    if (open && institution) {
      const existing = normalizeRollRanges(institution.markEntryRollRanges);
      if (existing.length > 0) {
        setRanges(existing);
      } else if (institution.markEntryRollFrom || institution.markEntryRollTo) {
        setRanges([
          {
            id: `init-${Date.now()}`,
            from: institution.markEntryRollFrom ?? "",
            to: institution.markEntryRollTo ?? "",
          },
        ]);
      } else {
        setRanges([]);
      }
    }
  }, [open, institution]);

  if (!institution) return null;

  const handleAddRange = () => {
    setRanges((prev) => [
      ...prev,
      {
        id: `rng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        classId: "",
        className: "",
        from: "",
        to: "",
      },
    ]);
  };

  const handleRemoveRange = (index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateField = (
    index: number,
    field: "classId" | "from" | "to",
    value: string,
  ) => {
    setRanges((prev) => {
      const next = [...prev];
      const target = { ...next[index] };
      if (field === "classId") {
        target.classId = value || undefined;
        const matched = classes.find((c) => c.id === value);
        target.className = matched?.name || undefined;
      } else if (field === "from" || field === "to") {
        target[field] = normalizeRollDigits(value);
      }
      next[index] = target;
      return next;
    });
  };

  const handleSave = async () => {
    // Normalize and filter valid ranges
    const cleaned = ranges
      .map((r) => {
        const pair = normalizeRollRangePair(r.from, r.to);
        const matched = classes.find((c) => c.id === r.classId);
        return {
          id: r.id,
          classId: r.classId || undefined,
          className: matched?.name || r.className || undefined,
          from: pair.from ?? "",
          to: pair.to ?? "",
        };
      })
      .filter((r) => r.from !== "" || r.to !== "");

    await onSave(cleaned);
    onClose();
  };

  const inputClass = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-brand-accent/50"
    : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-brand-accent";

  const selectClass = isDark
    ? "bg-[#18181b] border-white/[0.08] text-white focus:border-brand-accent/50"
    : "bg-white border-zinc-200 text-zinc-900 focus:border-brand-accent";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bi("নম্বর প্রবেশের রোল রেঞ্জসমূহ", "Mark Entry Roll Ranges")}
      description={bi(
        `${isBn ? institution.name : (institution.nameEn || institution.name)} (${institution.code})-এর জন্য একাধিক শ্রেণিভিত্তিক বা সাধারণ রোল রেঞ্জ সেট করুন।`,
        `Configure class-specific or general roll ranges for ${institution.nameEn || institution.name} (${institution.code}).`,
      )}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 py-2">
        {/* Info banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-brand-accent/20 bg-brand-accent/5 p-3 text-xs text-brand-accent-fg/90">
          <Info className="h-4 w-4 shrink-0 text-brand-accent mt-0.5" />
          <p className="leading-relaxed">
            {bi(
              "প্রতিটি শ্রেণির জন্য আলাদা রোল রেঞ্জ নির্ধারণ করতে পারেন। প্রতিষ্ঠান যখন মার্ক এন্ট্রিতে শ্রেণি নির্বাচন করবে, তখন স্বয়ংক্রিয়ভাবে সেই শ্রেণির রোল রেঞ্জ পূরণ হবে।",
              "You can configure separate roll ranges for each class. When the institution selects a class on the mark entry page, it will automatically auto-fill with that class's roll range.",
            )}
          </p>
        </div>

        {/* Ranges list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {bi("নির্ধারিত রোল রেঞ্জের তালিকা", "Configured Roll Ranges")} ({ranges.length})
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddRange}
              className="h-7 text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {bi("রেঞ্জ যোগ করুন", "Add Range")}
            </Button>
          </div>

          {ranges.length === 0 ? (
            <div
              className={`rounded-lg border border-dashed p-6 text-center text-xs ${
                isDark ? "border-white/[0.08] text-zinc-500" : "border-zinc-200 text-zinc-400"
              }`}
            >
              <Shield className="mx-auto mb-2 h-6 w-6 opacity-40" />
              <p className="font-medium">
                {bi("কোনো রোল রেঞ্জ নির্ধারিত নেই", "No roll ranges configured")}
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                {bi(
                  "ফাঁকা থাকলে সকল রোল অনুমোদিত থাকবে। নির্দিষ্ট সীমা দিতে '+ রেঞ্জ যোগ করুন' বাটনে ক্লিক করুন।",
                  "All rolls are permitted by default. Click '+ Add Range' to restrict by class or roll numbers.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {ranges.map((range, index) => (
                <div
                  key={range.id || index}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                    isDark
                      ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                      : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300"
                  }`}
                >
                  {/* Class selector */}
                  <div className="flex-1 min-w-[140px]">
                    <label className={`block text-[10px] mb-1 font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {bi("শ্রেণি (Class)", "Class")}
                    </label>
                    <select
                      value={range.classId || ""}
                      onChange={(e) => handleUpdateField(index, "classId", e.target.value)}
                      className={`h-8 w-full rounded-md px-2 text-xs border ${selectClass}`}
                    >
                      <option value="">{bi("সকল শ্রেণি (All Classes)", "All Classes")}</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} {cls.code ? `(${cls.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* From Roll */}
                  <div className="w-28">
                    <label className={`block text-[10px] mb-1 font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {bi("শুরুর রোল", "From Roll")}
                    </label>
                    <Input
                      value={range.from}
                      onChange={(e) => handleUpdateField(index, "from", e.target.value)}
                      placeholder={bi("শুরু", "From")}
                      inputMode="numeric"
                      className={`h-8 text-center text-xs font-mono ${inputClass}`}
                    />
                  </div>

                  <span className={`self-end mb-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    →
                  </span>

                  {/* To Roll */}
                  <div className="w-28">
                    <label className={`block text-[10px] mb-1 font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {bi("শেষ রোল", "To Roll")}
                    </label>
                    <Input
                      value={range.to}
                      onChange={(e) => handleUpdateField(index, "to", e.target.value)}
                      placeholder={bi("শেষ", "To")}
                      inputMode="numeric"
                      className={`h-8 text-center text-xs font-mono ${inputClass}`}
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="self-end mb-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveRange(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      title={bi("মুছুন", "Delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        {ranges.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRanges([])}
            className="mr-auto text-xs text-zinc-500"
            disabled={saving}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {bi("সকল রেঞ্জ পরিষ্কার করুন", "Clear all ranges")}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          {bi("বাতিল", "Cancel")}
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          isLoading={saving}
          className="flex items-center gap-1.5"
        >
          <Check className="h-4 w-4" />
          {bi("সংরক্ষণ করুন", "Save Ranges")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
