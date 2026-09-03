import { Notification } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'notifications';

export function getNotifications(): Notification[] {
  return getStore<Notification>(KEY);
}

export function getNotificationsByUser(userId: string): Notification[] {
  return getNotifications().filter(n => n.userId === userId);
}

export function getUnreadCount(userId: string): number {
  return getNotifications().filter(n => n.userId === userId && !n.read).length;
}

export function createNotification(data: Omit<Notification, 'id' | 'createdAt'>): Notification {
  const items = getNotifications();
  const item: Notification = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function markAsRead(id: string): void {
  const items = getNotifications();
  const idx = items.findIndex(n => n.id === id);
  if (idx !== -1) {
    items[idx].read = true;
    setStore(KEY, items);
  }
}

export function markAllAsRead(userId: string): void {
  const items = getNotifications().map(n => n.userId === userId ? { ...n, read: true } : n);
  setStore(KEY, items);
}
