import { Registration } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'registrations';
const SUPABASE_TABLE = 'registrations';

function mapRegistration(data: any): Registration {
  return {
    id: data.id,
    sessionId: data.session_id,
    applicationId: data.application_id,
    studentId: data.student_id,
    studentName: data.student_name,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    examId: data.exam_id,
    examName: data.exam_name,
    className: data.class_name,
    status: data.status,
    paymentStatus: data.payment_status,
    paymentAmount: data.payment_amount,
    transactionId: data.transaction_id,
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
      const regs = data.map(mapRegistration);
      const existing = getStore<Registration>(KEY);
      const otherSessions = existing.filter(r => r.sessionId !== sid);
      setStore(KEY, [...regs, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getRegistrations(): Registration[] {
  return getStore<Registration>(KEY);
}

export function getRegistrationsByInstitution(institutionId: string): Registration[] {
  return getRegistrations().filter(r => r.institutionId === institutionId);
}

export function getRegistrationsByExam(examId: string): Registration[] {
  return getRegistrations().filter(r => r.examId === examId);
}

export function getRegistrationById(id: string): Registration | undefined {
  return getRegistrations().find(r => r.id === id);
}

export async function createRegistration(data: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Registration> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      application_id: data.applicationId,
      student_id: data.studentId,
      student_name: data.studentName,
      institution_id: data.institutionId,
      institution_name: data.institutionName,
      exam_id: data.examId,
      exam_name: data.examName,
      class_name: data.className,
      status: data.status,
      payment_status: data.paymentStatus,
      payment_amount: data.paymentAmount,
      transaction_id: data.transactionId,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const reg = mapRegistration(result);
  
  const items = getRegistrations();
  items.unshift(reg);
  setStore(KEY, items);
  
  return reg;
}

export async function updateRegistration(id: string, data: Partial<Registration>): Promise<Registration | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.applicationId !== undefined) updateData.application_id = data.applicationId;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.studentName !== undefined) updateData.student_name = data.studentName;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.institutionName !== undefined) updateData.institution_name = data.institutionName;
  if (data.examId !== undefined) updateData.exam_id = data.examId;
  if (data.examName !== undefined) updateData.exam_name = data.examName;
  if (data.className !== undefined) updateData.class_name = data.className;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.paymentStatus !== undefined) updateData.payment_status = data.paymentStatus;
  if (data.paymentAmount !== undefined) updateData.payment_amount = data.paymentAmount;
  if (data.transactionId !== undefined) updateData.transaction_id = data.transactionId;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const reg = mapRegistration(result);
  
  const items = getRegistrations();
  const idx = items.findIndex(r => r.id === id);
  if (idx !== -1) {
    items[idx] = reg;
    setStore(KEY, items);
  }
  
  return reg;
}