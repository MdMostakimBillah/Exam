import { Student } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'students';
const SUPABASE_TABLE = 'students';

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

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const supabase = createClient();
    const sid = sessionId || (await getCurrentSession())?.id;
    if (!sid) return;
    
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const students = data.map(mapStudent);
      const existing = getStore<Student>(KEY);
      const otherSessions = existing.filter(s => s.sessionId !== sid);
      setStore(KEY, [...students, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

// Initialize sync on module load (client-side only)
if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getStudents(): Student[] {
  return getStore<Student>(KEY);
}

export function getStudentsByInstitution(institutionId: string): Student[] {
  return getStudents().filter(s => s.institutionId === institutionId);
}

export function getStudentById(id: string): Student | undefined {
  return getStudents().find(s => s.id === id);
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
    .select()
    .single();
  
  if (error) throw error;
  
  const student = mapStudent(result);
  
  // Update localStorage cache
  const items = getStudents();
  items.unshift(student);
  setStore(KEY, items);
  
  return student;
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.firstName !== undefined) updateData.first_name = data.firstName;
  if (data.lastName !== undefined) updateData.last_name = data.lastName;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.class !== undefined) updateData.class = data.class;
  if (data.section !== undefined) updateData.section = data.section;
  if (data.roll !== undefined) updateData.roll = data.roll;
  if (data.dateOfBirth !== undefined) updateData.date_of_birth = data.dateOfBirth;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.fatherName !== undefined) updateData.father_name = data.fatherName;
  if (data.motherName !== undefined) updateData.mother_name = data.motherName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.photo !== undefined) updateData.photo_url = data.photo;
  if (data.status !== undefined) updateData.status = data.status;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const student = mapStudent(result);
  
  // Update localStorage cache
  const items = getStudents();
  const idx = items.findIndex(s => s.id === id);
  if (idx !== -1) {
    items[idx] = student;
    setStore(KEY, items);
  }
  
  return student;
}

export async function deleteStudent(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  // Update localStorage cache
  const items = getStudents();
  const filtered = items.filter(s => s.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}