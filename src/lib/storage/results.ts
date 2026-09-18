import { Result } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'results';
const SUPABASE_TABLE = 'results';

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
    totalMarks: data.total_marks,
    totalFullMarks: data.total_full_marks,
    percentage: data.percentage,
    grade: data.grade,
    position: data.position,
    pass: data.pass,
    scholarshipStatus: data.scholarship_status,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const results = data.map(mapResult);
      const existing = getStore<Result>(KEY);
      const otherSessions = existing.filter(r => r.sessionId !== sid);
      setStore(KEY, [...results, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getResults(): Result[] {
  return getStore<Result>(KEY);
}

export function getResultsByInstitution(institutionId: string): Result[] {
  return getResults().filter(r => r.institutionId === institutionId);
}

// Async getters
export async function fetchResults(sessionId?: string): Promise<Result[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .eq('session_id', sid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapResult);
}

export async function fetchResultsByInstitution(institutionId: string, sessionId?: string): Promise<Result[]> {
  const results = await fetchResults(sessionId);
  return results.filter(r => r.institutionId === institutionId);
}

export async function fetchResultsByExam(examId: string, sessionId?: string): Promise<Result[]> {
  const results = await fetchResults(sessionId);
  return results.filter(r => r.examId === examId);
}

export async function fetchResultById(id: string): Promise<Result | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return mapResult(data);
}

// Async standalone CRUD
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
    })
    .select()
    .single();
  if (error) throw error;
  const res = mapResult(result);
  const items = getResults();
  items.unshift(res);
  setStore(KEY, items);
  return res;
}

export async function updateResult(id: string, data: Partial<Result>): Promise<Result | undefined> {
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

  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) return undefined;
  const res = mapResult(result);
  const items = getResults();
  const idx = items.findIndex(r => r.id === id);
  if (idx !== -1) items[idx] = res;
  setStore(KEY, items);
  return res;
}

export async function deleteResult(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getResults().filter(r => r.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useResults(sessionId?: string) {
  return useQuery({
    queryKey: ['results', sessionId],
    queryFn: () => fetchResults(sessionId),
  });
}

export function useResultsByInstitution(institutionId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['results', 'institution', institutionId, sessionId],
    queryFn: () => fetchResultsByInstitution(institutionId, sessionId),
    enabled: !!institutionId,
  });
}

export function useResultsByExam(examId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['results', 'exam', examId, sessionId],
    queryFn: () => fetchResultsByExam(examId, sessionId),
    enabled: !!examId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useUpdateResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Result> }) => updateResult(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

export function useDeleteResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}
