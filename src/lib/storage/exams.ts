import { Exam } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'exams';
const SUPABASE_TABLE = 'exams';

function mapExam(data: any): Exam {
  return { id: data.id, sessionId: data.session_id, name: data.name, code: data.code, academicYear: data.academic_year, description: data.description, registrationStartDate: data.registration_start_date, registrationEndDate: data.registration_end_date, examDate: data.exam_date, registrationFee: data.registration_fee, lateFee: data.late_fee, classes: data.classes || [], subjects: data.subjects || [], status: data.status, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapExam);
      const existing = getStore<Exam>(KEY);
      const otherSessions = existing.filter(e => e.sessionId !== sid);
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
export function getExams(): Exam[] {
  return getStore<Exam>(KEY);
}

export function getExamById(id: string): Exam | undefined {
  return getExams().find(e => e.id === id);
}

// Async getters
export async function fetchExams(sessionId?: string): Promise<Exam[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExam);
}

export async function fetchExamById(id: string): Promise<Exam | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapExam(data);
}

// Async standalone CRUD
export async function createExam(data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exam> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ session_id: data.sessionId, name: data.name, code: data.code, academic_year: data.academicYear, description: data.description, registration_start_date: data.registrationStartDate, registration_end_date: data.registrationEndDate, exam_date: data.examDate, registration_fee: data.registrationFee, late_fee: data.lateFee, classes: data.classes, subjects: data.subjects, status: data.status }).select().single();
  if (error) throw error;
  const exam = mapExam(result);
  const items = getExams();
  items.unshift(exam);
  setStore(KEY, items);
  return exam;
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
  if (data.examDate !== undefined) u.exam_date = data.examDate;
  if (data.registrationFee !== undefined) u.registration_fee = data.registrationFee;
  if (data.lateFee !== undefined) u.late_fee = data.lateFee;
  if (data.classes !== undefined) u.classes = data.classes;
  if (data.subjects !== undefined) u.subjects = data.subjects;
  if (data.status !== undefined) u.status = data.status;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const exam = mapExam(result);
  const items = getExams();
  const idx = items.findIndex(e => e.id === id);
  if (idx !== -1) items[idx] = exam;
  setStore(KEY, items);
  return exam;
}

export async function deleteExam(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getExams().filter(e => e.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useExams(sessionId?: string) { return useQuery({ queryKey: ['exams', sessionId], queryFn: () => fetchExams(sessionId) }); }
export function useExamById(id: string) { return useQuery({ queryKey: ['exams', id], queryFn: () => fetchExamById(id), enabled: !!id }); }

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
