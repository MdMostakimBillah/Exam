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

  if (error) {
    console.error('Login error:', error.message);
    return null;
  }

  if (data.user) {
    // Query by ID (matches RLS policy: id = auth.uid())
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError.message);
      return null;
    }

    // Normalize role: DB stores lowercase, app expects UPPERCASE
    const normalizedRole = profile.role.toUpperCase().replace('SUPER_ADMIN', 'SUPER_ADMIN').replace('INSTITUTION_ADMIN', 'INSTITUTION_ADMIN') as UserRole;

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      password: '',
      role: normalizedRole,
      institutionId: profile.institution_id,
      avatar: profile.avatar,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
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