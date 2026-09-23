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

/** The DB-level current session (is_current = true) — ignores any local view override. */
export async function fetchGlobalCurrentSession(): Promise<AcademicSession | undefined> {
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

// ---------------------------------------------------------------
// Per-user "view session" override (institution browsing past sessions)
//
// - Super-admin switching sessions sets the GLOBAL is_current flag.
// - Any other role switching only records a local override in
//   localStorage — it never touches the global flag, so it only
//   affects this browser.
// - The override stores the global session it was created under
//   (baseSessionId). When the super-admin later changes the global
//   current session, the base no longer matches and the override
//   auto-expires — everyone lands on the new session's data.
// ---------------------------------------------------------------

const viewSessionKey = (userId: string) => `bma_view_session_${userId}`;

export interface ViewSessionOverride {
  sessionId: string;
  baseSessionId: string;
}

export function getViewSessionOverride(userId: string): ViewSessionOverride | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(viewSessionKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.baseSessionId === 'string') {
      return parsed as ViewSessionOverride;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setViewSessionOverride(userId: string, sessionId: string): Promise<void> {
  const base = await fetchGlobalCurrentSession();
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    viewSessionKey(userId),
    JSON.stringify({ sessionId, baseSessionId: base?.id ?? '' })
  );
}

export function clearViewSessionOverride(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(viewSessionKey(userId));
}

/** Resolves the local view override, clearing it when it has expired. */
async function resolveViewSessionOverride(
  globalCurrent: AcademicSession
): Promise<AcademicSession | undefined> {
  if (typeof window === 'undefined') return undefined;
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return undefined;
    const stored = getViewSessionOverride(userId);
    if (!stored) return undefined;
    // Auto-expiry: the super-admin switched the global session since
    // this override was set — drop it and follow the new session.
    if (stored.baseSessionId !== globalCurrent.id) {
      clearViewSessionOverride(userId);
      return undefined;
    }
    if (stored.sessionId === globalCurrent.id) return undefined;
    const sessions = await fetchSessions();
    const found = sessions.find(s => s.id === stored.sessionId);
    if (!found) {
      clearViewSessionOverride(userId);
      return undefined;
    }
    return found;
  } catch {
    return undefined;
  }
}

/**
 * The session this user is currently viewing: the local view override
 * if valid, otherwise the global current session.
 */
export async function fetchCurrentSession(): Promise<AcademicSession | undefined> {
  const globalCurrent = await fetchGlobalCurrentSession();
  if (!globalCurrent) return undefined;
  const override = await resolveViewSessionOverride(globalCurrent);
  return override ?? globalCurrent;
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
    // Live: lets other users notice when the super-admin changes the
    // global session (override auto-expiry is resolved inside queryFn).
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
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
      // Historical records are FK-linked with ON DELETE CASCADE — deleting
      // a session that still holds data would wipe it permanently.
      // Refuse so previous sessions stay stored safely.
      const tables = ['students', 'registrations', 'payments', 'results', 'exams', 'marks'];
      const counts = await Promise.all(
        tables.map((table) =>
          supabase.from(table).select('id', { count: 'exact', head: true }).eq('session_id', id)
        )
      );
      const total = counts.reduce((sum, c) => sum + (c.count || 0), 0);
      if (total > 0) throw new Error(`SESSION_HAS_DATA:${total}`);
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
      // The global current session changed — refresh every cached dataset
      // so all pages show the new session's (initially empty) data at once.
      queryClient.invalidateQueries();
    },
  });
}
