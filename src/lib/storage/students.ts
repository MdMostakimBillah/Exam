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
  // First delete related registrations
  await supabase.from('registrations').delete().eq('student_id', id);
  // Then delete the student
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useStudents(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['students', sessionId, page, pageSize],
    queryFn: () => fetchStudents(sessionId, page, pageSize),
    staleTime: 60 * 1000,
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
      qc.invalidateQueries({ queryKey: ['admit-cards'] });
      qc.invalidateQueries({ queryKey: ['marks'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
