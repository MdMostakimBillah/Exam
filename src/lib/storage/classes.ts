import { Class } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SUPABASE_TABLE = 'classes';

const CLASS_COLUMNS = 'id,name,code,description,is_active,created_at,updated_at';

function mapClass(data: any): Class {
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    description: data.description,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchClasses(): Promise<Class[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from(SUPABASE_TABLE).select(CLASS_COLUMNS).order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapClass);
}

export async function fetchClassById(id: string): Promise<Class | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(CLASS_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapClass(data);
}

export async function fetchActiveClasses(): Promise<Class[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from(SUPABASE_TABLE).select(CLASS_COLUMNS).eq('is_active', true).order('name', { ascending: true });
  if (error || !data) return [];
  return data.map(mapClass);
}

export async function createClass(data: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<Class> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ name: data.name, code: data.code, description: data.description, is_active: data.isActive }).select(CLASS_COLUMNS).single();
  if (error) throw error;
  return mapClass(result);
}

export async function updateClass(id: string, data: Partial<Class>): Promise<Class | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.code !== undefined) u.code = data.code;
  if (data.description !== undefined) u.description = data.description;
  if (data.isActive !== undefined) u.is_active = data.isActive;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(CLASS_COLUMNS).single();
  if (error) return undefined;
  return mapClass(result);
}

export async function deleteClass(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export const CLASSES_STALE_TIME = 5 * 60 * 1000;

export function useClasses() { return useQuery({ queryKey: ['classes'], queryFn: fetchClasses, staleTime: CLASSES_STALE_TIME }); }
export function useActiveClasses() { return useQuery({ queryKey: ['classes', 'active'], queryFn: fetchActiveClasses, staleTime: CLASSES_STALE_TIME }); }
export function useClassById(id: string) { return useQuery({ queryKey: ['classes', id], queryFn: () => fetchClassById(id), enabled: !!id, staleTime: CLASSES_STALE_TIME }); }

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
