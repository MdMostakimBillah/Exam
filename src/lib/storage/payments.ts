import { Payment } from '../types';
import { getStore, setStore } from './storage';

const KEY = 'payments';

export function getPayments(): Payment[] {
  return getStore<Payment>(KEY);
}

export function getPaymentsByInstitution(institutionId: string): Payment[] {
  return getPayments().filter(p => p.institutionId === institutionId);
}

export function getPaymentById(id: string): Payment | undefined {
  return getPayments().find(p => p.id === id);
}

export function createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Payment {
  const items = getPayments();
  const item: Payment = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  items.push(item);
  setStore(KEY, items);
  return item;
}
