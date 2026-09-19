import { ExamCenter } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'exam_centers';

const EXAM_CENTER_COLUMNS = 'id,session_id,name,address,capacity,allocated,institution_id,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapExamCenter(data: any): ExamCenter {
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    address: data.address,
    capacity: data.capacity,
    allocated: data.allocated,
    institutionId: data.institution_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchExamCenters(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<ExamCenter[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(EXAM_CENTER_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapExamCenter);
}

export async function fetchExamCenterById(id: string): Promise<ExamCenter | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(EXAM_CENTER_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapExamCenter(data);
}

export async function createExamCenter(data: Omit<ExamCenter, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExamCenter> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      name: data.name,
      address: data.address,
      capacity: data.capacity,
      allocated: data.allocated,
      institution_id: data.institutionId,
    })
    .select(EXAM_CENTER_COLUMNS)
    .single();
  if (error) throw error;
  return mapExamCenter(result);
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
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(EXAM_CENTER_COLUMNS).single();
  if (error) return undefined;
  return mapExamCenter(result);
}

export async function deleteExamCenter(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useExamCenters(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['exam_centers', sessionId, page, pageSize],
    queryFn: () => fetchExamCenters(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}
export function useExamCenterById(id: string) {
  return useQuery({
    queryKey: ['exam_centers', id],
    queryFn: () => fetchExamCenterById(id),
    enabled: !!id,
  });
}

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
