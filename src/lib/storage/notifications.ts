import { Notification } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const TABLE = 'notifications';

const NOTIFICATION_COLUMNS = 'id,user_id,title,message,type,read,created_at';

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
  return fetchNotifications(userId);
}

export async function fetchNotifications(userId: string, page: number = 1, pageSize: number = 50): Promise<Notification[]> {
  const supabase = createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(TABLE)
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return (data || []).map(mapNotification);
}

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => fetchNotifications(userId),
    enabled: !!userId,
    staleTime: 0,
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Notification, 'id' | 'createdAt'>) => {
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
        .select(NOTIFICATION_COLUMNS)
        .single();
      if (error) throw error;
      return mapNotification(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from(TABLE)
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from(TABLE)
        .update({ read: true })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
