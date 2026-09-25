import { Institution } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_TABLE = 'institutions';

const INSTITUTION_COLUMNS = 'id,name,name_en,code,slug,email,phone,address,city,district,contact_person,contact_person_phone,admin_user_id,status,logo_url,total_students,total_applications,created_at,updated_at';

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

export async function fetchInstitutionsServer(): Promise<Institution[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(INSTITUTION_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    console.error("[fetchInstitutionsServer] Supabase error:", error.message, error.code, error.details);
    throw error;
  }
  if (!data) return [];
  return data.map(mapInstitution);
}
