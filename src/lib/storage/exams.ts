import { Exam } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'exams';
const SUPABASE_TABLE = 'exams';

function mapExam(data: any): Exam {
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    code: data.code,
    academicYear: data.academic_year,
    description: data.description,
    registrationStartDate: data.registration_start_date,
    registrationEndDate: data.registration_end_date,
    examDate: data.exam_date,
    registrationFee: data.registration_fee,
    lateFee: data.late_fee,
    classes: data.classes || [],
    subjects: data.subjects || [],
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
      const exams = data.map(mapExam);
      const existing = getStore<Exam>(KEY);
      const otherSessions = existing.filter(e => e.sessionId !== sid);
      setStore(KEY, [...exams, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getExams(): Exam[] {
  return getStore<Exam>(KEY);
}

export function getExamById(id: string): Exam | undefined {
  return getExams().find(e => e.id === id);
}

export async function createExam(data: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exam> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      name: data.name,
      code: data.code,
      academic_year: data.academicYear,
      description: data.description,
      registration_start_date: data.registrationStartDate,
      registration_end_date: data.registrationEndDate,
      exam_date: data.examDate,
      registration_fee: data.registrationFee,
      late_fee: data.lateFee,
      classes: data.classes,
      subjects: data.subjects,
      status: data.status,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const exam = mapExam(result);
  
  const items = getExams();
  items.unshift(exam);
  setStore(KEY, items);
  
  return exam;
}

export async function updateExam(id: string, data: Partial<Exam>): Promise<Exam | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.code !== undefined) updateData.code = data.code;
  if (data.academicYear !== undefined) updateData.academic_year = data.academicYear;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.registrationStartDate !== undefined) updateData.registration_start_date = data.registrationStartDate;
  if (data.registrationEndDate !== undefined) updateData.registration_end_date = data.registrationEndDate;
  if (data.examDate !== undefined) updateData.exam_date = data.examDate;
  if (data.registrationFee !== undefined) updateData.registration_fee = data.registrationFee;
  if (data.lateFee !== undefined) updateData.late_fee = data.lateFee;
  if (data.classes !== undefined) updateData.classes = data.classes;
  if (data.subjects !== undefined) updateData.subjects = data.subjects;
  if (data.status !== undefined) updateData.status = data.status;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const exam = mapExam(result);
  
  const items = getExams();
  const idx = items.findIndex(e => e.id === id);
  if (idx !== -1) {
    items[idx] = exam;
    setStore(KEY, items);
  }
  
  return exam;
}

export async function deleteExam(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) return false;
  
  const items = getExams();
  const filtered = items.filter(e => e.id !== id);
  if (filtered.length === items.length) return false;
  setStore(KEY, filtered);
  return true;
}