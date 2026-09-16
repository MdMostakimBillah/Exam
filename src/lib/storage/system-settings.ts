import { SystemSetting } from '../types';
import { createClient } from '@/lib/supabase/client';

const TABLE = 'system_settings';

function mapSetting(data: any): SystemSetting {
  return {
    id: data.id,
    key: data.key,
    value: data.value,
    category: data.category,
  };
}

export async function getSystemSettings(): Promise<SystemSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('category', { ascending: true });
  
  if (error) throw error;
  return (data || []).map(mapSetting);
}

export async function getSystemSetting(key: string): Promise<SystemSetting | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('key', key)
    .single();
  
  if (error) return undefined;
  return data ? mapSetting(data) : undefined;
}

export async function setSystemSetting(key: string, value: string, category: string): Promise<SystemSetting> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      key,
      value,
      category,
    }, { onConflict: 'key' })
    .select()
    .single();
  
  if (error) throw error;
  return mapSetting(data);
}

export async function getSettingsByCategory(category: string): Promise<SystemSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('category', category);
  
  if (error) throw error;
  return (data || []).map(mapSetting);
}