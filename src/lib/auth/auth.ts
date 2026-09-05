import { User, UserRole } from '../types';
import { getStoreItem, setStoreItem } from '../storage/storage';

const AUTH_KEY = 'auth_user';

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  return getStoreItem<User>(AUTH_KEY);
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    setStoreItem(AUTH_KEY, user);
  } else {
    localStorage.removeItem('scholarx_' + AUTH_KEY);
  }
}

export function login(email: string, password: string): User | null {
  const { getUserByEmail } = require('@/lib/storage/users') as typeof import('@/lib/storage/users');
  const user = getUserByEmail(email);
  if (user && user.password === password) {
    setCurrentUser(user);
    return user;
  }
  return null;
}

export function logout(): void {
  setCurrentUser(null);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasRole(role: UserRole): boolean {
  const user = getCurrentUser();
  return user?.role === role;
}

export function getActiveInstitutionId(): string | undefined {
  const user = getCurrentUser();
  return user?.institutionId;
}
