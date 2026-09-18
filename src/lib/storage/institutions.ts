import { Institution } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const KEY = 'institutions';
const SUPABASE_TABLE = 'institutions';

function mapInstitution(data: any): Institution {
  return { id: data.id, name: data.name, code: data.code, slug: data.slug, email: data.email, phone: data.phone, address: data.address, city: data.city, district: data.district, contactPerson: data.contact_person, contactPersonPhone: data.contact_person_phone, adminUserId: data.admin_user_id, status: data.status, logo: data.logo_url, totalStudents: data.total_students, totalApplications: data.total_applications, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapInstitution);
      setStore(KEY, items);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getInstitutions(): Institution[] {
  return getStore<Institution>(KEY);
}

export function getInstitutionById(id: string): Institution | undefined {
  return getInstitutions().find(i => i.id === id);
}

export function getInstitutionBySlug(slug: string): Institution | undefined {
  return getInstitutions().find(i => i.slug === slug);
}

// Async getters
export async function fetchInstitutions(): Promise<Institution[]> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapInstitution);
}

export async function fetchInstitutionById(id: string): Promise<Institution | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapInstitution(data);
}

export async function fetchInstitutionBySlug(slug: string): Promise<Institution | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('slug', slug).single();
  if (error || !data) return undefined;
  return mapInstitution(data);
}

// Async standalone CRUD
export async function createInstitution(data: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Institution> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ name: data.name, code: data.code, slug: data.slug, email: data.email, phone: data.phone, address: data.address, city: data.city, district: data.district, contact_person: data.contactPerson, contact_person_phone: data.contactPersonPhone, admin_user_id: data.adminUserId, status: data.status, logo_url: data.logo }).select().single();
  if (error) throw error;
  const inst = mapInstitution(result);
  const items = getInstitutions();
  items.unshift(inst);
  setStore(KEY, items);
  return inst;
}

export async function updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.code !== undefined) u.code = data.code;
  if (data.slug !== undefined) u.slug = data.slug;
  if (data.email !== undefined) u.email = data.email;
  if (data.phone !== undefined) u.phone = data.phone;
  if (data.address !== undefined) u.address = data.address;
  if (data.city !== undefined) u.city = data.city;
  if (data.district !== undefined) u.district = data.district;
  if (data.contactPerson !== undefined) u.contact_person = data.contactPerson;
  if (data.contactPersonPhone !== undefined) u.contact_person_phone = data.contactPersonPhone;
  if (data.adminUserId !== undefined) u.admin_user_id = data.adminUserId;
  if (data.status !== undefined) u.status = data.status;
  if (data.logo !== undefined) u.logo_url = data.logo;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const inst = mapInstitution(result);
  const items = getInstitutions();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) items[idx] = inst;
  setStore(KEY, items);
  return inst;
}

export async function deleteInstitution(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getInstitutions().filter(i => i.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useInstitutions() { return useQuery({ queryKey: ['institutions'], queryFn: fetchInstitutions }); }
export function useInstitutionById(id: string) { return useQuery({ queryKey: ['institutions', id], queryFn: () => fetchInstitutionById(id), enabled: !!id }); }
export function useInstitutionBySlug(slug: string) { return useQuery({ queryKey: ['institutions', 'slug', slug], queryFn: () => fetchInstitutionBySlug(slug), enabled: !!slug }); }

export function useCreateInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>) => createInstitution(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }),
  });
}

export function useUpdateInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Institution> }) => updateInstitution(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }),
  });
}

export function useDeleteInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInstitution(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['institutions'] }),
  });
}
