import { SystemSetting } from '../types';
import { createClient } from '@/lib/supabase/client';

const TABLE = 'system_settings';

const SETTING_COLUMNS = 'id,key,value,category';

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
    .select(SETTING_COLUMNS)
    .order('category', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapSetting);
}

export async function getSystemSetting(key: string): Promise<SystemSetting | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SETTING_COLUMNS)
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
    .select(SETTING_COLUMNS)
    .single();

  if (error) throw error;
  return mapSetting(data);
}

export async function getSettingsByCategory(category: string): Promise<SystemSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(SETTING_COLUMNS)
    .eq('category', category);

  if (error) throw error;
  return (data || []).map(mapSetting);
}
