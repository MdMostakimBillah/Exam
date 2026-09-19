import { AcademicSession } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SUPABASE_TABLE = 'academic_sessions';

const SESSION_COLUMNS = 'id,name,code,start_date,end_date,is_active,is_current,created_at,updated_at';

function mapSession(data: any): AcademicSession {
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    startDate: data.start_date,
    endDate: data.end_date,
    isActive: data.is_active,
    isCurrent: data.is_current,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchSessions(): Promise<AcademicSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(SESSION_COLUMNS)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapSession);
}

export async function fetchCurrentSession(): Promise<AcademicSession | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(SESSION_COLUMNS)
    .eq('is_current', true)
    .single();
  if (error || !data) {
    const sessions = await fetchSessions();
    return sessions.find(s => s.isCurrent);
  }
  return mapSession(data);
}

export const getCurrentSession = fetchCurrentSession;

export function useSessions() {
  return useQuery({
    queryKey: ['academic_sessions'],
    queryFn: fetchSessions,
  });
}

export function useCurrentSession() {
  return useQuery({
    queryKey: ['academic_sessions', 'current'],
    queryFn: fetchCurrentSession,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<AcademicSession, 'id' | 'createdAt' | 'updatedAt'>) => {
      const supabase = createClient();
      const { data: result, error } = await supabase
        .from(SUPABASE_TABLE)
        .insert({
          name: data.name,
          code: data.code,
          start_date: data.startDate,
          end_date: data.endDate,
          is_active: data.isActive,
          is_current: data.isCurrent,
        })
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw error;
      return mapSession(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_sessions'] });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AcademicSession> }) => {
      const supabase = createClient();
      const updateData: any = { updated_at: new Date().toISOString() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code;
      if (data.startDate !== undefined) updateData.start_date = data.startDate;
      if (data.endDate !== undefined) updateData.end_date = data.endDate;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      if (data.isCurrent !== undefined) updateData.is_current = data.isCurrent;

      const { data: result, error } = await supabase
        .from(SUPABASE_TABLE)
        .update(updateData)
        .eq('id', id)
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw error;
      return mapSession(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_sessions'] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_sessions'] });
    },
  });
}

export function useSetCurrentSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      await supabase
        .from(SUPABASE_TABLE)
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq('is_current', true);
      const { data: result, error } = await supabase
        .from(SUPABASE_TABLE)
        .update({ is_current: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(SESSION_COLUMNS)
        .single();
      if (error) throw error;
      return mapSession(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic_sessions'] });
    },
  });
}
