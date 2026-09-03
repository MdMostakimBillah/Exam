import { ExamCenter } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'exam_centers';

export function getExamCenters(): ExamCenter[] {
  return getStore<ExamCenter>(KEY);
}

export function getExamCenterById(id: string): ExamCenter | undefined {
  return getExamCenters().find(c => c.id === id);
}

export function createExamCenter(data: Omit<ExamCenter, 'id' | 'createdAt' | 'updatedAt'>): ExamCenter {
  const items = getExamCenters();
  const item: ExamCenter = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateExamCenter(id: string, data: Partial<ExamCenter>): ExamCenter | undefined {
  const items = getExamCenters();
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}
