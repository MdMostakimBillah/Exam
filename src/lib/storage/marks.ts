import { Mark } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'marks';

const MARK_COLUMNS = 'id,session_id,student_id,registration_id,exam_id,subject_id,subject_name,marks,entered_by,created_at,updated_at';

export interface SubjectMark {
  subjectId: string;
  subjectName: string;
  fullMarks: number;
  marks: number | null;
}

export interface SheetRow {
  registrationId: string;
  studentName: string;
  studentId: string;
  registrationNumber: string;
  className: string;
  examRoll: string | null;
  roll: string | null;
  firstName: string;
  lastName: string;
  subjectMarks: SubjectMark[];
}

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

/** All approved registrations for an exam + class (no page cap), each with their per-subject marks, sorted by exam_roll. */
export async function fetchMarksSheet(examId: string, className: string, sessionId?: string): Promise<SheetRow[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];

  const { data: regs, error: regErr } = await supabase
    .from('registrations')
    .select('id,student_id,student_name,registration_number,class_name')
    .eq('session_id', sid)
    .eq('exam_id', examId)
    .eq('class_name', className)
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false });
  if (regErr || !regs) return [];

  const regIds = regs.map((r: any) => r.id);
  if (regIds.length === 0) return [];

  // All marks for these registrations.
  const { data: marks, error: markErr } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq('session_id', sid)
    .in('registration_id', regIds);
  if (markErr && markErr.code !== 'PGRST101') return [];

  // Group marks by registration_id -> SubjectMark[].
  const marksByReg = new Map<string, Mark[]>();
  (marks || []).forEach((m: Mark) => {
    const arr = marksByReg.get(m.registrationId) || [];
    arr.push(m);
    marksByReg.set(m.registrationId, arr);
  });

  // Student exam roll, one query.
  const studentIds = [...new Set(regs.map((r: any) => r.student_id))];
  const { data: students, error: stuErr } = await supabase
    .from('students')
    .select('id,exam_roll,roll,first_name,last_name')
    .in('id', studentIds);
  if (stuErr) return [];

  const stuMap = new Map<string, { examRoll: string | null; roll: string | null; firstName: string; lastName: string }>();
  (students || []).forEach((s: any) => stuMap.set(s.id, { examRoll: s.exam_roll, roll: s.roll, firstName: s.first_name, lastName: s.last_name }));

  return regs.map((r: any) => {
    const regMarks = marksByReg.get(r.id) || [];
    const s = stuMap.get(r.student_id) || { examRoll: null, roll: null, firstName: '', lastName: '' };
    return {
      registrationId: r.id,
      studentName: r.student_name,
      studentId: r.student_id,
      registrationNumber: r.registration_number || '',
      className: r.class_name || className,
      examRoll: s.examRoll,
      roll: s.roll,
      firstName: s.firstName,
      lastName: s.lastName,
      subjectMarks: regMarks.map((m: Mark) => ({
        subjectId: m.subjectId,
        subjectName: m.subjectName,
        fullMarks: 0,
        marks: m.marks,
      })),
    };
  }).sort((a: SheetRow, b: SheetRow) => {
    const ra = a.examRoll ? parseInt(a.examRoll) : Infinity;
    const rb = b.examRoll ? parseInt(b.examRoll) : Infinity;
    return ra - rb;
  });
}

/** Marks for a given list of registration ids (no page cap), scoped to the current session. */
export async function fetchMarksByRegistrationIds(registrationIds: string[], sessionId?: string): Promise<Mark[]> {
  if (registrationIds.length === 0) return [];
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(MARK_COLUMNS)
    .eq('session_id', sid)
    .in('registration_id', registrationIds);
  if (error || !data) return [];
  return data.map(mapMark);
}

export async function saveExamMarks(examId: string, rows: { registrationId: string; subjectId: string; marks: number }[]): Promise<{ saved: number; updated: number; rejected: unknown[] }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('save_exam_marks', { p_exam_id: examId, p_rows: rows });
  if (error) throw error;
  return { saved: data.saved ?? 0, updated: data.updated ?? 0, rejected: data.rejected ?? [] };
}

export async function createMark(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mark> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId, student_id: data.studentId, registration_id: data.registrationId,
      exam_id: data.examId, subject_id: data.subjectId, subject_name: data.subjectName,
      marks: data.marks, entered_by: data.enteredBy,
    })
    .select(MARK_COLUMNS)
    .single();
  if (error) throw error;
  return mapMark(result);
}

export async function updateMark(id: string, data: Partial<Mark>): Promise<Mark | undefined> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE).update(data).eq('id', id).select(MARK_COLUMNS).single();
  if (error) return undefined;
  return mapMark(result);
}

export async function deleteMark(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function useMarks(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['marks', sessionId, page, pageSize],
    queryFn: () => fetchMarks(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}

export function useMarksSheet(examId: string, className: string, sessionId?: string) {
  return useQuery<SheetRow[]>({
    queryKey: ['marks-sheet', examId, className, sessionId],
    queryFn: () => fetchMarksSheet(examId, className, sessionId),
    enabled: !!examId && !!className,
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

export function useSaveExamMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { examId: string; rows: { registrationId: string; subjectId: string; marks: number }[] }) =>
      saveExamMarks(args.examId, args.rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marks'] });
      qc.invalidateQueries({ queryKey: ['results'] });
    },
  });
}
