import { Class } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';

const KEY = 'classes';
const SUPABASE_TABLE = 'classes';

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

async function syncFromSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .order('name', { ascending: true });
    
    if (!error && data) {
      const classes = data.map(mapClass);
      setStore(KEY, classes);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getClasses(): Class[] {
  return getStore<Class>(KEY);
}

export function getClassById(id: string): Class | undefined {
  return getClasses().find(c => c.id === id);
}

export async function createClass(data: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<Class> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      name: data.name,
      code: data.code,
      description: data.description,
      is_active: data.isActive,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const cls = mapClass(result);
  
  const items = getClasses();
  items.push(cls);
  setStore(KEY, items);
  
  return cls;
}

export async function updateClass(id: string, data: Partial<Class>): Promise<Class | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const cls = mapClass(result);
  
  const items = getClasses();
  const idx = items.findIndex(c => c.id === id);
  if (idx !== -1) {
    items[idx] = cls;
    setStore(KEY, items);
  }
  
  return cls;
}

export async function deleteClass(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  const items = getClasses();
  const filtered = items.filter(c => c.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}

export function getActiveClasses(): Class[] {
  return getClasses().filter(c => c.isActive);
}