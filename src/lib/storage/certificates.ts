import { Certificate } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'certificates';

export function getCertificates(): Certificate[] {
  return getStore<Certificate>(KEY);
}

export function getCertificatesByInstitution(institutionId: string): Certificate[] {
  return getCertificates().filter(c => c.institutionId === institutionId);
}

export function getCertificateById(id: string): Certificate | undefined {
  return getCertificates().find(c => c.id === id);
}

export function getCertificateByNumber(number: string): Certificate | undefined {
  return getCertificates().find(c => c.certificateNumber === number);
}

export function createCertificate(data: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Certificate {
  const items = getCertificates();
  const item: Certificate = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}

export function updateCertificate(id: string, data: Partial<Certificate>): Certificate | undefined {
  const items = getCertificates();
  const idx = items.findIndex(c => c.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  setStore(KEY, items);
  return items[idx];
}
