const PREFIX = 'scholarx_';

export function getStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(PREFIX + key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function setStore<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFIX + key, JSON.stringify(data));
}

export function getStoreItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(PREFIX + key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setStoreItem<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFIX + key, JSON.stringify(data));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function generateCode(prefix: string): string {
  return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return '৳' + amount.toLocaleString('en-BD');
}
