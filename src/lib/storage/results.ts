import { Result } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'results';

const RESULT_LIST_COLUMNS = 'id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,mark_setup_version,marksheet_generated_at,created_at,updated_at';

const RESULT_FULL_COLUMNS = RESULT_LIST_COLUMNS + ',subject_marks';

const DEFAULT_PAGE_SIZE = 20;
const EXAM_RESULTS_PAGE_SIZE = 200;

function mapResult(data: any): Result {
  return {
    id: data.id,
    sessionId: data.session_id,
    studentId: data.student_id,
    studentName: data.student_name,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    examId: data.exam_id,
    examName: data.exam_name,
    className: data.class_name,
    roll: data.roll,
    registrationNumber: data.registration_number,
    subjectMarks: data.subject_marks || [],
    totalMarks: Number(data.total_marks ?? 0),
    totalFullMarks: Number(data.total_full_marks ?? 0),
    percentage: Number(data.percentage ?? 0),
    grade: data.grade || '',
    position: Number(data.position ?? 0),
    pass: Boolean(data.pass),
    scholarshipStatus: data.scholarship_status || 'PENDING',
    status: data.status,
    markSetupVersion: data.mark_setup_version === null || data.mark_setup_version === undefined
      ? null
      : Number(data.mark_setup_version),
    marksheetGeneratedAt: data.marksheet_generated_at ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchResults(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Result[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_LIST_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []).map(mapResult);
}

export async function fetchResultsByInstitution(institutionId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Result[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_FULL_COLUMNS)
    .eq('session_id', sid)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []).map(mapResult);
}

export async function fetchResultsByExam(examId: string, sessionId?: string, page: number = 1, pageSize: number = EXAM_RESULTS_PAGE_SIZE): Promise<Result[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_LIST_COLUMNS)
    .eq('session_id', sid)
    .eq('exam_id', examId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []).map(mapResult);
}

/**
 * Every result of an exam WITH subject_marks — pages through the table until
 * exhausted so the tabulation sheet export always covers all candidates.
 * (The list variant intentionally omits the heavy subject_marks JSONB.)
 */
export async function fetchResultsByExamFull(examId: string, sessionId?: string, pageSize: number = 500): Promise<Result[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const all: Result[] = [];
  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(RESULT_FULL_COLUMNS)
      .eq('session_id', sid)
      .eq('exam_id', examId)
      // id as a stable tie-breaker: processed rows share created_at, and an
      // unstable order would duplicate/drop rows across range pages.
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []).map(mapResult);
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

/**
 * One student's OWN result rows for the student-portal Marksheet. Filtered
 * by student_id only: RLS already restricts a student to their own rows
 * (migration 0038), so there is no session filter to depend on.
 */
export async function fetchResultsByStudent(studentId: string, pageSize: number = 100): Promise<Result[]> {
  const supabase = createClient();
  if (!studentId) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_FULL_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(pageSize);
  if (error) throw error;
  return (data || []).map(mapResult);
}

export async function fetchResultById(id: string): Promise<Result | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(RESULT_FULL_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapResult(data);
}

export async function createResult(data: Omit<Result, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      student_id: data.studentId,
      student_name: data.studentName,
      institution_id: data.institutionId,
      institution_name: data.institutionName,
      exam_id: data.examId,
      exam_name: data.examName,
      class_name: data.className,
      roll: data.roll,
      registration_number: data.registrationNumber,
      subject_marks: data.subjectMarks,
      total_marks: data.totalMarks,
      total_full_marks: data.totalFullMarks,
      percentage: data.percentage,
      grade: data.grade,
      position: data.position,
      pass: data.pass,
      scholarship_status: data.scholarshipStatus,
      status: data.status,
      mark_setup_version: data.markSetupVersion,
    })
    .select(RESULT_FULL_COLUMNS)
    .single();
  if (error) throw error;
  return mapResult(result);
}

export async function updateResult(id: string, data: Partial<Result>): Promise<Result> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.studentName !== undefined) updateData.student_name = data.studentName;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.institutionName !== undefined) updateData.institution_name = data.institutionName;
  if (data.examId !== undefined) updateData.exam_id = data.examId;
  if (data.examName !== undefined) updateData.exam_name = data.examName;
  if (data.className !== undefined) updateData.class_name = data.className;
  if (data.roll !== undefined) updateData.roll = data.roll;
  if (data.registrationNumber !== undefined) updateData.registration_number = data.registrationNumber;
  if (data.subjectMarks !== undefined) updateData.subject_marks = data.subjectMarks;
  if (data.totalMarks !== undefined) updateData.total_marks = data.totalMarks;
  if (data.totalFullMarks !== undefined) updateData.total_full_marks = data.totalFullMarks;
  if (data.percentage !== undefined) updateData.percentage = data.percentage;
  if (data.grade !== undefined) updateData.grade = data.grade;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.pass !== undefined) updateData.pass = data.pass;
  if (data.scholarshipStatus !== undefined) updateData.scholarship_status = data.scholarshipStatus;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.markSetupVersion !== undefined) updateData.mark_setup_version = data.markSetupVersion;

  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select(RESULT_FULL_COLUMNS)
    .single();
  if (error) throw error;
  return mapResult(result);
}

export async function deleteResult(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function useResults(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['results', sessionId, page, pageSize],
    queryFn: () => fetchResults(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}

export function useResultsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['results', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchResultsByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 60 * 1000,
  });
}

export function useResultsByExam(examId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['results', 'exam', examId, sessionId, page || 1, pageSize || EXAM_RESULTS_PAGE_SIZE],
    queryFn: () => fetchResultsByExam(examId, sessionId, page, pageSize),
    enabled: !!examId,
    staleTime: 60 * 1000,
  });
}

export function useResultsByExamFull(examId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['results', 'exam-full', examId, sessionId],
    queryFn: () => fetchResultsByExamFull(examId, sessionId),
    enabled: !!examId,
    staleTime: 60 * 1000,
  });
}

export function useResultById(id: string) {
  return useQuery({
    queryKey: ['results', id],
    queryFn: () => fetchResultById(id),
    enabled: !!id,
  });
}

export function useResultsByStudent(studentId: string) {
  return useQuery({
    queryKey: ['results', 'student', studentId],
    queryFn: () => fetchResultsByStudent(studentId),
    enabled: !!studentId,
    staleTime: 60 * 1000,
  });
}

export function useCreateResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Result, 'id' | 'createdAt' | 'updatedAt'>) => createResult(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['results'] }); },
  });
}

export function useUpdateResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Result> }) => updateResult(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['results'] }); },
  });
}

export function useDeleteResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteResult(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['results'] }); },
  });
}

export interface ProcessExamResultsResult {
  processed: number;
  skipped: number;
  missingIncomplete: number;
  withoutRequiredSubjects: number;
  totalRegistrations: number;
  totalUniqueStudents: number;
  setupVersion: number;
  /** Class the run was scoped to, or null when the whole exam was processed. */
  className: string | null;
}

/**
 * Run the result-generation RPC.
 *
 * `className` scopes the run to a single class (class-wise processing, so
 * marks do not have to be complete for every class first); omitting it keeps
 * the original whole-exam behaviour. Other classes' stored results are never
 * touched by a scoped run.
 */
export async function processExamResults(examId: string, className?: string): Promise<ProcessExamResultsResult> {
  const supabase = createClient();
  const scopedClass = className?.trim() ? className.trim() : null;
  const { data, error } = await supabase.rpc('process_exam_results', {
    p_exam_id: examId,
    p_class_name: scopedClass,
  });
  if (error) throw error;
  const result = (data || {}) as Record<string, any>;
  return {
    processed: Number(result.processed || 0),
    skipped: Number(result.skipped || 0),
    missingIncomplete: Number(result.missing_incomplete || 0),
    withoutRequiredSubjects: Number(result.without_required_subjects || 0),
    totalRegistrations: Number(result.total_registrations || 0),
    totalUniqueStudents: Number(result.total_unique_students || 0),
    setupVersion: Number(result.setup_version || 0),
    className: typeof result.class_name === 'string' && result.class_name ? result.class_name : null,
  };
}

export function useProcessExamResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, className }: { examId: string; className?: string }) =>
      processExamResults(examId, className),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

/**
 * Release the marksheet for an exam — or one class of it (0040).
 *
 * Stamps `marksheet_generated_at` on every matching result row; only then
 * does the public /marksheet lookup return a transcript. Re-running simply
 * refreshes the timestamp (the button says so, no harm in a second pass).
 * Returns the number of rows released so the caller can report it.
 */
export async function generateMarksheets(examId: string, className?: string): Promise<number> {
  const supabase = createClient();
  const scopedClass = className?.trim() ? className.trim() : null;
  let query = supabase
    .from(SUPABASE_TABLE)
    .update({ marksheet_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('exam_id', examId);
  if (scopedClass) query = query.eq('class_name', scopedClass);
  const { data, error } = await query.select('id');
  if (error) throw error;
  return (data || []).length;
}

export function useGenerateMarksheets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, className }: { examId: string; className?: string }) =>
      generateMarksheets(examId, className),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['marksheets'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Class-wise publishing (results page → Publish tab)                 */
/* ------------------------------------------------------------------ */

export interface ClassPublishStatus {
  className: string;
  total: number;
  published: number;
}

export interface ExamPublishStatus {
  classes: ClassPublishStatus[];
  total: number;
  published: number;
  /** `exams.status` at read time — flips to PUBLISHED once every class is out. */
  examStatus: string | null;
}

/**
 * Per-class publish counts for an exam, read straight from the table in
 * 1000-row pages: the publish tab must list EVERY class of the exam, not
 * just the rows the 200-row results list happens to hold.
 */
export async function fetchExamPublishStatus(examId: string): Promise<ExamPublishStatus> {
  const supabase = createClient();
  const PAGE = 1000;
  const rows: { class_name: string | null; status: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('class_name,status')
      .eq('exam_id', examId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data as { class_name: string | null; status: string }[]) || []));
    if (!data || data.length < PAGE) break;
  }

  const byClass = new Map<string, ClassPublishStatus>();
  for (const row of rows) {
    const name = row.class_name || '—';
    const entry = byClass.get(name) || { className: name, total: 0, published: 0 };
    entry.total += 1;
    if (row.status === 'PUBLISHED') entry.published += 1;
    byClass.set(name, entry);
  }

  const { data: examRow, error: examError } = await supabase
    .from('exams')
    .select('status')
    .eq('id', examId)
    .limit(1)
    .maybeSingle();
  if (examError) throw examError;

  return {
    classes: [...byClass.values()].sort((a, b) => a.className.localeCompare(b.className)),
    total: rows.length,
    published: rows.filter((row) => row.status === 'PUBLISHED').length,
    examStatus: (examRow as { status?: string } | null)?.status ?? null,
  };
}

export function useExamPublishStatus(examId: string) {
  return useQuery({
    queryKey: ['results', 'publish-status', examId],
    queryFn: () => fetchExamPublishStatus(examId),
    enabled: !!examId,
    staleTime: 15 * 1000,
  });
}

export interface PublishClassResult {
  /** Rows this call moved to PUBLISHED (0 = already published). */
  published: number;
  /** Every result row the exam holds. */
  total: number;
  /** Rows still not PUBLISHED anywhere in the exam, after this call. */
  remaining: number;
  /** True when this was the last class — the exam itself flipped to PUBLISHED. */
  examPublished: boolean;
}

/**
 * Publish every result of ONE class. When that leaves the exam with no
 * unpublished rows left, `exams.status` is set to PUBLISHED too — so the
 * exam goes live on /result the moment the last class is published, without
 * a second manual switch.
 */
export async function publishClassResults(examId: string, className: string): Promise<PublishClassResult> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from(SUPABASE_TABLE)
    .update({ status: 'PUBLISHED', updated_at: now })
    .eq('exam_id', examId)
    .eq('class_name', className)
    .neq('status', 'PUBLISHED')
    .select('id');
  if (updateError) throw updateError;

  const { count: remainingCount, error: remainingError } = await supabase
    .from(SUPABASE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId)
    .neq('status', 'PUBLISHED');
  if (remainingError) throw remainingError;

  const { count: totalCount, error: totalError } = await supabase
    .from(SUPABASE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', examId);
  if (totalError) throw totalError;

  const remaining = remainingCount ?? 0;
  const total = totalCount ?? 0;
  let examPublished = false;

  if (total > 0 && remaining === 0) {
    const { error: examError } = await supabase
      .from('exams')
      .update({ status: 'PUBLISHED', updated_at: now })
      .eq('id', examId)
      .neq('status', 'PUBLISHED')
      .select('id');
    if (examError) throw examError;
    examPublished = true;
  }

  return { published: (updated || []).length, total, remaining, examPublished };
}

export function usePublishClassResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, className }: { examId: string; className: string }) =>
      publishClassResults(examId, className),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });
}
