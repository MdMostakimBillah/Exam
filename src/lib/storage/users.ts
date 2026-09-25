import { Profile, UserRole } from '../types';
import { createClient } from '@/lib/supabase/client';
import { createUserServer, deleteUserServer, updateUserServer } from '@/lib/auth/user-actions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const PROFILE_COLUMNS = 'id,email,name,role,username,institution_id,avatar,created_at,updated_at';

function mapProfile(data: any): Profile {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    // The database stores roles lowercase; the UI compares against
    // UserRole's uppercase literals. Normalise here so role checks
    // (and the "keep one super admin" guard) actually work.
    role: String(data.role || "").toUpperCase() as Profile["role"],
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
    .order('created_at', { ascending: false })
    // Bounded: this feeds a select, not a table dump (audit P3).
    .limit(1000);
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
  // Routed through the guarded server action: the raw client-side path both
  // trusted a browser-supplied role and collided with the handle_new_user
  // trigger's profile insert (duplicate key on every call).
  const res = await createUserServer({
    email: data.email,
    password: data.password,
    name: data.name,
    role: data.role,
    institutionId: data.institutionId,
  });
  if (!res.success || !res.userId) throw new Error(res.error || "Could not create user");

  const created = await fetchUserProfile(res.userId);
  if (!created) throw new Error("User created but the profile could not be read back");
  return created;
}

export async function updateUser(id: string, data: Partial<Profile> & { password?: string }): Promise<Profile | undefined> {
  const supabase = createClient();

  // Password changes go through the guarded service-role action —
  // supabase.auth.admin.* is not callable from the browser.
  if (data.password) {
    const res = await updateUserServer({ userId: id, password: data.password });
    if (!res.success) throw new Error(res.error || "Could not change password");
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  // DB stores roles lowercase (profiles_role_check); the UI uses uppercase.
  if (data.role !== undefined) updateData.role = String(data.role).toLowerCase();
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
  const res = await deleteUserServer(id);
  return res.success;
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
      // Same rules as updateUser(): privileged columns and passwords only
      // ever travel through the super-admin-guarded server action.
      const res = await updateUserServer({
        userId,
        name: data.name,
        email: data.email,
        role: data.role,
        institutionId: data.institutionId,
      });
      if (!res.success) throw new Error(res.error || "Could not update profile");
      const updated = await fetchUserProfile(userId);
      if (!updated) throw new Error("Profile could not be read back");
      return updated;
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
      const res = await deleteUserServer(userId);
      if (!res.success) throw new Error(res.error || "Could not delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
