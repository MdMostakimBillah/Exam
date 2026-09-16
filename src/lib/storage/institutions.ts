import { Institution } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';

const KEY = 'institutions';
const SUPABASE_TABLE = 'institutions';

function mapInstitution(data: any): Institution {
  return {
    id: data.id,
    name: data.name,
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

async function syncFromSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const institutions = data.map(mapInstitution);
      setStore(KEY, institutions);
    }
  } catch {
    // Ignore sync errors, use local data
  }
}

// Initialize sync on module load (client-side only)
if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getInstitutions(): Institution[] {
  return getStore<Institution>(KEY);
}

export function getInstitutionById(id: string): Institution | undefined {
  return getInstitutions().find(i => i.id === id);
}

export function getInstitutionBySlug(slug: string): Institution | undefined {
  return getInstitutions().find(i => i.slug === slug);
}

export async function createInstitution(data: Omit<Institution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Institution> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      name: data.name,
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
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const institution = mapInstitution(result);
  
  // Update localStorage cache
  const items = getInstitutions();
  items.unshift(institution);
  setStore(KEY, items);
  
  return institution;
}

export async function updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.district !== undefined) updateData.district = data.district;
  if (data.contactPerson !== undefined) updateData.contact_person = data.contactPerson;
  if (data.contactPersonPhone !== undefined) updateData.contact_person_phone = data.contactPersonPhone;
  if (data.adminUserId !== undefined) updateData.admin_user_id = data.adminUserId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.logo !== undefined) updateData.logo_url = data.logo;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const institution = mapInstitution(result);
  
  // Update localStorage cache
  const items = getInstitutions();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = institution;
    setStore(KEY, items);
  }
  
  return institution;
}

export async function deleteInstitution(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  // Update localStorage cache
  const items = getInstitutions();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}