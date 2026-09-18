import { ExamCenter } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'exam_centers';
const SUPABASE_TABLE = 'exam_centers';

function mapExamCenter(data: any): ExamCenter {
  return { id: data.id, sessionId: data.session_id, name: data.name, address: data.address, capacity: data.capacity, allocated: data.allocated, institutionId: data.institution_id, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapExamCenter);
      const existing = getStore<ExamCenter>(KEY);
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
export function getExamCenters(): ExamCenter[] {
  return getStore<ExamCenter>(KEY);
}

// Async getters
export async function fetchExamCenters(sessionId?: string): Promise<ExamCenter[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExamCenter);
}

export async function fetchExamCenterById(id: string): Promise<ExamCenter | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapExamCenter(data);
}

// Async standalone CRUD
export async function createExamCenter(data: Omit<ExamCenter, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamCenter> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ session_id: data.sessionId, name: data.name, address: data.address, capacity: data.capacity, allocated: data.allocated, institution_id: data.institutionId }).select().single();
  if (error) throw error;
  const center = mapExamCenter(result);
  const items = getExamCenters();
  items.unshift(center);
  setStore(KEY, items);
  return center;
}

export async function updateExamCenter(id: string, data: Partial<ExamCenter>): Promise<ExamCenter | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.name !== undefined) u.name = data.name;
  if (data.address !== undefined) u.address = data.address;
  if (data.capacity !== undefined) u.capacity = data.capacity;
  if (data.allocated !== undefined) u.allocated = data.allocated;
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const center = mapExamCenter(result);
  const items = getExamCenters();
  const idx = items.findIndex(e => e.id === id);
  if (idx !== -1) items[idx] = center;
  setStore(KEY, items);
  return center;
}

export async function deleteExamCenter(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getExamCenters().filter(e => e.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useExamCenters(sessionId?: string) { return useQuery({ queryKey: ['exam_centers', sessionId], queryFn: () => fetchExamCenters(sessionId) }); }
export function useExamCenterById(id: string) { return useQuery({ queryKey: ['exam_centers', id], queryFn: () => fetchExamCenterById(id), enabled: !!id }); }

export function useCreateExamCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ExamCenter, 'id' | 'createdAt' | 'updatedAt'>) => createExamCenter(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam_centers'] }),
  });
}

export function useUpdateExamCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExamCenter> }) => updateExamCenter(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam_centers'] }),
  });
}

export function useDeleteExamCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExamCenter(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exam_centers'] }),
  });
}
