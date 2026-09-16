const PREFIX = 'scholarx_';

const cache = new Map<string, unknown>();

function cacheKey(key: string): string {
  return PREFIX + key;
}

function invalidate(key: string): void {
  cache.delete(cacheKey(key));
}

export function getStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const ck = cacheKey(key);
  if (cache.has(ck)) return cache.get(ck) as T[];
  try {
    const data = localStorage.getItem(ck);
    const parsed: T[] = data ? JSON.parse(data) : [];
    cache.set(ck, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export function setStore<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  const ck = cacheKey(key);
  cache.set(ck, data);
  localStorage.setItem(ck, JSON.stringify(data));
}

export function getStoreItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const ck = cacheKey(key);
  if (cache.has(ck)) return cache.get(ck) as T;
  try {
    const data = localStorage.getItem(ck);
    const parsed: T | null = data ? JSON.parse(data) : null;
    cache.set(ck, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setStoreItem<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  const ck = cacheKey(key);
  cache.set(ck, data);
  localStorage.setItem(ck, JSON.stringify(data));
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
