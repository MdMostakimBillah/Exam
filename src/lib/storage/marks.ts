import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchCurrentSession } from "./sessions";
import type { Mark, MarksSaveResult, MarksSheetPage, MarksSheetPageRow } from "@/lib/types";

const SUPABASE_TABLE = "marks";
const MARK_COLUMNS = "id,session_id,student_id,registration_id,exam_id,subject_id,subject_name,marks,entered_by,created_at,updated_at";
const DEFAULT_PAGE_SIZE = 20;

function mapMark(data: Record<string, unknown>): Mark {
  return {
    id: String(data.id),
    sessionId: String(data.session_id),
    studentId: String(data.student_id),
    registrationId: String(data.registration_id),
    examId: String(data.exam_id),
    subjectId: String(data.subject_id),
    subjectName: String(data.subject_name),
    marks: Number(data.marks),
    enteredBy: String(data.entered_by),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

function invalidateMarkQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["marks-sheet-page"] });
  queryClient.invalidateQueries({ queryKey: ["marks-sheet"] });
  queryClient.invalidateQueries({ queryKey: ["exam-mark-setup"] });
  queryClient.invalidateQueries({ queryKey: ["marks"] });
}

export async function fetchMarks(
  sessionId?: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Mark[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq("session_id", sid)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapMark(row));
}

export async function fetchMarksByRegistration(
  registrationId: string,
  sessionId?: string,
): Promise<Mark[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid || !registrationId) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq("session_id", sid)
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => mapMark(row));
}

export interface MarksSheetPageParams {
  examId: string;
  classId: string;
  institutionId?: string | null;
  subjectId: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sessionId?: string;
}

function mapMarksSheetPage(data: Record<string, any>): MarksSheetPage {
  const rows: MarksSheetPageRow[] = (data.rows || []).map((row: Record<string, any>) => ({
    registrationId: String(row.registration_id),
    studentId: String(row.student_id),
    studentName: String(row.student_name || ""),
    institutionId: String(row.institution_id),
    institutionName: String(row.institution_name || ""),
    registrationNumber: String(row.registration_number || ""),
    className: String(row.class_name || ""),
    examRoll: row.exam_roll ? String(row.exam_roll) : null,
    mark: row.marks === null || row.marks === undefined ? null : Number(row.marks),
    fullMarks: Number(row.full_marks),
    subjectName: String(row.subject_name || ""),
  }));

  return {
    rows,
    page: Number(data.page || 1),
    pageSize: Number(data.page_size || 50),
    totalMatching: Number(data.total_matching || 0),
    totalPages: Number(data.total_pages || 0),
    totalCandidates: Number(data.total_candidates || 0),
    summary: {
      totalCandidates: Number(data.summary?.total_candidates ?? data.total_candidates ?? 0),
      institutionsRepresented: Number(data.summary?.institutions_represented || 0),
      enteredCount: Number(data.summary?.entered_count || 0),
      missingCount: Number(data.summary?.missing_count || 0),
    },
  };
}

export async function fetchMarksSheetPage(params: MarksSheetPageParams): Promise<MarksSheetPage> {
  if (!params.examId || !params.classId || !params.subjectId) {
    throw new Error("Exam, class, and subject are required");
  }
  const session = params.sessionId || (await fetchCurrentSession())?.id;
  if (!session) throw new Error("No active session found");

  const { data, error } = await createClient().rpc("get_marks_sheet_page", {
    p_exam_id: params.examId,
    p_class_id: params.classId,
    p_institution_id: params.institutionId || null,
    p_subject_id: params.subjectId,
    p_search: params.search?.trim() || "",
    p_page: params.page || 1,
    p_page_size: params.pageSize || 50,
  });
  if (error) throw error;
  return mapMarksSheetPage((data || {}) as Record<string, any>);
}

export async function saveExamMarks(
  examId: string,
  rows: { registrationId: string; subjectId: string; marks: number }[],
): Promise<MarksSaveResult> {
  const { data, error } = await createClient().rpc("save_exam_marks", {
    p_exam_id: examId,
    p_rows: rows.map((row) => ({
      registration_id: row.registrationId,
      subject_id: row.subjectId,
      marks: row.marks,
    })),
  });
  if (error) throw error;

  const payload = (data || {}) as Record<string, any>;
  return {
    saved: Number(payload.saved || 0),
    updated: Number(payload.updated || 0),
    savedRows: (payload.saved_rows || []).map((row: Record<string, any>) => ({
      registrationId: String(row.registration_id),
      subjectId: String(row.subject_id),
      marks: Number(row.marks),
    })),
    updatedRows: (payload.updated_rows || []).map((row: Record<string, any>) => ({
      registrationId: String(row.registration_id),
      subjectId: String(row.subject_id),
      marks: Number(row.marks),
    })),
    rejected: (payload.rejected || []).map((row: Record<string, any>) => ({
      registrationId: row.registration_id || null,
      subjectId: row.subject_id || null,
      reason: String(row.reason || "Mark was rejected"),
    })),
  };
}

export async function saveExamMarkCell(
  examId: string,
  row: { registrationId: string; subjectId: string; marks: number },
): Promise<MarksSaveResult> {
  const result = await saveExamMarks(examId, [row]);
  if (result.rejected.length > 0) throw new Error(result.rejected[0].reason);
  if (result.saved + result.updated !== 1) throw new Error("The mark was not saved");
  return result;
}

export interface ClearExamMarkResult {
  success: boolean;
  cleared: number;
  reason: string;
}

export async function clearExamMark(
  examId: string,
  registrationId: string,
  subjectId: string,
): Promise<ClearExamMarkResult> {
  const { data, error } = await createClient().rpc("clear_exam_mark", {
    p_exam_id: examId,
    p_registration_id: registrationId,
    p_subject_id: subjectId,
  });
  if (error) throw error;
  const result = (data || {}) as Record<string, any>;
  if (!result.success) throw new Error(result.reason || "The mark could not be cleared");
  return {
    success: true,
    cleared: Number(result.cleared || 0),
    reason: String(result.reason || "Mark cleared"),
  };
}

export async function createMark(data: Omit<Mark, "id" | "createdAt" | "updatedAt">): Promise<Mark> {
  const { data: created, error } = await createClient()
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      student_id: data.studentId,
      registration_id: data.registrationId,
      exam_id: data.examId,
      subject_id: data.subjectId,
      subject_name: data.subjectName,
      marks: data.marks,
      entered_by: data.enteredBy,
    })
    .select(MARK_COLUMNS)
    .single();
  if (error) throw error;
  return mapMark(created);
}

export async function updateMark(id: string, data: Partial<Mark>): Promise<Mark> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fieldMap: Record<keyof Mark, string> = {
    id: "id",
    sessionId: "session_id",
    studentId: "student_id",
    registrationId: "registration_id",
    examId: "exam_id",
    subjectId: "subject_id",
    subjectName: "subject_name",
    marks: "marks",
    enteredBy: "entered_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  (Object.keys(fieldMap) as (keyof Mark)[]).forEach((field) => {
    if (data[field] !== undefined && field !== "id" && field !== "createdAt" && field !== "updatedAt") {
      updateData[fieldMap[field]] = data[field];
    }
  });
  const { data: updated, error } = await createClient()
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq("id", id)
    .select(MARK_COLUMNS)
    .single();
  if (error) throw error;
  return mapMark(updated);
}

export async function deleteMark(id: string): Promise<boolean> {
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq("id", id);
  if (error) throw error;
  return true;
}

export function useMarks(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ["marks", sessionId, page, pageSize],
    queryFn: () => fetchMarks(sessionId, page, pageSize),
    staleTime: 60_000,
  });
}

export function useMarksByRegistration(registrationId: string, sessionId?: string) {
  return useQuery({
    queryKey: ["marks", "registration", registrationId, sessionId],
    queryFn: () => fetchMarksByRegistration(registrationId, sessionId),
    enabled: !!registrationId,
    staleTime: 60_000,
  });
}

export function useMarksSheetPage(params: MarksSheetPageParams) {
  return useQuery({
    queryKey: [
      "marks-sheet-page",
      params.sessionId,
      params.examId,
      params.classId,
      params.institutionId || null,
      params.subjectId,
      params.search || "",
      params.page || 1,
      params.pageSize || 50,
    ],
    queryFn: () => fetchMarksSheetPage(params),
    enabled: !!(
      params.sessionId
      && params.examId
      && params.classId
      && params.subjectId
    ),
    staleTime: 30_000,
  });
}

export function useClearExamMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { examId: string; registrationId: string; subjectId: string }) =>
      clearExamMark(args.examId, args.registrationId, args.subjectId),
    onSuccess: () => invalidateMarkQueries(queryClient),
  });
}
