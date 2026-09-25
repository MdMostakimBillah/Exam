import { Student } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'students';

const STUDENT_COLUMNS = 'id,institution_id,session_id,first_name,last_name,first_name_bn,last_name_bn,student_id,class,section,roll,date_of_birth,gender,father_name,mother_name,phone,address,photo_url,status,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapStudent(data: any): Student {
  return {
    id: data.id,
    institutionId: data.institution_id,
    sessionId: data.session_id,
    firstName: data.first_name,
    lastName: data.last_name,
    firstNameBn: data.first_name_bn,
    lastNameBn: data.last_name_bn,
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
    examRoll: data.exam_roll,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchStudents(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Student[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(STUDENT_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapStudent);
}

/**
 * Fetches only student_id values for an institution+session (lightweight, no pagination).
 * Used by generateStudentId to find the next available number.
 */
export async function fetchStudentIdsByInstitution(institutionId: string, sessionId?: string): Promise<string[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('student_id')
    .eq('session_id', sid)
    .eq('institution_id', institutionId);
  if (error || !data) return [];
  return data.map((row: { student_id: string }) => row.student_id);
}

export async function fetchStudentsByInstitution(institutionId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Student[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(STUDENT_COLUMNS)
    .eq('session_id', sid)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapStudent);
}

export async function fetchStudentById(id: string): Promise<Student | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(STUDENT_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapStudent(data);
}

export async function fetchStudentByStudentId(studentId: string, sessionId?: string): Promise<Student | undefined> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return undefined;
  const { data, error } = await supabase.from(SUPABASE_TABLE).select(STUDENT_COLUMNS).eq('student_id', studentId).eq('session_id', sid).single();
  if (error || !data) return undefined;
  return mapStudent(data);
}

export async function createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      institution_id: data.institutionId,
      session_id: data.sessionId,
      first_name: data.firstName,
      last_name: data.lastName,
      first_name_bn: data.firstNameBn,
      last_name_bn: data.lastNameBn,
      student_id: data.studentId,
      class: data.class,
      section: data.section,
      roll: data.roll,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      father_name: data.fatherName,
      mother_name: data.motherName,
      phone: data.phone,
      address: data.address,
      photo_url: data.photo,
      status: data.status,
    })
    .select(STUDENT_COLUMNS)
    .single();
  if (error) throw error;
  return mapStudent(result);
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.firstName !== undefined) u.first_name = data.firstName;
  if (data.lastName !== undefined) u.last_name = data.lastName;
  if (data.firstNameBn !== undefined) u.first_name_bn = data.firstNameBn;
  if (data.lastNameBn !== undefined) u.last_name_bn = data.lastNameBn;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.class !== undefined) u.class = data.class;
  if (data.section !== undefined) u.section = data.section;
  if (data.roll !== undefined) u.roll = data.roll;
  if (data.dateOfBirth !== undefined) u.date_of_birth = data.dateOfBirth;
  if (data.gender !== undefined) u.gender = data.gender;
  if (data.fatherName !== undefined) u.father_name = data.fatherName;
  if (data.motherName !== undefined) u.mother_name = data.motherName;
  if (data.phone !== undefined) u.phone = data.phone;
  if (data.address !== undefined) u.address = data.address;
  if (data.photo !== undefined) u.photo_url = data.photo;
  if (data.status !== undefined) u.status = data.status;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(STUDENT_COLUMNS).single();
  if (error) return undefined;
  return mapStudent(result);
}

export async function deleteStudent(id: string): Promise<boolean> {
  const supabase = createClient();
  
  // First, get the student to find the photo URL for cleanup
  const { data: student } = await supabase.from(SUPABASE_TABLE).select('photo_url').eq('id', id).single();
  
  // Delete all related data (RLS may block some, but ON DELETE CASCADE handles the rest at DB level)
  // Delete registrations first (they reference student_id)
  await supabase.from('registrations').delete().eq('student_id', id);
  // Delete marks
  await supabase.from('marks').delete().eq('student_id', id);
  // Delete results  
  await supabase.from('results').delete().eq('student_id', id);
  // Delete certificates
  await supabase.from('certificates').delete().eq('student_id', id);
  // Delete admit cards
  await supabase.from('admit_cards').delete().eq('student_id', id);
  // Delete payments referencing this student
  await supabase.from('payments').delete().eq('student_id', id);
  
  // Delete the student record
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  
  // Try to delete the student photo from storage if it exists
  if (student?.photo_url) {
    try {
      // Extract file path from the URL
      const urlParts = student.photo_url.split('/');
      const bucketIndex = urlParts.findIndex((p: string) => p === 'student-photos' || p === 'students');
      if (bucketIndex !== -1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from(urlParts[bucketIndex]).remove([filePath]);
      }
    } catch {
      // Ignore storage errors - photo cleanup is best-effort
    }
  }
  
  return !error;
}

/**
 * Per-institution student counts (institution_id -> count) for ONE session,
 * computed directly from the students table instead of the stale
 * institutions.total_students counter (which the app never updated).
 * A new (empty) session yields no rows -> every count shows 0 while
 * previous sessions' rows stay untouched in the database.
 * Refetches every 30s and on window focus so the Institutions table
 * "Students" column stays dynamic without a page reload.
 */
export function useInstitutionStudentCounts(sessionId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['students', 'counts', 'by-institution', sessionId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('institution_id')
        .eq('session_id', sessionId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.institution_id) {
          counts[row.institution_id] = (counts[row.institution_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!sessionId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

/**
 * Per-class student counts (class name -> count) for ONE session, computed
 * directly from the students table so the Classes table's "Students" column
 * is live rather than derived from a counter nothing updates. A session with
 * no students yields an empty map, so every class shows 0.
 * Refetches every 30s and on window focus — same cadence as
 * useInstitutionStudentCounts so both tables stay in sync without reloads.
 */
export function useClassStudentCounts(sessionId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['students', 'counts', 'by-class', sessionId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('class')
        .eq('session_id', sessionId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.class) counts[row.class] = (counts[row.class] || 0) + 1;
      }
      return counts;
    },
    enabled: !!sessionId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useStudents(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['students', sessionId, page, pageSize],
    queryFn: () => fetchStudents(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}

// Own column list including exam_roll (0013) plus the biographical fields the
// Admit Card page prints — kept separate from STUDENT_COLUMNS so every other
// students page keeps working before migration 0013 is run.
const CLASS_ROLL_COLUMNS = 'id,institution_id,session_id,first_name,last_name,first_name_bn,last_name_bn,student_id,class,section,roll,exam_roll,date_of_birth,father_name,mother_name,photo_url,status,created_at,updated_at';

/**
 * All students of one class in a session (across every institution),
 * including their exam roll. Used by the super-admin Roll Numbers page.
 * Throws on error so the page can surface "run migration 0013".
 */
export async function fetchStudentsByClass(sessionId?: string, className?: string): Promise<Student[]> {
  const supabase = createClient();
  if (!sessionId || !className) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(CLASS_ROLL_COLUMNS)
    .eq('session_id', sessionId)
    .eq('class', className)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapStudent);
}

export function useStudentsByClass(sessionId?: string, className?: string) {
  return useQuery({
    queryKey: ['students', 'by-class', sessionId, className],
    queryFn: () => fetchStudentsByClass(sessionId, className),
    enabled: !!sessionId && !!className,
    staleTime: 30 * 1000,
  });
}

export function useStudentsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['students', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchStudentsByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 60 * 1000,
  });
}

export function useStudentById(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => fetchStudentById(id),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => createStudent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) => updateStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      // Invalidate ALL related queries so deleted student data disappears everywhere
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['admit_cards'] });
      qc.invalidateQueries({ queryKey: ['admit-cards'] });
      qc.invalidateQueries({ queryKey: ['marks'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
