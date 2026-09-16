import { AcademicSession } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';

const KEY = 'academic_sessions';
const SUPABASE_TABLE = 'academic_sessions';

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

async function syncFromSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const sessions = data.map(mapSession);
      setStore(KEY, sessions);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getSessions(): AcademicSession[] {
  return getStore<AcademicSession>(KEY);
}

export function getSessionById(id: string): AcademicSession | undefined {
  return getSessions().find(s => s.id === id);
}

export function getCurrentSession(): AcademicSession | undefined {
  return getSessions().find(s => s.isCurrent);
}

export function getActiveSessions(): AcademicSession[] {
  return getSessions().filter(s => s.isActive);
}

export async function createSession(data: Omit<AcademicSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AcademicSession> {
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
    .select()
    .single();
  
  if (error) throw error;
  
  const session = mapSession(result);
  
  const items = getSessions();
  items.unshift(session);
  setStore(KEY, items);
  
  return session;
}

export async function updateSession(id: string, data: Partial<AcademicSession>): Promise<AcademicSession | undefined> {
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
    .select()
    .single();
  
  if (error) return undefined;
  
  const session = mapSession(result);
  
  const items = getSessions();
  const idx = items.findIndex(s => s.id === id);
  if (idx !== -1) {
    items[idx] = session;
    setStore(KEY, items);
  }
  
  return session;
}

export async function deleteSession(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  const items = getSessions();
  const filtered = items.filter(s => s.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}

export async function setCurrentSession(id: string): Promise<AcademicSession | undefined> {
  // First, unset all current sessions
  const supabase = createClient();
  await supabase
    .from(SUPABASE_TABLE)
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq('is_current', true);
  
  // Then set the new current session
  return updateSession(id, { isCurrent: true });
}