"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Check,
  ClipboardCopy,
  ClipboardList,
  Eraser,
  GraduationCap,
  Landmark,
  Loader2,
  PencilLine,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableCheckbox } from "@/components/ui/table-checkbox";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { useClasses } from "@/lib/storage/classes";
import { useExamsFull } from "@/lib/storage/exams";
import { useInstitutions } from "@/lib/storage/institutions";
import { calculateGradeForSetup, useExamMarkSetup } from "@/lib/storage/mark-setup";
import {
  clearExamMark,
  saveExamMarkCell,
  useMarksSheetPage,
  type MarksSheetPageParams,
} from "@/lib/storage/marks";
import { useCurrentSession } from "@/lib/storage/sessions";
import { useQueryClient } from "@tanstack/react-query";
import type { MarksSheetPageRow } from "@/lib/types";

type CellStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type CellOperation = "save" | "clear";

interface CellState {
  text: string;
  revision: number;
  status: CellStatus;
  lastSavedValue: number | null;
  clearRequired: boolean;
  error?: string;
  errorType?: "validation" | "server" | "clear";
  operation?: CellOperation;
}

interface MarksEntryPanelProps {
  onPendingChange?: (pending: boolean) => void;
}

const AUTOSAVE_DELAY = 600;
const SEARCH_DELAY = 450;
const EMPTY_ROWS: MarksSheetPageRow[] = [];

function cellError(text: string, fullMarks: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(trimmed)) {
    return "Enter a valid mark with at most two decimal places";
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return "Enter a finite mark";
  if (value < 0 || value > fullMarks) return `Mark must be between 0 and ${fullMarks}`;
  return null;
}

function normalizedMarkText(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function MarksEntryPanel({ onPendingChange }: MarksEntryPanelProps) {
  const { lang } = useLang();
  const { theme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isBn = lang === "bn";
  const isDark = theme === "dark";
  const bi = (bn: string, en: string) => (isBn ? bn : en);

  const { data: currentSession } = useCurrentSession();
  const { data: exams = [] } = useExamsFull();
  const { data: allClasses = [] } = useClasses();
  const { data: institutions = [] } = useInstitutions();

  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyValue, setCopyValue] = useState("");
  const [copyError, setCopyError] = useState("");
  const [clearTarget, setClearTarget] = useState<MarksSheetPageRow | null>(null);
  const [blockedAction, setBlockedAction] = useState<string | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [, setOperationRevision] = useState(0);

  const revisionRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlightRef = useRef(new Map<string, { revision: number; promise: Promise<boolean> }>());
  const clearPromisesRef = useRef(new Set<Promise<boolean>>());
  const cellsRef = useRef(cells);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const blockedActionRef = useRef<(() => void) | null>(null);
  const filterRef = useRef({ examId, classId, subjectId, fullMarks: 0 });

  const { data: setup, isLoading: setupLoading } = useExamMarkSetup(examId);
  const exam = useMemo(() => exams.find((item) => item.id === examId), [examId, exams]);

  const classEntries = useMemo(() => {
    const byId = new Map(allClasses.map((item) => [item.id, item]));
    const byCode = new Map(allClasses.map((item) => [item.code, item]));
    return (exam?.classes || []).map((reference) => {
      const resolved = byId.get(reference) || byCode.get(reference);
      return {
        id: resolved?.id || "",
        name: resolved?.name || reference,
      };
    }).filter((item) => item.id);
  }, [allClasses, exam]);

  const subjects = useMemo(
    () => (exam?.subjects || setup?.subjects || []).filter((subject) => !subject.classId || subject.classId === classId),
    [classId, exam, setup],
  );
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === subjectId),
    [subjectId, subjects],
  );
  const fullMarks = selectedSubject?.fullMarks || 0;

  const queryParams: MarksSheetPageParams = useMemo(() => ({
    examId,
    classId,
    institutionId: institutionId || null,
    subjectId,
    search,
    page,
    pageSize,
    sessionId: currentSession?.id,
  }), [classId, currentSession?.id, examId, institutionId, page, pageSize, search, subjectId]);

  const marksQuery = useMarksSheetPage(queryParams);
  const rows = marksQuery.data?.rows || EMPTY_ROWS;
  const summary = marksQuery.data?.summary;
  const progressTotal = (summary?.enteredCount || 0) + (summary?.missingCount || 0);
  const progressPct = progressTotal > 0 ? Math.round(((summary?.enteredCount || 0) / progressTotal) * 100) : 0;

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    filterRef.current = { examId, classId, subjectId, fullMarks };
  }, [classId, examId, fullMarks, subjectId]);

  useEffect(() => {
    if (!exam || exam.id !== examId) return;
    if (!classId && exam.subjects.length > 0) {
      const firstClass = classEntries[0]?.id;
      if (firstClass) setClassId(firstClass);
      return;
    }
    if (classId && !subjectId) {
      const available = exam.subjects.filter((subject) => !subject.classId || subject.classId === classId);
      if (available[0]) setSubjectId(available[0].id);
    }
  }, [classEntries, classId, exam, examId, subjectId]);

  useEffect(() => {
    setCells((current) => {
      const next = { ...current };
      for (const row of rows) {
        const existing = next[row.registrationId];
        if (existing?.status === "dirty" || existing?.status === "saving" || existing?.status === "error") continue;
        next[row.registrationId] = {
          text: row.mark === null ? "" : normalizedMarkText(row.mark),
          revision: existing?.revision || 0,
          status: row.mark === null ? "idle" : "saved",
          lastSavedValue: row.mark,
          clearRequired: false,
          operation: existing?.operation,
          error: undefined,
          errorType: undefined,
        };
      }
      return next;
    });
  }, [rows]);

  const hasPendingSave = useCallback(() => (
    Object.values(cellsRef.current).some((cell) => cell.status === "dirty" || cell.status === "saving")
    || inFlightRef.current.size > 0
    || clearPromisesRef.current.size > 0
  ), []);

  const pending = Object.values(cells).some((cell) => cell.status === "dirty" || cell.status === "saving")
    || inFlightRef.current.size > 0
    || clearPromisesRef.current.size > 0;

  useEffect(() => {
    onPendingChange?.(pending);
  }, [onPendingChange, pending]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingSave()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingSave]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [examId, classId, institutionId, page, pageSize, search, subjectId]);

  useEffect(() => {
    const currentPageRows = rows;
    const currentKeys = new Set(currentPageRows.map((row) => row.registrationId));
    setCells((current) => {
      const next = { ...current };
      currentKeys.forEach((key) => {
        const cell = next[key];
        if (cell?.status !== "dirty" && cell?.status !== "saving" && cell?.status !== "error") delete next[key];
      });
      return next;
    });
    timersRef.current.forEach((timer, key) => {
      if (!currentKeys.has(key)) {
        clearTimeout(timer);
        timersRef.current.delete(key);
      }
    });
  }, [rows]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim();
      const applySearch = () => {
        setSearch(nextSearch);
        setPage(1);
      };
      if (hasPendingSave()) {
        blockedActionRef.current = applySearch;
        setBlockedAction(isBn ? "অসংরক্ষিত নম্বর আছে" : "You have pending marks");
      } else {
        applySearch();
      }
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [hasPendingSave, isBn, searchInput]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    const current = filterRef.current;
    Object.entries(cellsRef.current).forEach(([registrationId, cell]) => {
      if (cell.status !== "dirty" || !current.examId || !current.subjectId || cell.clearRequired) return;
      const error = cellError(cell.text, current.fullMarks);
      const value = Number(cell.text);
      if (!error && Number.isFinite(value)) {
        void saveExamMarkCell(current.examId, {
          registrationId,
          subjectId: current.subjectId,
          marks: value,
        });
      }
    });
  }, []);

  const persistCell = useCallback(async (
    registrationId: string,
    revision: number,
    value: number,
  ): Promise<boolean> => {
    if (!examId || !subjectId) return false;
    const existing = inFlightRef.current.get(registrationId);
    if (existing) {
      const previousResult = await existing.promise;
      if (existing.revision === revision) return previousResult;
      if (cellsRef.current[registrationId]?.revision !== revision) return true;
    }

    const timer = timersRef.current.get(registrationId);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(registrationId);

    const promise = (async () => {
      setCells((current) => {
        const cell = current[registrationId];
        if (!cell || cell.revision !== revision) return current;
        return { ...current, [registrationId]: { ...cell, status: "saving", error: undefined, errorType: undefined, operation: "save" } };
      });

      try {
        await saveExamMarkCell(examId, { registrationId, subjectId, marks: value });
        setCells((current) => {
          const cell = current[registrationId];
          if (!cell) return current;
          if (cell.revision !== revision) {
            if (cell.clearRequired && cell.lastSavedValue === null) {
              return {
                ...current,
                [registrationId]: { ...cell, lastSavedValue: value },
              };
            }
            return current;
          }
          return {
            ...current,
            [registrationId]: {
              ...cell,
              text: normalizedMarkText(value),
              status: "saved",
              lastSavedValue: value,
              clearRequired: false,
              error: undefined,
              errorType: undefined,
              operation: "save",
            },
          };
        });
        await queryClient.invalidateQueries({ queryKey: ["marks-sheet-page"] });
        return true;
      } catch (error) {
        setCells((current) => {
          const cell = current[registrationId];
          if (!cell || cell.revision !== revision) return current;
          return {
            ...current,
            [registrationId]: {
              ...cell,
              status: "error",
              error: error instanceof Error ? error.message : "The mark could not be saved",
              errorType: "server",
              operation: "save",
            },
          };
        });
        return false;
      } finally {
        if (inFlightRef.current.get(registrationId)?.revision === revision) {
          inFlightRef.current.delete(registrationId);
          timersRef.current.delete(registrationId);
          setOperationRevision((current) => current + 1);
        }
      }
    })();

    inFlightRef.current.set(registrationId, { revision, promise });
    setOperationRevision((current) => current + 1);
    return promise;
  }, [examId, queryClient, subjectId]);

  const scheduleCellSave = useCallback((registrationId: string, revision: number, value: number, delay = AUTOSAVE_DELAY) => {
    const previous = timersRef.current.get(registrationId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      void persistCell(registrationId, revision, value);
    }, delay);
    timersRef.current.set(registrationId, timer);
  }, [persistCell]);

  const updateCell = useCallback((
    registrationId: string,
    text: string,
    immediate = false,
  ) => {
    const existing = cellsRef.current[registrationId];
    const lastSavedValue = existing?.lastSavedValue ?? rows.find((row) => row.registrationId === registrationId)?.mark ?? null;
    const revision = ++revisionRef.current;
    const previousTimer = timersRef.current.get(registrationId);
    if (previousTimer) clearTimeout(previousTimer);
    timersRef.current.delete(registrationId);

    if (!text.trim()) {
      if (lastSavedValue === null && !inFlightRef.current.has(registrationId)) {
        const nextReference = { ...cellsRef.current };
        delete nextReference[registrationId];
        cellsRef.current = nextReference;
        setCells((current) => {
          const next = { ...current };
          delete next[registrationId];
          return next;
        });
        return revision;
      }
      const nextCell: CellState = {
        text: "",
        revision,
        status: "error",
        lastSavedValue,
        clearRequired: true,
        error: "Use the clear action to remove this saved mark",
        errorType: "clear",
        operation: "clear",
      };
      cellsRef.current = { ...cellsRef.current, [registrationId]: nextCell };
      setCells((current) => ({ ...current, [registrationId]: nextCell }));
      return revision;
    }

    const error = cellError(text, fullMarks);
    const value = Number(text);
    const nextCell: CellState = {
      text,
      revision,
      status: error ? "error" : "dirty",
      lastSavedValue,
      clearRequired: false,
      error: error || undefined,
      errorType: error ? "validation" : undefined,
      operation: "save",
    };
    cellsRef.current = { ...cellsRef.current, [registrationId]: nextCell };
    setCells((current) => ({ ...current, [registrationId]: nextCell }));

    if (!error && Number.isFinite(value)) {
      scheduleCellSave(registrationId, revision, value, immediate ? 0 : AUTOSAVE_DELAY);
    }
    return revision;
  }, [fullMarks, rows, scheduleCellSave]);

  const flushPending = useCallback(async (): Promise<boolean> => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    const operations: Promise<boolean>[] = [
      ...Array.from(inFlightRef.current.values()).map((operation) => operation.promise),
      ...Array.from(clearPromisesRef.current),
    ];
    Object.entries(cellsRef.current).forEach(([registrationId, cell]) => {
      if (cell.status !== "dirty" || cell.clearRequired) return;
      const error = cellError(cell.text, fullMarks);
      const value = Number(cell.text);
      if (!error && Number.isFinite(value)) {
        operations.push(persistCell(registrationId, cell.revision, value));
      }
    });
    const results = await Promise.all(operations);
    return results.every(Boolean);
  }, [fullMarks, persistCell]);

  const guardAction = useCallback((label: string, action: () => void) => {
    if (!hasPendingSave()) {
      action();
      return;
    }
    blockedActionRef.current = action;
    setBlockedAction(label);
  }, [hasPendingSave]);

  const changeExam = (nextExamId: string) => guardAction(
    bi("পরীক্ষা বদলানো হবে", "The exam will change"),
    () => {
      setExamId(nextExamId);
      setClassId("");
      setSubjectId("");
      setInstitutionId("");
      setSearchInput("");
      setSearch("");
      setPage(1);
      setCells({});
    },
  );

  const changeClass = (nextClassId: string) => guardAction(
    bi("ক্লাস বদলানো হবে", "The class will change"),
    () => {
      setClassId(nextClassId);
      setSubjectId("");
      setSearchInput("");
      setSearch("");
      setPage(1);
      setCells({});
    },
  );

  const changeInstitution = (nextInstitutionId: string) => guardAction(
    bi("প্রতিষ্ঠান ফিল্টার বদলাবে", "The institution filter will change"),
    () => {
      setInstitutionId(nextInstitutionId);
      setPage(1);
    },
  );

  const changeSubject = (nextSubjectId: string) => guardAction(
    bi("বিষয় বদলানো হবে", "The subject will change"),
    () => {
      setSubjectId(nextSubjectId);
      setPage(1);
      setCells({});
    },
  );

  const changePage = (nextPage: number) => guardAction(
    bi("পৃষ্ঠা বদলানো হবে", "The page will change"),
    () => setPage(nextPage),
  );

  const resetFilters = () => {
    setExamId("");
    setClassId("");
    setSubjectId("");
    setInstitutionId("");
    setSearchInput("");
    setSearch("");
    setPage(1);
    setCells({});
  };

  const confirmBlockedAction = async () => {
    setIsFlushing(true);
    const success = await flushPending();
    setIsFlushing(false);
    if (!success) {
      toast("error", bi("অসংরক্ষিত নম্বর ব্যর্থ", "Some pending marks could not be saved"));
      return;
    }
    const action = blockedActionRef.current;
    blockedActionRef.current = null;
    setBlockedAction(null);
    action?.();
  };

  const confirmClear = async () => {
    if (!clearTarget || !examId || !subjectId) return;
    const registrationId = clearTarget.registrationId;
    const targetExamId = examId;
    const targetSubjectId = subjectId;
    const revision = ++revisionRef.current;
    const timer = timersRef.current.get(registrationId);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(registrationId);

    const nextCell: CellState = {
      text: "",
      revision,
      status: "saving",
      lastSavedValue: cellsRef.current[registrationId]?.lastSavedValue ?? clearTarget.mark,
      clearRequired: true,
      operation: "clear",
    };
    cellsRef.current = { ...cellsRef.current, [registrationId]: nextCell };
    setCells((current) => ({ ...current, [registrationId]: nextCell }));

    const operation = (async (): Promise<boolean> => {
      const pendingSave = inFlightRef.current.get(registrationId);
      if (pendingSave) await pendingSave.promise;
      try {
        await clearExamMark(targetExamId, registrationId, targetSubjectId);
        setCells((current) => {
          const cell = current[registrationId];
          if (!cell || cell.revision !== revision) return current;
          const next = { ...current };
          delete next[registrationId];
          return next;
        });
        const nextReference = { ...cellsRef.current };
        delete nextReference[registrationId];
        cellsRef.current = nextReference;
        await queryClient.invalidateQueries({ queryKey: ["marks-sheet-page"] });
        return true;
      } catch (error) {
        setCells((current) => {
          const cell = current[registrationId];
          if (!cell || cell.revision !== revision) return current;
          return {
            ...current,
            [registrationId]: {
              ...cell,
              status: "error",
              error: error instanceof Error ? error.message : "The mark could not be cleared",
              errorType: "server",
              operation: "clear",
            },
          };
        });
        return false;
      }
    })();

    clearPromisesRef.current.add(operation);
    setOperationRevision((current) => current + 1);
    const success = await operation;
    clearPromisesRef.current.delete(operation);
    setOperationRevision((current) => current + 1);
    if (success) {
      toast("success", bi("নম্বর মুছে ফেলা হয়েছে", "Mark cleared"));
      setClearTarget(null);
    }
  };

  const retryCell = async (registrationId: string) => {
    const cell = cellsRef.current[registrationId];
    if (!cell) return;
    if (cell.operation === "clear") {
      const row = rows.find((item) => item.registrationId === registrationId);
      if (row) {
        setClearTarget({ ...row, mark: cell.lastSavedValue });
      }
      return;
    }
    const error = cellError(cell.text, fullMarks);
    const value = Number(cell.text);
    if (!error && Number.isFinite(value)) {
      await persistCell(registrationId, cell.revision, value);
    }
  };

  const applyCopy = async () => {
    if (!copyValue.trim()) {
      setCopyError(bi("একটি নম্বর দিন", "Enter a mark value"));
      return;
    }
    const error = cellError(copyValue, fullMarks);
    const value = Number(copyValue);
    if (error) {
      setCopyError(error);
      return;
    }
    if (selectedIds.size === 0) {
      setCopyError(bi("অন্তত একটি শিক্ষার্থী নির্বাচন করুন", "Select at least one student"));
      return;
    }

    const saves: Promise<boolean>[] = [];
    selectedIds.forEach((registrationId) => {
      const revision = updateCell(registrationId, copyValue, true);
      saves.push(persistCell(registrationId, revision, value));
    });
    const results = await Promise.all(saves);
    const succeeded = results.filter(Boolean).length;
    const failed = results.length - succeeded;
    if (failed > 0) {
      toast("warning", bi(`${succeeded}টি সংরক্ষিত, ${failed}টি ব্যর্থ`, `${succeeded} saved, ${failed} failed`));
    } else {
      toast("success", bi(`${succeeded}টি নম্বর কপি হয়েছে`, `${succeeded} marks copied`));
    }
    setCopyOpen(false);
    setCopyValue("");
    setCopyError("");
  };

  const handleInputKey = (event: KeyboardEvent<HTMLInputElement>, registrationId: string) => {
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const index = rows.findIndex((row) => row.registrationId === registrationId);
    const nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    const nextRow = rows[nextIndex];
    if (!nextRow) {
      event.currentTarget.blur();
      return;
    }
    event.preventDefault();
    inputRefs.current.get(nextRow.registrationId)?.focus();
  };

  const toggleSelected = (registrationId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  };

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.registrationId));
  const someSelected = rows.some((row) => selectedIds.has(row.registrationId));
  const selectedExamName = exam?.name || "—";
  const selectedClassName = classEntries.find((item) => item.id === classId)?.name || "—";
  const selectedInstitutionName = institutionId
    ? institutions.find((institution) => institution.id === institutionId)?.name || "—"
    : bi("সব প্রতিষ্ঠান", "All institutions");

  const card = isDark
    ? "rounded-xl border border-white/[0.06] bg-[#141416]"
    : "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
  const borderClass = isDark ? "border-white/[0.06]" : "border-zinc-100";
  const labelClass = isDark ? "text-zinc-400" : "text-zinc-600";
  const mutedClass = "text-zinc-500";
  const headingClass = isDark ? "text-white" : "text-zinc-900";
  const softClass = isDark ? "bg-white/[0.02]" : "bg-zinc-50";
  const chip = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-brand-accent";
  const inputClass = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600"
    : "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400";

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className={`flex items-center gap-3 border-b px-5 py-4 ${borderClass}`}>
          <div className={chip}><BookOpen className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm font-semibold ${headingClass}`}>{bi("বিষয়ভিত্তিক নম্বর প্রবেশ", "Subject-first mark entry")}</h3>
            <p className={`mt-0.5 text-[11px] ${mutedClass}`}>{bi("শুধু অনুমোদিত নিবন্ধনকারী শিক্ষার্থীদের নম্বর দেখা যাবে।", "Only approved registrations are eligible.")}</p>
          </div>
          {examId && (
            <Button type="button" size="sm" variant="ghost" onClick={() => guardAction(bi("ফিল্টার রিসেট হবে", "Filters will reset"), resetFilters)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {bi("রিসেট", "Reset")}
            </Button>
          )}
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <Field label={bi("পরীক্ষা", "Exam")} htmlFor="marks-entry-exam">
            <Select
              id="marks-entry-exam"
              value={examId}
              onChange={(event) => changeExam(event.target.value)}
              options={[
                { label: bi("পরীক্ষা নির্বাচন করুন", "Select exam"), value: "" },
                ...exams.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
              ]}
              className={inputClass}
            />
          </Field>
          <Field label={bi("ক্লাস", "Class")} htmlFor="marks-entry-class">
            <Select
              id="marks-entry-class"
              value={classId}
              onChange={(event) => changeClass(event.target.value)}
              options={[
                { label: bi("ক্লাস নির্বাচন করুন", "Select class"), value: "" },
                ...classEntries.map((item) => ({ label: item.name, value: item.id })),
              ]}
              className={inputClass}
              disabled={!examId}
            />
          </Field>
          <Field label={bi("প্রতিষ্ঠান", "Institution")} htmlFor="marks-entry-institution">
            <Select
              id="marks-entry-institution"
              value={institutionId}
              onChange={(event) => changeInstitution(event.target.value)}
              options={[
                { label: bi("সব প্রতিষ্ঠান", "All institutions"), value: "" },
                ...institutions.filter((item) => item.status === "ACTIVE").map((item) => ({ label: item.name, value: item.id })),
              ]}
              className={inputClass}
              disabled={!classId}
            />
          </Field>
          <Field label={bi("বিষয়", "Subject")} htmlFor="marks-entry-subject">
            <Select
              id="marks-entry-subject"
              value={subjectId}
              onChange={(event) => changeSubject(event.target.value)}
              options={[
                { label: bi("বিষয় নির্বাচন করুন", "Select subject"), value: "" },
                ...subjects.map((subject) => ({ label: `${subject.name} (${subject.fullMarks})`, value: subject.id })),
              ]}
              className={inputClass}
              disabled={!classId || setupLoading}
            />
          </Field>
          <Field label={bi("অনুসন্ধান", "Search")} htmlFor="marks-entry-search">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${mutedClass}`} />
              <Input
                id="marks-entry-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={bi("নাম, নিবন্ধন, প্রতিষ্ঠান বা রোল", "Name, registration, institution, or roll")}
                className={`pl-9 ${inputClass}`}
                disabled={!subjectId}
              />
            </div>
          </Field>
        </div>
      </div>

      {examId && setupLoading && (
        <div className={`${card} p-8 text-center text-sm ${mutedClass}`}>{bi("সেটআপ লোড হচ্ছে...", "Loading exam setup...")}</div>
      )}

      {examId && !setupLoading && subjects.length === 0 && (
        <div className={`${card} px-6 py-12 text-center`}>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
            <TriangleAlert className="h-7 w-7 text-amber-500" />
          </div>
          <p className={`text-sm font-semibold ${headingClass}`}>{bi("এই ক্লাসের কোনো বিষয় নেই", "No subjects are configured for this class")}</p>
          <p className={`mx-auto mt-1.5 max-w-sm text-xs leading-relaxed ${mutedClass}`}>{bi("প্রথমে Grade Scale থেকে বিষয় যোগ করুন।", "Add subjects in Grade Scale first.")}</p>
        </div>
      )}

      {marksQuery.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {marksQuery.error.message}
        </div>
      )}

      {subjectId && summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { icon: ClipboardList, label: bi("নির্বাচিত পরীক্ষা", "Exam"), value: selectedExamName },
            { icon: GraduationCap, label: bi("ক্লাস", "Class"), value: selectedClassName },
            { icon: Building2, label: bi("প্রতিষ্ঠান ফিল্টার", "Institution filter"), value: selectedInstitutionName },
            { icon: Users, label: bi("অনুমোদিত শিক্ষার্থী", "Approved students"), value: summary.totalCandidates },
            { icon: Landmark, label: bi("প্রতিষ্ঠান", "Institutions"), value: summary.institutionsRepresented },
            { icon: PencilLine, label: bi("প্রবেশ / অনুপস্থিত", "Entered / missing"), value: `${summary.enteredCount} / ${summary.missingCount}` },
          ].map((item) => (
            <div key={item.label} className={`${card} group flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-brand-accent transition-transform duration-200 group-hover:scale-105">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>{item.label}</p>
                <p className={`mt-0.5 truncate text-sm font-semibold ${headingClass}`} title={String(item.value)}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subjectId && (
        <div className={card}>
          <div className={`flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${borderClass}`}>
            <div className="flex items-center gap-3">
              <div className={chip}><Users className="h-4 w-4" /></div>
              <div className="min-w-0">
                <h3 className={`text-sm font-semibold ${headingClass}`}>{selectedSubject?.name || bi("নম্বর প্রবেশ", "Mark entry")}</h3>
                <p className={`text-[11px] ${mutedClass}`}>
                  {selectedSubject ? `${bi("পূর্ণ নম্বর", "Full marks")}: ${selectedSubject.fullMarks}` : ""} · {marksQuery.data?.totalMatching || 0} {bi("টি মিল", "matches")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`hidden items-center gap-1.5 text-[10px] ${mutedClass} md:flex`}>
                <kbd className="kbd-chip">Enter</kbd>
                <kbd className="kbd-chip">↑</kbd>
                <kbd className="kbd-chip">↓</kbd>
                {bi("দিয়ে সারি বদলান", "to move between rows")}
              </span>
              {selectedIds.size > 0 && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setCopyOpen(true)}>
                  <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> {selectedIds.size} {bi("টিতে কপি", "selected")}
                </Button>
              )}
              <Select
                value={String(pageSize)}
                onChange={(event) => guardAction(bi("পৃষ্ঠার আকার বদলাবে", "Page size will change"), () => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                })}
                options={[
                  { label: "25 / " + bi("পৃষ্ঠা", "page"), value: "25" },
                  { label: "50 / " + bi("পৃষ্ঠা", "page"), value: "50" },
                  { label: "100 / " + bi("পৃষ্ঠা", "page"), value: "100" },
                ]}
                className={`h-9 w-28 ${inputClass}`}
                aria-label={bi("পৃষ্ঠার আকার", "Page size")}
              />
            </div>
          </div>

          {progressTotal > 0 && (
            <div className={`border-b px-5 py-3 ${borderClass}`}>
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                <span className={mutedClass}>{bi("প্রবেশ অগ্রগতি", "Entry progress")}</span>
                <span className={`tabular-nums ${headingClass}`}>{progressPct}% · {summary?.enteredCount ?? 0}/{progressTotal}</span>
              </div>
              <div className={`mt-1.5 h-1.5 overflow-hidden rounded-full ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`}>
                <div className="h-full rounded-full bg-brand-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {marksQuery.isLoading ? (
            <div className="p-10 text-center">
              <Loader2 className={`mx-auto mb-3 h-6 w-6 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <p className={`text-sm ${mutedClass}`}>{bi("শিক্ষার্থী লোড হচ্ছে...", "Loading students...")}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-white/[0.06]" : "bg-zinc-100"}`}>
                <Users className={`h-7 w-7 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              </div>
              <p className={`text-sm font-medium ${headingClass}`}>
                {search
                  ? bi("অনুসন্ধানের সাথে কোনো শিক্ষার্থী মেলেনি", "No students match this search")
                  : summary?.totalCandidates === 0
                    ? bi("এই ক্লাসে কোনো অনুমোদিত নিবন্ধন নেই", "There are no approved registrations for this class")
                    : bi("কোনো শিক্ষার্থী পাওয়া যায়নি", "No students found")}
              </p>
              {search && (
                <Button type="button" className="mt-4" variant="secondary" onClick={() => guardAction(bi("অনুসন্ধান মুছে যাবে", "Search will be cleared"), () => { setSearchInput(""); setSearch(""); setPage(1); })}>
                  {bi("অনুসন্ধান মুছুন", "Clear search")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                    <TableHead className="w-10">
                      <TableCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={() => setSelectedIds(allSelected ? new Set() : new Set(rows.map((row) => row.registrationId)))}
                      />
                    </TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("পরীক্ষা রোল", "Exam roll")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("শিক্ষার্থী", "Student")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("প্রতিষ্ঠান", "Institution")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("নিবন্ধন নম্বর", "Registration no.")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("নম্বর", "Mark")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("শতাংশ", "%")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("গ্রেড", "Grade")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("অবস্থা", "Status")}</TableHead>
                    <TableHead className={isDark ? "text-zinc-400" : "text-zinc-500"}>{bi("কাজ", "Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const cell = cells[row.registrationId];
                    const text = cell?.text ?? (row.mark === null ? "" : normalizedMarkText(row.mark));
                    const value = text.trim() ? Number(text) : null;
                    const validValue = value !== null && Number.isFinite(value) && !cellError(text, row.fullMarks);
                    const percentage = validValue && row.fullMarks > 0 ? (value! / row.fullMarks) * 100 : null;
                    const grade = percentage === null ? "—" : calculateGradeForSetup(percentage, setup?.gradeBands || []);
                    return (
                      <TableRow
                        key={row.registrationId}
                        className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"} ${selectedIds.has(row.registrationId) ? "bg-brand-accent-soft" : ""}`}
                      >
                        <TableCell>
                          <TableCheckbox
                            checked={selectedIds.has(row.registrationId)}
                            onChange={() => toggleSelected(row.registrationId)}
                          />
                        </TableCell>
                        <TableCell className={`font-mono text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{row.examRoll || "—"}</TableCell>
                        <TableCell className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{row.studentName}</TableCell>
                        <TableCell className={`max-w-44 truncate text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`} title={row.institutionName}>{row.institutionName}</TableCell>
                        <TableCell className={`font-mono text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{row.registrationNumber}</TableCell>
                        <TableCell>
                          <div className="w-32">
                            <Input
                              ref={(node) => {
                                if (node) inputRefs.current.set(row.registrationId, node);
                                else inputRefs.current.delete(row.registrationId);
                              }}
                              type="text"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              max={row.fullMarks}
                              value={text}
                              onChange={(event) => updateCell(row.registrationId, event.target.value)}
                              onBlur={() => {
                                const current = cellsRef.current[row.registrationId];
                                if (current?.status === "dirty" && !current.clearRequired) {
                                  const error = cellError(current.text, row.fullMarks);
                                  const currentValue = Number(current.text);
                                  if (!error && Number.isFinite(currentValue)) {
                                    void persistCell(row.registrationId, current.revision, currentValue);
                                  }
                                }
                              }}
                              onKeyDown={(event) => handleInputKey(event, row.registrationId)}
                              placeholder={row.mark === null ? bi("প্রবেশ করা হয়নি", "Not entered") : normalizedMarkText(row.mark)}
                              className={`${inputClass} h-9 rounded-lg text-center text-xs font-semibold tabular-nums ${cell?.status === "error" ? "border-red-500/60" : cell?.status === "saving" ? "border-amber-500/60" : cell?.status === "saved" ? "border-emerald-500/50" : ""}`}
                              aria-label={`${row.studentName} ${bi("নম্বর", "mark")}`}
                              aria-invalid={cell?.status === "error"}
                              aria-describedby={cell?.error ? `mark-error-${row.registrationId}` : undefined}
                            />
                            {cell?.error && (
                              <p id={`mark-error-${row.registrationId}`} className="mt-1 max-w-44 text-[9px] leading-3 text-red-500">
                                {bi(cell.error, cell.error)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-[11px] font-medium ${percentage !== null ? (isDark ? "text-zinc-200" : "text-zinc-700") : mutedClass}`}>
                          {percentage === null ? "—" : `${percentage.toFixed(2)}%`}
                        </TableCell>
                        <TableCell><Badge>{grade}</Badge></TableCell>
                        <TableCell><CellStatusView cell={cell} isBn={isBn} onRetry={() => void retryCell(row.registrationId)} /></TableCell>
                        <TableCell>
                          {cell?.lastSavedValue !== null && cell?.lastSavedValue !== undefined ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              aria-label={`${bi("মুছুন", "Clear")} ${row.studentName}`}
                              onClick={() => setClearTarget(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className={`text-[11px] ${mutedClass}`}>—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className={`flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between ${borderClass}`}>
                <p className={`text-[11px] ${mutedClass}`}>
                  {marksQuery.data?.totalMatching
                    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, marksQuery.data.totalMatching)} / ${marksQuery.data.totalMatching}`
                    : "0"}
                </p>
                <Pagination currentPage={marksQuery.data?.page || page} totalPages={marksQuery.data?.totalPages || 0} onPageChange={changePage} />
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title={bi("নির্বাচিত শিক্ষার্থীদের কপি করুন", "Copy mark to selected students")} description={`${selectedIds.size} ${bi("টি শিক্ষার্থী নির্বাচিত", "students selected")}`} maxWidth="max-w-md">
        <div className="space-y-2">
          <label className={`block text-[11px] font-medium ${labelClass}`} htmlFor="copy-mark-value">{bi("নম্বর", "Mark value")}</label>
          <Input
            id="copy-mark-value"
            type="text"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={fullMarks}
            value={copyValue}
            onChange={(event) => { setCopyValue(event.target.value); setCopyError(""); }}
            className={inputClass}
            aria-invalid={!!copyError}
          />
          {copyError && <p className="text-[11px] text-red-500">{copyError}</p>}
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setCopyOpen(false)}>{bi("বাতিল", "Cancel")}</Button>
          <Button type="button" onClick={() => void applyCopy()}><ClipboardCopy className="mr-2 h-4 w-4" />{bi("কপি ও সংরক্ষণ", "Copy and save")}</Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!clearTarget}
        onClose={() => setClearTarget(null)}
        title={bi("সংরক্ষিত নম্বর মুছবেন?", "Clear this saved mark?")}
        description={clearTarget ? `${clearTarget.studentName} · ${clearTarget.subjectName}` : ""}
        maxWidth="max-w-md"
      >
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{bi("এই কাজটি শুধু নির্বাচিত নম্বরটি মুছবে। ফলাফল বদলাতে Results থেকে আবার প্রক্রিয়া করতে হবে।", "Only this selected mark will be deleted. Results only change after explicit processing from Results.")}</p>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setClearTarget(null)}>{bi("বাতিল", "Cancel")}</Button>
          <Button type="button" variant="destructive" onClick={() => void confirmClear()}><Eraser className="mr-2 h-4 w-4" />{bi("নিশ্চিত করে মুছুন", "Confirm clear")}</Button>
        </ModalFooter>
      </Modal>

      <Modal
        open={!!blockedAction}
        onClose={() => { blockedActionRef.current = null; setBlockedAction(null); }}
        title={bi("অসংরক্ষিত নম্বর", "Pending marks")}
        description={`${blockedAction || ""}. ${bi("এগুলো সংরক্ষণ করে পরিবর্তন সম্পন্ন হবে।", "They will be saved before navigation continues.")}`}
        maxWidth="max-w-md"
      >
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => { blockedActionRef.current = null; setBlockedAction(null); }}>{bi("থাকুন", "Stay")}</Button>
          <Button type="button" onClick={() => void confirmBlockedAction()} isLoading={isFlushing}>{bi("সংরক্ষণ করে এগিয়ে যান", "Save and continue")}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={`rounded-xl border p-3 transition-colors ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-zinc-200/80 bg-zinc-50/70"}`}>
      <label className="mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function CellStatusView({ cell, isBn, onRetry }: { cell?: CellState; isBn: boolean; onRetry: () => void }) {
  if (!cell || cell.status === "idle") {
    return <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{isBn ? "প্রবেশ হয়নি" : "Not entered"}</span>;
  }
  if (cell.status === "dirty") {
    return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">{isBn ? "অপেক্ষমাণ" : "Pending"}</Badge>;
  }
  if (cell.status === "saving") {
    return <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400"><Loader2 className="h-3 w-3 animate-spin" />{isBn ? "সংরক্ষণ হচ্ছে" : "Saving"}</span>;
  }
  if (cell.status === "saved") {
    return <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{isBn ? "সংরক্ষিত" : "Saved"}</span>;
  }
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400">
      <AlertCircle className="h-3 w-3" />
      <span>{isBn ? "ত্রুটি" : "Error"}</span>
      {cell.errorType === "server" && (
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onRetry} aria-label={isBn ? "পুনরায় চেষ্টা" : "Retry"}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
