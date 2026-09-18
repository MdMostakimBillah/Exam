import { Student } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'students';
const SUPABASE_TABLE = 'students';

function mapStudent(data: any): Student {
  return { id: data.id, institutionId: data.institution_id, sessionId: data.session_id, firstName: data.first_name, lastName: data.last_name, studentId: data.student_id, class: data.class, section: data.section, roll: data.roll, dateOfBirth: data.date_of_birth, gender: data.gender, fatherName: data.father_name, motherName: data.mother_name, phone: data.phone, address: data.address, photo: data.photo_url, status: data.status, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapStudent);
      const existing = getStore<Student>(KEY);
      const otherSessions = existing.filter(s => s.sessionId !== sid);
      setStore(KEY, [...items, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getStudents(): Student[] {
  return getStore<Student>(KEY);
}

export function getStudentsByInstitution(institutionId: string): Student[] {
  return getStudents().filter(s => s.institutionId === institutionId);
}

// Async getters
export async function fetchStudents(sessionId?: string): Promise<Student[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapStudent);
}

export async function fetchStudentsByInstitution(institutionId: string, sessionId?: string): Promise<Student[]> {
  const students = await fetchStudents(sessionId);
  return students.filter(s => s.institutionId === institutionId);
}

export async function fetchStudentById(id: string): Promise<Student | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapStudent(data);
}

// Async standalone CRUD
export async function createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ institution_id: data.institutionId, session_id: data.sessionId, first_name: data.firstName, last_name: data.lastName, student_id: data.studentId, class: data.class, section: data.section, roll: data.roll, date_of_birth: data.dateOfBirth, gender: data.gender, father_name: data.fatherName, mother_name: data.motherName, phone: data.phone, address: data.address, photo_url: data.photo, status: data.status }).select().single();
  if (error) throw error;
  const student = mapStudent(result);
  const items = getStudents();
  items.unshift(student);
  setStore(KEY, items);
  return student;
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.firstName !== undefined) u.first_name = data.firstName;
  if (data.lastName !== undefined) u.last_name = data.lastName;
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
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const student = mapStudent(result);
  const items = getStudents();
  const idx = items.findIndex(s => s.id === id);
  if (idx !== -1) items[idx] = student;
  setStore(KEY, items);
  return student;
}

export async function deleteStudent(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getStudents().filter(s => s.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useStudents(sessionId?: string) { return useQuery({ queryKey: ['students', sessionId], queryFn: () => fetchStudents(sessionId) }); }
export function useStudentsByInstitution(institutionId: string, sessionId?: string) { return useQuery({ queryKey: ['students', 'institution', institutionId], queryFn: () => fetchStudentsByInstitution(institutionId, sessionId), enabled: !!institutionId }); }
export function useStudentById(id: string) { return useQuery({ queryKey: ['students', id], queryFn: () => fetchStudentById(id), enabled: !!id }); }

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => createStudent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) => updateStudent(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}
