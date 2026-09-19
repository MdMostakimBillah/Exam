import { Mark } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'marks';

const MARK_COLUMNS = 'id,session_id,student_id,registration_id,exam_id,subject_id,subject_name,marks,entered_by,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapMark(data: any): Mark {
  return {
    id: data.id,
    sessionId: data.session_id,
    studentId: data.student_id,
    registrationId: data.registration_id,
    examId: data.exam_id,
    subjectId: data.subject_id,
    subjectName: data.subject_name,
    marks: data.marks,
    enteredBy: data.entered_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchMarks(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Mark[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapMark);
}

export async function fetchMarksByRegistration(registrationId: string, sessionId?: string): Promise<Mark[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq('session_id', sid)
    .eq('registration_id', registrationId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapMark);
}

export async function createMark(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mark> {
  const supabase = createClient();
  const { data: result, error } = await supabase
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
  return mapMark(result);
}

export async function updateMark(id: string, data: Partial<Mark>): Promise<Mark | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.registrationId !== undefined) u.registration_id = data.registrationId;
  if (data.examId !== undefined) u.exam_id = data.examId;
  if (data.subjectId !== undefined) u.subject_id = data.subjectId;
  if (data.subjectName !== undefined) u.subject_name = data.subjectName;
  if (data.marks !== undefined) u.marks = data.marks;
  if (data.enteredBy !== undefined) u.entered_by = data.enteredBy;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(MARK_COLUMNS).single();
  if (error) return undefined;
  return mapMark(result);
}

export async function deleteMark(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useMarks(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['marks', sessionId, page, pageSize],
    queryFn: () => fetchMarks(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}
export function useMarksByRegistration(registrationId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['marks', 'registration', registrationId],
    queryFn: () => fetchMarksByRegistration(registrationId, sessionId),
    enabled: !!registrationId,
    staleTime: 60 * 1000,
  });
}

export function useCreateMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>) => createMark(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marks'] }),
  });
}

export function useUpdateMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Mark> }) => updateMark(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marks'] }),
  });
}

export function useDeleteMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMark(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marks'] }),
  });
}
