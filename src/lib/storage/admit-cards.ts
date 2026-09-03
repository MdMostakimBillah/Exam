import { AdmitCard } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'admit_cards';

export function getAdmitCards(): AdmitCard[] {
  return getStore<AdmitCard>(KEY);
}

export function getAdmitCardById(id: string): AdmitCard | undefined {
  return getAdmitCards().find(a => a.id === id);
}

export function createAdmitCard(data: Omit<AdmitCard, 'id' | 'createdAt' | 'updatedAt'>): AdmitCard {
  const items = getAdmitCards();
  const item: AdmitCard = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}
