import { Result } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'results';

export function getResults(): Result[] {
  return getStore<Result>(KEY);
}

export function getResultsByInstitution(institutionId: string): Result[] {
  return getResults().filter(r => r.institutionId === institutionId);
}

export function getResultsByExam(examId: string): Result[] {
  return getResults().filter(r => r.examId === examId);
}

export function getResultById(id: string): Result | undefined {
  return getResults().find(r => r.id === id);
}

export function createResult(data: Omit<Result, 'id' | 'createdAt' | 'updatedAt'>): Result {
  const items = getResults();
  const item: Result = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateResult(id: string, data: Partial<Result>): Result | undefined {
  const items = getResults();
  const idx = items.findIndex(r => r.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function deleteResult(id: string): boolean {
  const items = getResults();
  const filtered = items.filter(r => r.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}
