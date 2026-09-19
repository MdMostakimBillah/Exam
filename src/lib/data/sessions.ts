import { AcademicSession } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

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

export async function fetchSessionsServer(): Promise<AcademicSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(SESSION_COLUMNS)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapSession);
}

export async function fetchCurrentSessionServer(): Promise<AcademicSession | undefined> {
  const sessions = await fetchSessionsServer();
  return sessions.find(s => s.isCurrent);
}
