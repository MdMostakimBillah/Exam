"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  ExternalLink,
  KeyRound,
  Lock,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { formatRollRangeLabel, normalizeRollDigits, normalizeRollRangePair } from "@/lib/marks/roll-range";
import {
  useInstitutionName,
  useInstitutions,
  useUpdateInstitution,
} from "@/lib/storage/institutions";
import type { Institution } from "@/lib/types";

interface DraftRange {
  from: string;
  to: string;
}

/**
 * Super-admin manager for institution mark-entry permissions (`allow_mark_entry`,
 * `mark_entry_roll_from`, `mark_entry_roll_to` from migration 0043).
 *
 * Lets the super admin enable/disable blind mark entry across all active
 * institutions from one place and assign the allowed numeric exam-roll range
 * for each institution.
 */
export function MarkEntryPermissionsPanel() {
  const { theme } = useTheme();
  const { lang } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = lang === "bn";
  const bi = (bn: string, en: string) => (isBn ? bn : en);

  const { data: institutions = [], isLoading } = useInstitutions();
  const updateInstitution = useUpdateInstitution();
  const instName = useInstitutionName();

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftRange>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDisableAll, setConfirmDisableAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const activeInstitutions = useMemo(
    () =>
      institutions
        .filter((inst) => inst.status === "ACTIVE")
        .sort((a, b) => a.code.localeCompare(b.code)),
    [institutions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeInstitutions;
    return activeInstitutions.filter((inst) =>
      [inst.name, inst.nameEn, inst.code, inst.district]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [activeInstitutions, search]);

  const counts = useMemo(() => {
    let permitted = 0;
    let restricted = 0;
    for (const inst of activeInstitutions) {
      if (inst.allowMarkEntry) permitted++;
      else restricted++;
    }
    return { total: activeInstitutions.length, permitted, restricted };
  }, [activeInstitutions]);

  const getDraft = (inst: Institution): DraftRange =>
    drafts[inst.id] ?? {
      from: inst.markEntryRollFrom ?? "",
      to: inst.markEntryRollTo ?? "",
    };

  const setDraftField = (inst: Institution, field: "from" | "to", raw: string) => {
    const clean = normalizeRollDigits(raw);
    setDrafts((prev) => ({
      ...prev,
      [inst.id]: {
        ...getDraft(inst),
        ...(prev[inst.id] ?? {}),
        [field]: clean,
      },
    }));
  };

  const hasDirtyRange = (inst: Institution): boolean => {
    const draft = drafts[inst.id];
    if (!draft) return false;
    return (
      normalizeRollDigits(draft.from) !== normalizeRollDigits(inst.markEntryRollFrom) ||
      normalizeRollDigits(draft.to) !== normalizeRollDigits(inst.markEntryRollTo)
    );
  };

  const handleToggle = async (inst: Institution, next: boolean) => {
    const draft = getDraft(inst);
    const normalized = normalizeRollRangePair(draft.from, draft.to);
    setSavingId(inst.id);
    try {
      await updateInstitution.mutateAsync({
        id: inst.id,
        data: {
          allowMarkEntry: next,
          markEntryRollFrom: normalized.from,
          markEntryRollTo: normalized.to,
        },
      });
      setDrafts((prev) => {
        const nextDrafts = { ...prev };
        delete nextDrafts[inst.id];
        return nextDrafts;
      });
      toast(
        "success",
        next
          ? bi("নম্বর প্রবেশের অনুমতি চালু হয়েছে", "Mark entry enabled")
          : bi("নম্বর প্রবেশের অনুমতি বন্ধ করা হয়েছে", "Mark entry restricted"),
      );
    } catch (err) {
      toast(
        "error",
        err instanceof Error ? err.message : bi("সংরক্ষণ ব্যর্থ", "Save failed"),
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveRange = async (inst: Institution, clear = false) => {
    const draft = getDraft(inst);
    const normalized = clear
      ? { from: null, to: null, swapped: false }
      : normalizeRollRangePair(draft.from, draft.to);
    setSavingId(inst.id);
    try {
      await updateInstitution.mutateAsync({
        id: inst.id,
        data: {
          markEntryRollFrom: normalized.from,
          markEntryRollTo: normalized.to,
        },
      });
      setDrafts((prev) => {
        const nextDrafts = { ...prev };
        delete nextDrafts[inst.id];
        return nextDrafts;
      });
      toast(
        "success",
        clear
          ? bi("রোল রেঞ্জ মুছে ফেলা হয়েছে (সকল রোল অনুমোদিত)", "Roll range cleared (all rolls allowed)")
          : `${bi("রোল রেঞ্জ সংরক্ষিত", "Roll range saved")}: ${formatRollRangeLabel(normalized.from, normalized.to, isBn)}`,
      );
    } catch (err) {
      toast(
        "error",
        err instanceof Error ? err.message : bi("সংরক্ষণ ব্যর্থ", "Save failed"),
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleRestrictAll = async () => {
    const enabled = activeInstitutions.filter((inst) => inst.allowMarkEntry);
    if (enabled.length === 0) {
      setConfirmDisableAll(false);
      return;
    }
    setBulkBusy(true);
    try {
      await Promise.all(
        enabled.map((inst) =>
          updateInstitution.mutateAsync({
            id: inst.id,
            data: { allowMarkEntry: false },
          }),
        ),
      );
      toast(
        "success",
        bi(
          `${enabled.length}টি প্রতিষ্ঠানের নম্বর প্রবেশ বন্ধ করা হয়েছে`,
          `Restricted mark entry for ${enabled.length} institution(s)`,
        ),
      );
      setConfirmDisableAll(false);
    } catch (err) {
      toast(
        "error",
        err instanceof Error ? err.message : bi("সংরক্ষণ ব্যর্থ", "Update failed"),
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const card = isDark
    ? "rounded-xl border border-white/[0.06] bg-[#141416]"
    : "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
  const borderClass = isDark ? "border-white/[0.06]" : "border-zinc-100";
  const mutedClass = "text-zinc-500";
  const headingClass = isDark ? "text-white" : "text-zinc-900";
  const inputClass = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
    : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400";

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: Building2,
            label: bi("সক্রিয় প্রতিষ্ঠান", "Active institutions"),
            value: counts.total,
          },
          {
            icon: Unlock,
            label: bi("অনুমোদিত", "Permitted"),
            value: counts.permitted,
          },
          {
            icon: Lock,
            label: bi("সীমাবদ্ধ (বন্ধ)", "Restricted (off)"),
            value: counts.restricted,
          },
        ].map((item) => (
          <div key={item.label} className={`${card} flex items-center gap-3 px-4 py-3`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-brand-accent">
              <item.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-bold leading-tight ${headingClass}`}>{item.value}</p>
              <p className={`text-[11px] ${mutedClass}`}>{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls & table */}
      <div className={card}>
        <div className={`flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${borderClass}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-brand-accent">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${headingClass}`}>
                {bi("প্রতিষ্ঠানভিত্তিক নম্বর প্রবেশ ও রোল রেঞ্জ", "Institution mark entry & permitted roll range")}
              </h3>
              <p className={`text-[11px] ${mutedClass}`}>
                {bi(
                  "ডিফল্টভাবে সকল প্রতিষ্ঠানের নম্বর প্রবেশ বন্ধ থাকে। অনুমতি দিলে ঐ প্রতিষ্ঠান কেবল নির্ধারিত রোল রেঞ্জের মধ্যে (নিজ প্রতিষ্ঠান বাদে) নম্বর দিতে পারবে।",
                  "Mark entry is disabled by default for every institution. Grant access per institution and optionally limit which roll range they can mark (blind marking).",
                )}
              </p>
            </div>
          </div>
          {counts.permitted > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setConfirmDisableAll(true)}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {bi("সব বন্ধ করুন", "Restrict all")}
            </Button>
          )}
        </div>

        <div className={`border-b px-5 py-3 ${borderClass}`}>
          <div className="relative max-w-sm">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedClass}`} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={bi("প্রতিষ্ঠানের নাম বা কোড খুঁজুন...", "Search institution name or code...")}
              className={`pl-9 ${inputClass}`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className={`p-10 text-center text-sm ${mutedClass}`}>
            {bi("প্রতিষ্ঠান লোড হচ্ছে...", "Loading institutions...")}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`p-10 text-center text-sm ${mutedClass}`}>
            {bi("কোনো সক্রিয় প্রতিষ্ঠান পাওয়া যায়নি", "No active institutions found")}
          </div>
        ) : (
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("প্রতিষ্ঠান", "Institution")}</TableHead>
                <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("অনুমতি", "Permission")}</TableHead>
                <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("অনুমোদিত রোল রেঞ্জ", "Permitted roll range")}</TableHead>
                <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("অবস্থা", "Status")}</TableHead>
                <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("কাজ", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => {
                const draft = getDraft(inst);
                const dirty = hasDirtyRange(inst);
                const busy = savingId === inst.id;
                const hasBounds = Boolean(inst.markEntryRollFrom || inst.markEntryRollTo);
                return (
                  <TableRow
                    key={inst.id}
                    className={isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/super-admin/institutions/${inst.id}`}
                            className={`inline-flex items-center gap-1.5 text-sm font-medium hover:underline ${headingClass}`}
                          >
                            <span className="truncate">{instName(inst.name, inst.id)}</span>
                            <ExternalLink className={`h-3 w-3 shrink-0 ${mutedClass}`} />
                          </Link>
                          <p className={`font-mono text-[10px] ${mutedClass}`}>{inst.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={inst.allowMarkEntry ?? false}
                          onCheckedChange={(next) => void handleToggle(inst, next)}
                          disabled={busy}
                          label={`${instName(inst.name, inst.id)} ${bi("নম্বর প্রবেশ", "mark entry")}`}
                        />
                        <span className={`text-xs ${mutedClass}`}>
                          {inst.allowMarkEntry ? bi("চালু", "On") : bi("বন্ধ", "Off")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={draft.from}
                          onChange={(e) => setDraftField(inst, "from", e.target.value)}
                          placeholder={bi("থেকে", "From")}
                          inputMode="numeric"
                          disabled={busy}
                          className={`h-8 w-28 text-center text-xs font-mono ${inputClass}`}
                          aria-label={`${inst.code} roll from`}
                        />
                        <span className={`text-xs ${mutedClass}`}>→</span>
                        <Input
                          value={draft.to}
                          onChange={(e) => setDraftField(inst, "to", e.target.value)}
                          placeholder={bi("পর্যন্ত", "To")}
                          inputMode="numeric"
                          disabled={busy}
                          className={`h-8 w-28 text-center text-xs font-mono ${inputClass}`}
                          aria-label={`${inst.code} roll to`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {inst.allowMarkEntry ? (
                        <Badge status="ACTIVE">
                          {formatRollRangeLabel(inst.markEntryRollFrom, inst.markEntryRollTo, isBn)}
                        </Badge>
                      ) : (
                        <Badge>{bi("বন্ধ", "Restricted")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={dirty ? "default" : "secondary"}
                          disabled={!dirty || busy}
                          onClick={() => void handleSaveRange(inst, false)}
                          isLoading={busy}
                        >
                          {dirty ? <Save className="mr-1 h-3.5 w-3.5" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                          {bi("সংরক্ষণ", "Save")}
                        </Button>
                        {hasBounds && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void handleSaveRange(inst, true)}
                            title={bi("রেঞ্জ মুছুন (সকল রোল)", "Clear range (all rolls)")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={confirmDisableAll}
        onClose={() => setConfirmDisableAll(false)}
        title={bi("সকল প্রতিষ্ঠানের নম্বর প্রবেশ বন্ধ করবেন?", "Restrict mark entry for all institutions?")}
        description={bi(
          "সব অনুমোদিত প্রতিষ্ঠানের নম্বর প্রবেশ তাৎক্ষণিক বন্ধ হবে, তবে নির্ধারিত রোল রেঞ্জ সংরক্ষিত থাকবে।",
          "Mark entry access will be disabled immediately for every permitted institution. Saved roll ranges will be preserved.",
        )}
        maxWidth="max-w-md"
      >
        <div className="flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{bi(`${counts.permitted}টি প্রতিষ্ঠান প্রভাবিত হবে।`, `${counts.permitted} institution(s) will be restricted.`)}</span>
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setConfirmDisableAll(false)}>
            {bi("বাতিল", "Cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleRestrictAll()} isLoading={bulkBusy}>
            {bi("বন্ধ করুন", "Restrict all")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
