import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  ExamMarkSetup,
  ExamMarkSetupInput,
  ExamMarkSetupSaveResult,
  ExamSubject,
  MarkGradeBand,
  ScholarshipCategoryRange,
} from "@/lib/types";

export const DEFAULT_PASS_PERCENT = 33;

export const DEFAULT_GRADE_BANDS: MarkGradeBand[] = [
  { id: "grade_f", grade: "F", minPercent: 0, maxPercent: 32.99 },
  { id: "grade_d", grade: "D", minPercent: 33, maxPercent: 39.99 },
  { id: "grade_c", grade: "C", minPercent: 40, maxPercent: 49.99 },
  { id: "grade_b", grade: "B", minPercent: 50, maxPercent: 59.99 },
  { id: "grade_a_minus", grade: "A-", minPercent: 60, maxPercent: 69.99 },
  { id: "grade_a", grade: "A", minPercent: 70, maxPercent: 79.99 },
  { id: "grade_a_plus", grade: "A+", minPercent: 80, maxPercent: 100 },
];

export const DEFAULT_SCHOLARSHIP_CATEGORIES: ScholarshipCategoryRange[] = [
  { id: "scholarship_talent_pool", name: "TALENT_POOL", minPercent: 90, maxPercent: 100 },
  { id: "scholarship_general", name: "GENERAL", minPercent: 80, maxPercent: 89.99 },
];

export interface MarkSetupValidation {
  valid: boolean;
  errors: string[];
  subjectErrors: Record<string, string[]>;
  gradeErrors: Record<string, string[]>;
  scholarshipErrors: Record<string, string[]>;
  passPercentError?: string;
}

const RESERVED_SCHOLARSHIP_NAMES = new Set(["NOT_ELIGIBLE", "PENDING"]);

function hasTwoDecimalPlaces(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

function normalizeSubjects(subjects: ExamSubject[]): ExamSubject[] {
  return subjects.map((subject) => ({
    ...subject,
    id: subject.id.trim(),
    classId: subject.classId?.trim() || undefined,
    name: subject.name.trim(),
    fullMarks: Number(subject.fullMarks),
    passMarks: Number(subject.passMarks),
    duration: Number(subject.duration),
    negativeMarks: Number(subject.negativeMarks),
  }));
}

function normalizeGradeBands(gradeBands: MarkGradeBand[]): MarkGradeBand[] {
  return gradeBands.map((band) => ({
    ...band,
    id: band.id.trim(),
    grade: band.grade.trim(),
    minPercent: Number(band.minPercent),
    maxPercent: Number(band.maxPercent),
  }));
}

function normalizeScholarshipCategories(categories: ScholarshipCategoryRange[]): ScholarshipCategoryRange[] {
  return categories.map((category) => ({
    ...category,
    id: category.id.trim(),
    name: category.name.trim(),
    minPercent: Number(category.minPercent),
    maxPercent: Number(category.maxPercent),
  }));
}

export function normalizeExamMarkSetup(input: ExamMarkSetupInput): ExamMarkSetupInput {
  return {
    examId: input.examId,
    subjects: normalizeSubjects(input.subjects),
    gradeBands: normalizeGradeBands(input.gradeBands),
    scholarshipCategories: normalizeScholarshipCategories(input.scholarshipCategories),
    passPercent: Number(input.passPercent),
  };
}

function validateRanges(
  rows: { id: string; minPercent: number; maxPercent: number }[],
  requireFullCoverage: boolean,
  fieldErrors: Record<string, string[]>,
) {
  const ordered = [...rows].sort((a, b) => a.minPercent - b.minPercent);
  rows.forEach((row, index) => {
    const key = row.id || `range_${index}`;
    const errors = [...(fieldErrors[key] || [])];
    if (!Number.isFinite(row.minPercent) || !Number.isFinite(row.maxPercent)) {
      errors.push("Range bounds must be numbers");
    } else {
      if (row.minPercent < 0 || row.maxPercent > 100) {
        errors.push("Range must stay between 0 and 100");
      }
      if (row.minPercent > row.maxPercent) {
        errors.push("Minimum must not exceed maximum");
      }
      if (!hasTwoDecimalPlaces(row.minPercent) || !hasTwoDecimalPlaces(row.maxPercent)) {
        errors.push("Ranges support at most two decimal places");
      }
    }
    fieldErrors[key] = errors;
  });

  if (requireFullCoverage && ordered.length > 0) {
    if (ordered[0].minPercent !== 0) {
      fieldErrors[ordered[0].id] = [...(fieldErrors[ordered[0].id] || []), "Grade coverage must start at 0%"];
    }
    const last = ordered[ordered.length - 1];
    if (last.maxPercent !== 100) {
      fieldErrors[last.id] = [...(fieldErrors[last.id] || []), "Grade coverage must end at 100%"];
    }
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const errors = fieldErrors[current.id] || [];
    if (current.minPercent <= previous.maxPercent) {
      errors.push("Range overlaps the previous range");
    } else if (requireFullCoverage && Math.abs(current.minPercent - (previous.maxPercent + 0.01)) > 1e-7) {
      errors.push("Grade coverage has a gap");
    }
    fieldErrors[current.id] = errors;
  }
}

export function validateExamMarkSetup(
  input: ExamMarkSetupInput,
  examClassIds: string[] = [],
): MarkSetupValidation {
  const setup = normalizeExamMarkSetup(input);
  const errors: string[] = [];
  const subjectErrors: Record<string, string[]> = {};
  const gradeErrors: Record<string, string[]> = {};
  const scholarshipErrors: Record<string, string[]> = {};
  let passPercentError: string | undefined;

  if (!setup.examId) errors.push("Select an exam");
  if (setup.subjects.length === 0) errors.push("Configure at least one subject");

  const seenSubjectIds = new Set<string>();
  setup.subjects.forEach((subject, index) => {
    const key = subject.id || `subject_${index}`;
    const subjectMessages: string[] = [];
    if (!subject.id) subjectMessages.push("Subject ID is required");
    if (subject.id.length > 120) subjectMessages.push("Subject ID is too long");
    if (seenSubjectIds.has(subject.id.toLowerCase())) subjectMessages.push("Subject IDs must be unique");
    seenSubjectIds.add(subject.id.toLowerCase());
    if (!subject.name) subjectMessages.push("Subject name is required");
    if (subject.name.length > 150) subjectMessages.push("Subject name is too long");
    if (subject.classId && !examClassIds.includes(subject.classId)) {
      subjectMessages.push("Subject class does not belong to this exam");
    }
    if (
      !Number.isFinite(subject.fullMarks)
      || subject.fullMarks <= 0
      || subject.fullMarks > 10000
      || !hasTwoDecimalPlaces(subject.fullMarks)
    ) {
      subjectMessages.push("Full marks must be between 0.01 and 10000");
    }
    if (
      !Number.isFinite(subject.passMarks)
      || subject.passMarks < 0
      || subject.passMarks > subject.fullMarks
      || !hasTwoDecimalPlaces(subject.passMarks)
    ) {
      subjectMessages.push("Pass marks must be between zero and full marks");
    }
    if (
      !Number.isFinite(subject.duration)
      || subject.duration <= 0
      || subject.duration > 10000
      || !hasTwoDecimalPlaces(subject.duration)
    ) {
      subjectMessages.push("Duration must be between 0.01 and 10000 minutes");
    }
    if (
      !Number.isFinite(subject.negativeMarks)
      || subject.negativeMarks < 0
      || subject.negativeMarks > subject.fullMarks
      || !hasTwoDecimalPlaces(subject.negativeMarks)
    ) {
      subjectMessages.push("Negative marks must be between zero and full marks");
    }
    subjectErrors[key] = subjectMessages;
  });

  for (const classId of examClassIds) {
    if (!setup.subjects.some((subject) => !subject.classId || subject.classId === classId)) {
      errors.push(`Configure at least one subject for every exam class (${classId})`);
    }
  }

  if (setup.gradeBands.length === 0) {
    errors.push("Configure at least one grade band");
  }
  const seenGradeIds = new Set<string>();
  setup.gradeBands.forEach((band, index) => {
    const key = band.id || `grade_${index}`;
    const messages: string[] = [];
    if (!band.id) messages.push("Grade band ID is required");
    if (band.id.length > 120) messages.push("Grade band ID is too long");
    if (seenGradeIds.has(band.id.toLowerCase())) messages.push("Grade band IDs must be unique");
    seenGradeIds.add(band.id.toLowerCase());
    if (!band.grade) messages.push("Grade label is required");
    if (band.grade.length > 40) messages.push("Grade label is too long");
    gradeErrors[key] = messages;
  });
  validateRanges(setup.gradeBands, true, gradeErrors);

  const seenScholarshipIds = new Set<string>();
  const seenScholarshipNames = new Set<string>();
  setup.scholarshipCategories.forEach((category, index) => {
    const key = category.id || `scholarship_${index}`;
    const messages: string[] = [];
    const normalizedName = category.name.toUpperCase();
    if (!category.id) messages.push("Scholarship category ID is required");
    if (category.id.length > 120) messages.push("Scholarship category ID is too long");
    if (!category.name) messages.push("Scholarship category name is required");
    if (category.name.length > 80) messages.push("Scholarship category name is too long");
    if (seenScholarshipIds.has(category.id.toLowerCase())) messages.push("Scholarship IDs must be unique");
    if (seenScholarshipNames.has(normalizedName)) messages.push("Scholarship names must be unique");
    if (RESERVED_SCHOLARSHIP_NAMES.has(normalizedName)) messages.push("This scholarship name is reserved");
    seenScholarshipIds.add(category.id.toLowerCase());
    seenScholarshipNames.add(normalizedName);
    scholarshipErrors[key] = messages;
  });
  validateRanges(setup.scholarshipCategories, false, scholarshipErrors);

  if (!Number.isFinite(setup.passPercent) || setup.passPercent < 0 || setup.passPercent > 100) {
    passPercentError = "Pass percentage must be between 0 and 100";
  } else if (!hasTwoDecimalPlaces(setup.passPercent)) {
    passPercentError = "Pass percentage supports at most two decimal places";
  }

  errors.push(
    ...Object.values(subjectErrors).flat(),
    ...Object.values(gradeErrors).flat(),
    ...Object.values(scholarshipErrors).flat(),
  );
  if (passPercentError) errors.push(passPercentError);

  return {
    valid: errors.length === 0,
    errors,
    subjectErrors,
    gradeErrors,
    scholarshipErrors,
    passPercentError,
  };
}

export function calculateGradeForSetup(percentage: number, gradeBands: MarkGradeBand[]): string {
  const match = [...gradeBands]
    .sort((a, b) => b.minPercent - a.minPercent)
    .find((band) => percentage >= band.minPercent && percentage <= band.maxPercent);
  return match?.grade || "F";
}

export function calculateScholarshipForSetup(
  percentage: number,
  categories: ScholarshipCategoryRange[],
): string {
  const match = [...categories]
    .sort((a, b) => b.minPercent - a.minPercent)
    .find((category) => percentage >= category.minPercent && percentage <= category.maxPercent);
  return match?.name || "NOT_ELIGIBLE";
}

export function calculatePassForSetup(percentage: number, passPercent: number): boolean {
  return percentage >= passPercent;
}

function mapSetup(
  examId: string,
  subjects: ExamSubject[],
  config: Record<string, unknown> | null,
  examUpdatedAt: string,
): ExamMarkSetup {
  return {
    examId,
    subjects: normalizeSubjects(Array.isArray(subjects) ? subjects : []),
    gradeBands: normalizeGradeBands(
      Array.isArray(config?.grade_bands)
        ? (config?.grade_bands as MarkGradeBand[])
        : DEFAULT_GRADE_BANDS,
    ),
    scholarshipCategories: normalizeScholarshipCategories(
      Array.isArray(config?.scholarship_categories)
        ? (config?.scholarship_categories as ScholarshipCategoryRange[])
        : DEFAULT_SCHOLARSHIP_CATEGORIES,
    ),
    passPercent: Number(config?.pass_percent ?? DEFAULT_PASS_PERCENT),
    version: Number(config?.version ?? 1),
    updatedBy: (config?.updated_by as string | null) ?? null,
    createdAt: (config?.created_at as string | undefined) ?? undefined,
    updatedAt: (config?.updated_at as string | undefined) ?? examUpdatedAt,
  };
}

export async function fetchExamMarkSetup(examId: string): Promise<ExamMarkSetup> {
  if (!examId) throw new Error("An exam is required");
  const supabase = createClient();
  const [examResult, configResult] = await Promise.all([
    supabase
      .from("exams")
      .select("id,subjects,updated_at")
      .eq("id", examId)
      .single(),
    supabase
      .from("exam_mark_configs")
      .select("grade_bands,scholarship_categories,pass_percent,version,updated_by,created_at,updated_at")
      .eq("exam_id", examId)
      .maybeSingle(),
  ]);

  if (examResult.error || !examResult.data) throw examResult.error || new Error("Exam not found");
  if (configResult.error) throw configResult.error;

  return mapSetup(
    examId,
    (examResult.data.subjects || []) as ExamSubject[],
    configResult.data as Record<string, unknown> | null,
    examResult.data.updated_at || new Date().toISOString(),
  );
}

export async function saveExamMarkSetup(
  input: ExamMarkSetupInput,
  examClassIds: string[] = [],
): Promise<ExamMarkSetupSaveResult> {
  const normalized = normalizeExamMarkSetup(input);
  const validation = validateExamMarkSetup(normalized, examClassIds);
  if (!validation.valid) throw new Error(validation.errors[0] || "Invalid mark setup");

  const supabase = createClient();
  const { data, error } = await supabase.rpc("save_exam_mark_setup", {
    p_exam_id: normalized.examId,
    p_subjects: normalized.subjects,
    p_grade_bands: normalized.gradeBands,
    p_scholarship_categories: normalized.scholarshipCategories,
    p_pass_percent: normalized.passPercent,
  });
  if (error) throw error;

  return {
    version: Number(data?.version ?? 1),
    updatedAt: data?.updated_at || new Date().toISOString(),
    setup: {
      examId: normalized.examId,
      subjects: (data?.subjects || normalized.subjects) as ExamSubject[],
      gradeBands: (data?.grade_bands || normalized.gradeBands) as MarkGradeBand[],
      scholarshipCategories: (data?.scholarship_categories || normalized.scholarshipCategories) as ScholarshipCategoryRange[],
      passPercent: Number(data?.pass_percent ?? normalized.passPercent),
      version: Number(data?.version ?? 1),
      updatedBy: null,
      updatedAt: data?.updated_at || new Date().toISOString(),
    },
  };
}

export function useExamMarkSetup(examId: string) {
  return useQuery({
    queryKey: ["exam-mark-setup", examId],
    queryFn: () => fetchExamMarkSetup(examId),
    enabled: !!examId,
    staleTime: 60_000,
  });
}

export function useSaveExamMarkSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, examClassIds }: { input: ExamMarkSetupInput; examClassIds: string[] }) =>
      saveExamMarkSetup(input, examClassIds),
    onSuccess: (result) => {
      queryClient.setQueryData(["exam-mark-setup", result.setup.examId], result.setup);
      queryClient.invalidateQueries({ queryKey: ["exam-mark-setup", result.setup.examId] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["marks-sheet-page"] });
      queryClient.invalidateQueries({ queryKey: ["marks-sheet"] });
    },
  });
}
