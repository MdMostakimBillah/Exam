import { User, UserRole } from '../types';
import { createClient } from '@/lib/supabase/client';

const USER_STORAGE_KEY = 'scholarx_current_user';

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError.message);
      return null;
    }

    const normalizedRole = profile.role.toUpperCase() as UserRole;

    const user: User = {
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

    setCurrentUser(user);
    return user;
  }

  return null;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  setCurrentUser(null);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function hasRole(role: UserRole): boolean {
  const user = getCurrentUser();
  return user?.role === role;
}