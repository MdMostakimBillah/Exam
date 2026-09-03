import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateApplicationId(): string {
  const prefix = 'APP';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

export function generateCertificateNumber(): string {
  const prefix = 'SCX';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

export function generateTransactionId(): string {
  return 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

export function calculateGrade(percentage: number): string {
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'A-';
  if (percentage >= 50) return 'B';
  if (percentage >= 40) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

export function isPass(percentage: number): boolean {
  return percentage >= 33;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': case 'APPROVED': case 'PAID': case 'PUBLISHED': case 'VERIFIED': case 'GENERATED': case 'ELIGIBLE':
      return 'text-emerald-400 bg-emerald-400/10';
    case 'PENDING': case 'PAYMENT_PENDING': case 'DRAFT': case 'REVIEW': case 'GENERATED':
      return 'text-amber-400 bg-amber-400/10';
    case 'REJECTED': case 'SUSPENDED': case 'FAILED': case 'NOT_ELIGIBLE': case 'ERROR':
      return 'text-red-400 bg-red-400/10';
    case 'CLOSED': case 'ARCHIVED': case 'INACTIVE': case 'REFUNDED':
      return 'text-zinc-400 bg-zinc-400/10';
    default:
      return 'text-blue-400 bg-blue-400/10';
  }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
