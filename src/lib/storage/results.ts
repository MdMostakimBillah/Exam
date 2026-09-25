import { Result } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'results';

const RESULT_LIST_COLUMNS = 'id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,mark_setup_version,created_at,updated_at';

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

export function useResultById(id: string) {
  return useQuery({
    queryKey: ['results', id],
    queryFn: () => fetchResultById(id),
    enabled: !!id,
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
}

export async function processExamResults(examId: string): Promise<ProcessExamResultsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('process_exam_results', { p_exam_id: examId });
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
  };
}

export function useProcessExamResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => processExamResults(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}
