import { Exam } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'exams';

const EXAM_LIST_COLUMNS = 'id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapExam(data: any): Exam {
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    code: data.code,
    academicYear: data.academic_year,
    description: data.description,
    registrationStartDate: data.registration_start_date,
    registrationEndDate: data.registration_end_date,
    examDate: data.exam_date,
    examStartDate: data.exam_start_date,
    examEndDate: data.exam_end_date,
    registrationFee: data.registration_fee,
    lateFee: data.late_fee,
    classes: data.classes || [],
    subjects: data.subjects || [],
    routine: data.routine || [],
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchExams(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Exam[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(EXAM_LIST_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapExam);
}

export async function fetchExamsFull(sessionId?: string): Promise<Exam[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at')
    .eq('session_id', sid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExam);
}

export async function fetchExamById(id: string): Promise<Exam | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at').eq('id', id).single();
  if (error || !data) return undefined;
  return mapExam(data);
}

export async function createExam(data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exam> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      name: data.name,
      code: data.code,
      academic_year: data.academicYear,
      description: data.description,
      registration_start_date: data.registrationStartDate,
      registration_end_date: data.registrationEndDate,
      exam_date: data.examDate || null,
      exam_start_date: data.examStartDate || null,
      exam_end_date: data.examEndDate || null,
      registration_fee: data.registrationFee,
      late_fee: data.lateFee,
      classes: data.classes,
      subjects: data.subjects,
      routine: data.routine || [],
      status: data.status,
    })
    .select('id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at')
    .single();
  if (error) throw error;
  return mapExam(result);
}

export async function updateExam(id: string, data: Partial<Exam>): Promise<Exam | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.name !== undefined) u.name = data.name;
  if (data.code !== undefined) u.code = data.code;
  if (data.academicYear !== undefined) u.academic_year = data.academicYear;
  if (data.description !== undefined) u.description = data.description;
  if (data.registrationStartDate !== undefined) u.registration_start_date = data.registrationStartDate;
  if (data.registrationEndDate !== undefined) u.registration_end_date = data.registrationEndDate;
  if (data.examDate !== undefined) u.exam_date = data.examDate || null;
  if (data.examStartDate !== undefined) u.exam_start_date = data.examStartDate || null;
  if (data.examEndDate !== undefined) u.exam_end_date = data.examEndDate || null;
  if (data.registrationFee !== undefined) u.registration_fee = data.registrationFee;
  if (data.lateFee !== undefined) u.late_fee = data.lateFee;
  if (data.classes !== undefined) u.classes = data.classes;
  if (data.subjects !== undefined) u.subjects = data.subjects;
  if (data.routine !== undefined) u.routine = data.routine;
  if (data.status !== undefined) u.status = data.status;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select('id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at').single();
  if (error) throw error; // surface real write failures instead of faking success
  return mapExam(result);
}

export async function deleteExam(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useExams(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['exams', sessionId, page, pageSize],
    queryFn: () => fetchExams(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}
export function useExamById(id: string) {
  return useQuery({
    queryKey: ['exams', id],
    queryFn: () => fetchExamById(id),
    enabled: !!id,
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>) => createExam(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  });
}

export function useUpdateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Exam> }) => updateExam(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
  });
}

export async function fetchExamRegistrationCounts(sessionId?: string): Promise<Record<string, number>> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return {};
  const { data, error } = await supabase.rpc('get_exam_registration_counts', { p_session_id: sid });
  if (error || !data) return {};
  return (data as Array<{ exam_id: string; registration_count: number }>).reduce(
    (acc, row) => { acc[row.exam_id] = Number(row.registration_count); return acc; },
    {} as Record<string, number>
  );
}

export function useExamRegistrationCounts(sessionId?: string) {
  return useQuery({
    queryKey: ['exam_registration_counts', sessionId],
    queryFn: () => fetchExamRegistrationCounts(sessionId),
    enabled: !!sessionId,
    staleTime: 60 * 1000,
  });
}
