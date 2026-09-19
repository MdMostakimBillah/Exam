import { createClient } from '@/lib/supabase/client';

export function getStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStore<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
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

export async function generateApplicationId(institutionId: string, sessionCode: string): Promise<string> {
  const supabase = createClient();
  const { count } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', institutionId)
    .like('application_id', `APP-${sessionCode}-%`);
  const nextNum = (count || 0) + 1;
  return `APP-${sessionCode}-${String(nextNum).padStart(4, '0')}`;
}

export async function generateStudentId(institutionId: string, sessionCode: string): Promise<string> {
  const supabase = createClient();
  const { count } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', institutionId)
    .like('student_id', `STU-${sessionCode}-%`);
  const nextNum = (count || 0) + 1;
  return `STU-${sessionCode}-${String(nextNum).padStart(4, '0')}`;
}

export async function generateCertificateNumber(sessionCode: string): Promise<string> {
  const supabase = createClient();
  const { count } = await supabase
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .like('certificate_number', `CERT-${sessionCode}-%`);
  const nextNum = (count || 0) + 1;
  return `CERT-${sessionCode}-${String(nextNum).padStart(6, '0')}`;
}

export async function generateTransactionId(): Promise<string> {
  return 'TXN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
}
