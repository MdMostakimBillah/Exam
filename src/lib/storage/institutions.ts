import { Institution } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteInstitutionServer, type DeleteInstitutionResult } from '@/lib/auth/institution-actions';

const SUPABASE_TABLE = 'institutions';

const INSTITUTION_COLUMNS = 'id,name,name_en,code,slug,email,phone,address,city,district,contact_person,contact_person_phone,admin_user_id,status,logo_url,total_students,total_applications,created_at,updated_at';

const INSTITUTIONS_STALE_TIME = 5 * 60 * 1000;

function mapInstitution(data: any): Institution {
  return {
    id: data.id,
    name: data.name,
    nameEn: data.name_en ?? '',
    code: data.code,
    slug: data.slug,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    district: data.district,
    contactPerson: data.contact_person,
    contactPersonPhone: data.contact_person_phone,
    adminUserId: data.admin_user_id,
    status: data.status,
    logo: data.logo_url,
    totalStudents: data.total_students,
    totalApplications: data.total_applications,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(INSTITUTION_COLUMNS).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapInstitution);
}

export async function fetchInstitutionById(id: string): Promise<Institution | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(INSTITUTION_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapInstitution(data);
}

export async function fetchInstitutionBySlug(slug: string): Promise<Institution | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(INSTITUTION_COLUMNS).eq('slug', slug).single();
  if (error || !data) return undefined;
  return mapInstitution(data);
}

export async function createInstitution(data: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Institution> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({
    name: data.name,
    name_en: data.nameEn ?? null,
    code: data.code,
    slug: data.slug,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    district: data.district,
    contact_person: data.contactPerson,
    contact_person_phone: data.contactPersonPhone,
    admin_user_id: data.adminUserId,
    status: data.status,
    logo_url: data.logo,
  }).select(INSTITUTION_COLUMNS).single();
  if (error) throw error;
  return mapInstitution(result);
}

export async function updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.nameEn !== undefined) u.name_en = data.nameEn;
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
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select(INSTITUTION_COLUMNS).single();
  if (error) return undefined;
  return mapInstitution(result);
}

/**
 * Permanently deletes an institution and EVERYTHING that belongs to it —
 * all DB rows (students, registrations, payments, results, certificates,
 * marks, admit cards, exam centers, user notifications, profiles), the
 * stored images, and the login accounts. Delegates to the server action
 * (service role + cascade RPC); throws on failure so the UI can surface it.
 */
export async function deleteInstitution(id: string): Promise<DeleteInstitutionResult> {
  const result = await deleteInstitutionServer(id);
  if (!result.success) throw new Error(result.error || 'Could not delete institution');
  return result;
}

export function useInstitutions() { return useQuery({ queryKey: ['institutions'], queryFn: fetchInstitutions, staleTime: INSTITUTIONS_STALE_TIME }); }
export function useInstitutionById(id: string) { return useQuery({ queryKey: ['institutions', id], queryFn: () => fetchInstitutionById(id), enabled: !!id, staleTime: INSTITUTIONS_STALE_TIME }); }
export function useInstitutionBySlug(slug: string) { return useQuery({ queryKey: ['institutions', 'slug', slug], queryFn: () => fetchInstitutionBySlug(slug), enabled: !!slug, staleTime: INSTITUTIONS_STALE_TIME }); }

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
    onSuccess: () => {
      // The wipe spans every dataset (students, registrations, payments,
      // results, certificates, marks, admit cards, profiles, dashboard
      // stats) — refresh everything so no stale count survives.
      qc.invalidateQueries();
    },
  });
}
