import { Notification } from '../types';
import { createClient } from '@/lib/supabase/client';

const TABLE = 'notifications';

function mapNotification(data: any): Notification {
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type,
    read: data.read,
    createdAt: data.created_at,
  };
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(mapNotification);
}

export async function createNotification(data: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      read: data.read,
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapNotification(result);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .eq('id', id);
  
  return !error;
}

export async function markAsRead(id: string): Promise<boolean> {
  return markNotificationRead(id);
}

export async function markAllAsRead(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .eq('user_id', userId);
  
  return !error;
}