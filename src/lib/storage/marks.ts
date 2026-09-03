import { Mark } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'marks';

export function getMarks(): Mark[] {
  return getStore<Mark>(KEY);
}

export function getMarksByExam(examId: string): Mark[] {
  return getMarks().filter(m => m.examId === examId);
}

export function createMark(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>): Mark {
  const items = getMarks();
  const item: Mark = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateMark(id: string, data: Partial<Mark>): Mark | undefined {
  const items = getMarks();
  const idx = items.findIndex(m => m.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function bulkCreateMarks(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>[]): Mark[] {
  const items = getMarks();
  const newItems: Mark[] = data.map(d => ({
    ...d,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  items.push(...newItems);
  setStore(KEY, items);
  return newItems;
}
