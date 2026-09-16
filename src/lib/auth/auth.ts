import { User, UserRole } from '../types';
import { createClient } from '@/lib/supabase/client';
import { getUserByEmail } from '@/lib/storage/users';

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  return null;
}

export function setCurrentUser(user: User | null): void {
  // Supabase handles auth state via cookies
}

export async function login(email: string, password: string): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) return null;
  
  if (data.user) {
    const user = await getUserByEmail(email);
    return user;
  }
  
  return null;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return true;
}

export function hasRole(role: UserRole): boolean {
  if (typeof window === 'undefined') return false;
  return true;
}