import { Mark } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'marks';
const SUPABASE_TABLE = 'marks';

function mapMark(data: any): Mark {
  return {
    id: data.id,
    sessionId: data.session_id,
    studentId: data.student_id,
    registrationId: data.registration_id,
    examId: data.exam_id,
    subjectId: data.subject_id,
    subjectName: data.subject_name,
    marks: data.marks,
    enteredBy: data.entered_by,
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
      const marks = data.map(mapMark);
      const existing = getStore<Mark>(KEY);
      const otherSessions = existing.filter(m => m.sessionId !== sid);
      setStore(KEY, [...marks, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getMarks(): Mark[] {
  return getStore<Mark>(KEY);
}

export function getMarksByRegistration(registrationId: string): Mark[] {
  return getMarks().filter(m => m.registrationId === registrationId);
}

export async function createMark(data: Omit<Mark, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mark> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      student_id: data.studentId,
      registration_id: data.registrationId,
      exam_id: data.examId,
      subject_id: data.subjectId,
      subject_name: data.subjectName,
      marks: data.marks,
      entered_by: data.enteredBy,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const mark = mapMark(result);
  
  const items = getMarks();
  items.unshift(mark);
  setStore(KEY, items);
  
  return mark;
}

export async function updateMark(id: string, data: Partial<Mark>): Promise<Mark | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.registrationId !== undefined) updateData.registration_id = data.registrationId;
  if (data.examId !== undefined) updateData.exam_id = data.examId;
  if (data.subjectId !== undefined) updateData.subject_id = data.subjectId;
  if (data.subjectName !== undefined) updateData.subject_name = data.subjectName;
  if (data.marks !== undefined) updateData.marks = data.marks;
  if (data.enteredBy !== undefined) updateData.entered_by = data.enteredBy;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const mark = mapMark(result);
  
  const items = getMarks();
  const idx = items.findIndex(m => m.id === id);
  if (idx !== -1) {
    items[idx] = mark;
    setStore(KEY, items);
  }
  
  return mark;
}