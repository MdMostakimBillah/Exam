import { Profile, UserRole } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PROFILE_COLUMNS = 'id,email,name,role,username,institution_id,avatar,created_at,updated_at';

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

export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) return null;
  return data ? mapProfile(data) : null;
}

export async function fetchUsers(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function fetchUserByEmail(email: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('email', email)
    .single();
  if (error) return null;
  return data ? mapProfile(data) : null;
}

export async function fetchInstitutionAdmins(institutionId: string): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('institution_id', institutionId)
    .eq('role', 'INSTITUTION_ADMIN');
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function getUsers(): Promise<Profile[]> {
  return fetchUsers();
}

export async function createUser(data: { email: string; name: string; password: string; role: UserRole; institutionId?: string }): Promise<Profile> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { name: data.name, role: data.role } },
  });
  if (authError) throw authError;

  const { data: result, error } = await supabase
    .from('profiles')
    .insert({
      id: authData.user!.id,
      email: data.email,
      name: data.name,
      role: data.role,
      institution_id: data.institutionId,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return mapProfile(result);
}

export async function updateUser(id: string, data: Partial<Profile> & { password?: string }): Promise<Profile | undefined> {
  const supabase = createClient();

  if (data.password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password: data.password });
    if (pwError) throw pwError;
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;

  const { data: result, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) return undefined;
  return mapProfile(result);
}

export async function deleteUser(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  return !error;
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['profiles', userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: fetchUsers,
  });
}

export function useInstitutionAdmins(institutionId: string) {
  return useQuery({
    queryKey: ['profiles', 'institution', institutionId],
    queryFn: () => fetchInstitutionAdmins(institutionId),
    enabled: !!institutionId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<Profile> }) => {
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
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw error;
      return mapProfile(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
