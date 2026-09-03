import { Institution } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'institutions';

export function getInstitutions(): Institution[] {
  return getStore<Institution>(KEY);
}

export function getInstitutionById(id: string): Institution | undefined {
  return getInstitutions().find(i => i.id === id);
}

export function getInstitutionBySlug(slug: string): Institution | undefined {
  return getInstitutions().find(i => i.slug === slug);
}

export function createInstitution(data: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>): Institution {
  const items = getInstitutions();
  const item: Institution = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateInstitution(id: string, data: Partial<Institution>): Institution | undefined {
  const items = getInstitutions();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function deleteInstitution(id: string): boolean {
  const items = getInstitutions();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}
