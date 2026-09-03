import { Exam } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'exams';

export function getExams(): Exam[] {
  return getStore<Exam>(KEY);
}

export function getExamById(id: string): Exam | undefined {
  return getExams().find(e => e.id === id);
}

export function createExam(data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Exam {
  const items = getExams();
  const item: Exam = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateExam(id: string, data: Partial<Exam>): Exam | undefined {
  const items = getExams();
  const idx = items.findIndex(e => e.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function deleteExam(id: string): boolean {
  const items = getExams();
  const filtered = items.filter(e => e.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}
