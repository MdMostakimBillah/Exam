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
  const { fetchRegistrationsByInstitution } = await import('./registrations');
  const registrations = await fetchRegistrationsByInstitution(institutionId);
  const sessionRegistrations = registrations.filter(r => r.applicationId.startsWith(`APP-${sessionCode}-`));
  const count = sessionRegistrations.length + 1;
  return `APP-${sessionCode}-${String(count).padStart(4, '0')}`;
}

export async function generateStudentId(institutionId: string, sessionCode: string): Promise<string> {
  const { fetchStudentsByInstitution } = await import('./students');
  const students = await fetchStudentsByInstitution(institutionId);
  const sessionStudents = students.filter(s => s.studentId.startsWith(`STU-${sessionCode}-`));
  const count = sessionStudents.length + 1;
  return `STU-${sessionCode}-${String(count).padStart(4, '0')}`;
}

export async function generateCertificateNumber(sessionCode: string): Promise<string> {
  const { fetchCertificates } = await import('./certificates');
  const certificates = await fetchCertificates();
  const sessionCerts = certificates.filter(c => c.certificateNumber.startsWith(`CERT-${sessionCode}-`));
  const count = sessionCerts.length + 1;
  return `CERT-${sessionCode}-${String(count).padStart(6, '0')}`;
}

export async function generateTransactionId(): Promise<string> {
  return 'TXN-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
}
