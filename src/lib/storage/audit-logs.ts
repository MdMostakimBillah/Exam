import { AuditLog } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'audit_logs';

export function getAuditLogs(): AuditLog[] {
  return getStore<AuditLog>(KEY);
}

export function createAuditLog(data: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
  const items = getAuditLogs();
  const item: AuditLog = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}
