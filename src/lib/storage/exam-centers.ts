import { ExamCenter } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'exam_centers';
const SUPABASE_TABLE = 'exam_centers';

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

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const supabase = createClient();
    const sid = sessionId || (await getCurrentSession())?.id;
    if (!sid) return;
    
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const centers = data.map(mapExamCenter);
      const existing = getStore<ExamCenter>(KEY);
      const otherSessions = existing.filter(c => c.sessionId !== sid);
      setStore(KEY, [...centers, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getExamCenters(): ExamCenter[] {
  return getStore<ExamCenter>(KEY);
}

export function getExamCenterById(id: string): ExamCenter | undefined {
  return getExamCenters().find(c => c.id === id);
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
    .select()
    .single();
  
  if (error) throw error;
  
  const center = mapExamCenter(result);
  
  const items = getExamCenters();
  items.unshift(center);
  setStore(KEY, items);
  
  return center;
}

export async function updateExamCenter(id: string, data: Partial<ExamCenter>): Promise<ExamCenter | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.allocated !== undefined) updateData.allocated = data.allocated;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const center = mapExamCenter(result);
  
  const items = getExamCenters();
  const idx = items.findIndex(c => c.id === id);
  if (idx !== -1) {
    items[idx] = center;
    setStore(KEY, items);
  }
  
  return center;
}

export async function deleteExamCenter(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  const items = getExamCenters();
  const filtered = items.filter(c => c.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}