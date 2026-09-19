import { Student } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_TABLE = 'students';

const STUDENT_COLUMNS = 'id,institution_id,session_id,first_name,last_name,student_id,class,section,roll,date_of_birth,gender,father_name,mother_name,phone,address,photo_url,status,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapStudent(data: any): Student {
  return {
    id: data.id,
    institutionId: data.institution_id,
    sessionId: data.session_id,
    firstName: data.first_name,
    lastName: data.last_name,
    studentId: data.student_id,
    class: data.class,
    section: data.section,
    roll: data.roll,
    dateOfBirth: data.date_of_birth,
    gender: data.gender,
    fatherName: data.father_name,
    motherName: data.mother_name,
    phone: data.phone,
    address: data.address,
    photo: data.photo_url,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchStudentsServer(
  sessionId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Student[]> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(STUDENT_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapStudent);
}
