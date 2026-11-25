import type { MarkEntryRollRange } from "@/lib/types";

export type { MarkEntryRollRange };

/**
 * Pure helpers for numeric exam-roll range normalization, clamping, and display.
 *
 * Used by both Super Admin permission configuration (setting each institution's
 * allowed mark-entry roll range) and `MarksEntryPanel` (clamping requested
 * filters to the institution's permitted range).
 */

export interface NormalizedRollRange {
  from: string | null;
  to: string | null;
  swapped: boolean;
}

export interface ClampedRollRange {
  rollFrom: string;
  rollTo: string;
  outOfRange: boolean;
  hasAllowedBounds: boolean;
}

/** Keep ASCII digits only; empty input becomes an empty string. */
export function normalizeRollDigits(value?: string | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Normalize an optional `(from, to)` exam-roll pair.
 * Strips non-digits and swaps bounds if both exist and `from > to`.
 */
export function normalizeRollRangePair(
  from?: string | null,
  to?: string | null,
): NormalizedRollRange {
  const cleanFrom = normalizeRollDigits(from) || null;
  const cleanTo = normalizeRollDigits(to) || null;

  if (cleanFrom && cleanTo && BigInt(cleanFrom) > BigInt(cleanTo)) {
    return { from: cleanTo, to: cleanFrom, swapped: true };
  }

  return { from: cleanFrom, to: cleanTo, swapped: false };
}

/**
 * Intersect a user-requested filter `(requestedFrom, requestedTo)` with the
 * institution's permitted bounds `(allowedFrom, allowedTo)`.
 *
 * Note: `outOfRange` is true only when the user explicitly enters a range that
 * has zero overlap with the permitted bounds.
 */
export function clampRollRangeToBounds(
  requestedFrom?: string | null,
  requestedTo?: string | null,
  allowedFrom?: string | null,
  allowedTo?: string | null,
): ClampedRollRange {
  const req = normalizeRollRangePair(requestedFrom, requestedTo);
  const allowed = normalizeRollRangePair(allowedFrom, allowedTo);
  const hasAllowedBounds = Boolean(allowed.from || allowed.to);

  if (!hasAllowedBounds) {
    return {
      rollFrom: req.from ?? "",
      rollTo: req.to ?? "",
      outOfRange: false,
      hasAllowedBounds: false,
    };
  }

  let effectiveFrom = allowed.from ?? "";
  if (req.from) {
    effectiveFrom =
      allowed.from && BigInt(allowed.from) > BigInt(req.from)
        ? allowed.from
        : req.from;
  }

  let effectiveTo = allowed.to ?? "";
  if (req.to) {
    effectiveTo =
      allowed.to && BigInt(allowed.to) < BigInt(req.to)
        ? allowed.to
        : req.to;
  }

  const outOfRange =
    Boolean(effectiveFrom) &&
    Boolean(effectiveTo) &&
    BigInt(effectiveFrom) > BigInt(effectiveTo);

  return {
    rollFrom: effectiveFrom,
    rollTo: effectiveTo,
    outOfRange,
    hasAllowedBounds: true,
  };
}

/** Bilingual human-readable summary of an optional roll-number range. */
export function formatRollRangeLabel(
  from?: string | null,
  to?: string | null,
  isBn = false,
): string {
  const norm = normalizeRollRangePair(from, to);
  if (norm.from && norm.to) return `${norm.from} – ${norm.to}`;
  if (norm.from) return isBn ? `${norm.from}+ থেকে` : `From ${norm.from}+`;
  if (norm.to) return isBn ? `০ – ${norm.to}` : `Up to ${norm.to}`;
  return isBn ? "সকল রোল" : "All rolls";
}

/**
 * Sanitize and normalize an array of mark entry roll ranges.
 * Strips non-digits, swaps inverted from/to, and generates IDs if missing.
 */
export function normalizeRollRanges(
  ranges?: MarkEntryRollRange[] | null,
): MarkEntryRollRange[] {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .map((r, idx) => {
      const pair = normalizeRollRangePair(r.from, r.to);
      const cleanClassId = r.classId ? String(r.classId).trim() : "";
      const cleanClassName = r.className ? String(r.className).trim() : "";
      return {
        id: r.id || `rng-${idx + 1}-${Date.now().toString(36)}`,
        classId: cleanClassId || undefined,
        className: cleanClassName || undefined,
        from: pair.from ?? "",
        to: pair.to ?? "",
      };
    })
    .filter((r) => r.from !== "" || r.to !== "");
}

/**
 * Find ranges applicable to a specific class (by class ID, code, or name).
 * If specific class ranges exist, returns them.
 * Otherwise falls back to general ranges (ranges with no class assigned).
 */
export function findMatchingRollRanges(
  ranges?: MarkEntryRollRange[] | null,
  classId?: string | null,
  className?: string | null,
): MarkEntryRollRange[] {
  if (!ranges || ranges.length === 0) return [];
  const normalized = normalizeRollRanges(ranges);

  if (classId || className) {
    const classMatches = normalized.filter((r) => {
      if (!r.classId && !r.className) return false;
      return (
        (classId && (r.classId === classId || r.className === classId)) ||
        (className && (r.className === className || r.classId === className))
      );
    });
    if (classMatches.length > 0) return classMatches;
  }

  // Fallback to general ranges (unassigned to a specific class)
  return normalized.filter((r) => !r.classId && !r.className);
}

/**
 * Human-readable bilingual summary for multiple roll ranges.
 */
export function formatMultipleRollRangesLabel(
  ranges?: MarkEntryRollRange[] | null,
  fallbackFrom?: string | null,
  fallbackTo?: string | null,
  isBn = false,
): string {
  const normRanges = normalizeRollRanges(ranges);
  if (normRanges.length > 0) {
    if (normRanges.length === 1) {
      const r = normRanges[0];
      const prefix = r.className ? `${r.className}: ` : "";
      return prefix + formatRollRangeLabel(r.from, r.to, isBn);
    }
    return isBn
      ? `${normRanges.length}টি রোল রেঞ্জ নির্ধারিত`
      : `${normRanges.length} roll ranges configured`;
  }
  return formatRollRangeLabel(fallbackFrom, fallbackTo, isBn);
}
