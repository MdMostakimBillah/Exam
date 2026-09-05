import { Class } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'classes';

export function getClasses(): Class[] {
  return getStore<Class>(KEY);
}

export function getClassById(id: string): Class | undefined {
  return getClasses().find(c => c.id === id);
}

export function createClass(data: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Class {
  const items = getClasses();
  const item: Class = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateClass(id: string, data: Partial<Class>): Class | undefined {
  const items = getClasses();
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function deleteClass(id: string): boolean {
  const items = getClasses();
  const filtered = items.filter(c => c.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}

export function getActiveClasses(): Class[] {
  return getClasses().filter(c => c.isActive);
}
