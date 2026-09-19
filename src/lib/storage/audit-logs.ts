import { AuditLog } from '../types';
import { createClient } from '@/lib/supabase/client';

const TABLE = 'audit_logs';

const AUDIT_LOG_COLUMNS = 'id,user_id,user_name,action,entity,entity_id,details,created_at';

function mapAuditLog(data: any): AuditLog {
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    action: data.action,
    entity: data.entity,
    entityId: data.entity_id,
    details: data.details,
    createdAt: data.created_at,
  };
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(AUDIT_LOG_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapAuditLog);
}

export async function createAuditLog(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: data.userId,
      user_name: data.userName,
      action: data.action,
      entity: data.entity,
      entity_id: data.entityId,
      details: data.details,
    })
    .select(AUDIT_LOG_COLUMNS)
    .single();

  if (error) throw error;
  return mapAuditLog(result);
}
