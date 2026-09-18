import { Mark } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'marks';
const SUPABASE_TABLE = 'marks';

function mapMark(data: any): Mark {
  return { id: data.id, sessionId: data.session_id, studentId: data.student_id, registrationId: data.registration_id, examId: data.exam_id, subjectId: data.subject_id, subjectName: data.subject_name, marks: data.marks, enteredBy: data.entered_by, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapMark);
      const existing = getStore<Mark>(KEY);
      const otherSessions = existing.filter(m => m.sessionId !== sid);
      setStore(KEY, [...items, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getMarks(): Mark[] {
  return getStore<Mark>(KEY);
}

// Async getters
export async function fetchMarks(sessionId?: string): Promise<Mark[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapMark);
}

export async function fetchMarksByRegistration(registrationId: string, sessionId?: string): Promise<Mark[]> {
  const marks = await fetchMarks(sessionId);
  return marks.filter(m => m.registrationId === registrationId);
}

// Async standalone CRUD
export async function createMark(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mark> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ session_id: data.sessionId, student_id: data.studentId, registration_id: data.registrationId, exam_id: data.examId, subject_id: data.subjectId, subject_name: data.subjectName, marks: data.marks, entered_by: data.enteredBy }).select().single();
  if (error) throw error;
  const mark = mapMark(result);
  const items = getMarks();
  items.unshift(mark);
  setStore(KEY, items);
  return mark;
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
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const mark = mapMark(result);
  const items = getMarks();
  const idx = items.findIndex(m => m.id === id);
  if (idx !== -1) items[idx] = mark;
  setStore(KEY, items);
  return mark;
}

export async function deleteMark(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getMarks().filter(m => m.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useMarks(sessionId?: string) { return useQuery({ queryKey: ['marks', sessionId], queryFn: () => fetchMarks(sessionId) }); }
export function useMarksByRegistration(registrationId: string, sessionId?: string) { return useQuery({ queryKey: ['marks', 'registration', registrationId], queryFn: () => fetchMarksByRegistration(registrationId, sessionId), enabled: !!registrationId }); }

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
