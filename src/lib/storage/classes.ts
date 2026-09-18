import { Class } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const KEY = 'classes';
const SUPABASE_TABLE = 'classes';

function mapClass(data: any): Class {
  return { id: data.id, name: data.name, code: data.code, description: data.description, isActive: data.is_active, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').order('name', { ascending: true });
    if (!error && data) {
      const items = data.map(mapClass);
      setStore(KEY, items);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getClasses(): Class[] {
  return getStore<Class>(KEY);
}

export function getActiveClasses(): Class[] {
  return getClasses().filter(c => c.isActive);
}

// Async getters
export async function fetchClasses(): Promise<Class[]> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapClass);
}

export async function fetchClassById(id: string): Promise<Class | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapClass(data);
}

export async function fetchActiveClasses(): Promise<Class[]> {
  const classes = await fetchClasses();
  return classes.filter(c => c.isActive);
}

// Async standalone CRUD
export async function createClass(data: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<Class> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ name: data.name, code: data.code, description: data.description, is_active: data.isActive }).select().single();
  if (error) throw error;
  const cls = mapClass(result);
  const items = getClasses();
  items.unshift(cls);
  setStore(KEY, items);
  return cls;
}

export async function updateClass(id: string, data: Partial<Class>): Promise<Class | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.code !== undefined) u.code = data.code;
  if (data.description !== undefined) u.description = data.description;
  if (data.isActive !== undefined) u.is_active = data.isActive;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const cls = mapClass(result);
  const items = getClasses();
  const idx = items.findIndex(c => c.id === id);
  if (idx !== -1) items[idx] = cls;
  setStore(KEY, items);
  return cls;
}

export async function deleteClass(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getClasses().filter(c => c.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useClasses() { return useQuery({ queryKey: ['classes'], queryFn: fetchClasses }); }
export function useActiveClasses() { return useQuery({ queryKey: ['classes', 'active'], queryFn: fetchActiveClasses }); }
export function useClassById(id: string) { return useQuery({ queryKey: ['classes', id], queryFn: () => fetchClassById(id), enabled: !!id }); }

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>) => createClass(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Class> }) => updateClass(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
}
