import { Student } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'students';

export function getStudents(): Student[] {
  return getStore<Student>(KEY);
}

export function getStudentsByInstitution(institutionId: string): Student[] {
  return getStudents().filter(s => s.institutionId === institutionId);
}

export function getStudentById(id: string): Student | undefined {
  return getStudents().find(s => s.id === id);
}

export function createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Student {
  const items = getStudents();
  const item: Student = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateStudent(id: string, data: Partial<Student>): Student | undefined {
  const items = getStudents();
  const idx = items.findIndex(s => s.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}

export function deleteStudent(id: string): boolean {
  const items = getStudents();
  const filtered = items.filter(s => s.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}
