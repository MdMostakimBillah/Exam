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
  sessionId?: string,
  page?: number,
  pageSize?: number,
): Promise<Student[]> {
  const supabase = await createClient();

  if (page !== undefined && pageSize !== undefined) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_COLUMNS)
      .order('created_at', { ascending: false });
    if (sessionId) query = query.eq('session_id', sessionId);

    const { data, error } = await query.range(from, to);
    if (error || !data) return [];
    return data.map(mapStudent);
  }

  // Fetch all students (pages past Supabase's 1000-row cap)
  const PAGE = 1000;
  const all: any[] = [];
  for (let p = 0; p < 50; p++) {
    const from = p * PAGE;
    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_COLUMNS)
      .order('created_at', { ascending: false });
    if (sessionId) query = query.eq('session_id', sessionId);

    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapStudent);
}
