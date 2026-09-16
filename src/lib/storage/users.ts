import { User, UserRole } from '../types';
import { createClient } from '@/lib/supabase/client';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  institutionId?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

function mapProfile(data: any): Profile {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    institutionId: data.institution_id,
    avatar: data.avatar,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Legacy-compatible User type (for backward compatibility)
function mapUser(data: any): User {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    password: '', // Not stored in profiles
    role: data.role,
    institutionId: data.institution_id,
    avatar: data.avatar,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data ? mapProfile(data) : null;
}

export async function createUserProfile(data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<Profile> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const { data: result, error } = await supabase
    .from('profiles')
    .insert({
      id,
      email: data.email,
      name: data.name,
      role: data.role,
      institution_id: data.institutionId,
      avatar: data.avatar,
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapProfile(result);
}

export async function updateUserProfile(userId: string, data: Partial<Profile>): Promise<Profile | null> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  
  const { data: result, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) return null;
  return result ? mapProfile(result) : null;
}

// Legacy-compatible functions (for backward compatibility with existing pages)
export async function createUser(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const supabase = createClient();
  
  // First create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: {
      name: data.name,
      role: data.role,
      institution_id: data.institutionId,
    },
  });
  
  if (authError) throw authError;
  
  // Then create profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: data.email,
      name: data.name,
      role: data.role,
      institution_id: data.institutionId,
      avatar: data.avatar,
    })
    .select()
    .single();
  
  if (profileError) throw profileError;
  return mapUser(profileData);
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | null> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.email !== undefined) updateData.email = data.email;
  
  const { data: result, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return null;
  return result ? mapUser(result) : null;
}

export async function getInstitutionAdmins(institutionId: string): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('role', 'INSTITUTION_ADMIN');
  
  if (error) throw error;
  return (data || []).map(mapProfile);
}

// Legacy-compatible functions for user management
export async function getUsers(): Promise<User[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(mapUser);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) return null;
  return data ? mapUser(data) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const supabase = createClient();
  
  // Delete profile first
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);
  
  if (profileError) return false;
  
  // Note: Auth user deletion requires admin privileges
  // This would need to be done via admin API or service role
  return true;
}

export async function signUp(email: string, password: string, name: string, role: UserRole, institutionId?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        institution_id: institutionId,
      },
    },
  });
  
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}