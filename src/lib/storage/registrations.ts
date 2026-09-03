import { Registration } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'registrations';

export function getRegistrations(): Registration[] {
  return getStore<Registration>(KEY);
}

export function getRegistrationsByInstitution(institutionId: string): Registration[] {
  return getRegistrations().filter(r => r.institutionId === institutionId);
}

export function getRegistrationsByExam(examId: string): Registration[] {
  return getRegistrations().filter(r => r.examId === examId);
}

export function getRegistrationById(id: string): Registration | undefined {
  return getRegistrations().find(r => r.id === id);
}

export function createRegistration(data: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>): Registration {
  const items = getRegistrations();
  const item: Registration = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateRegistration(id: string, data: Partial<Registration>): Registration | undefined {
  const items = getRegistrations();
  const idx = items.findIndex(r => r.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}
