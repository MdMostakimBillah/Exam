import { Payment } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'payments';
const SUPABASE_TABLE = 'payments';

function mapPayment(data: any): Payment {
  return {
    id: data.id,
    sessionId: data.session_id,
    transactionId: data.transaction_id,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    examId: data.exam_id,
    examName: data.exam_name,
    studentCount: data.student_count,
    amount: data.amount,
    paymentMethod: data.payment_method,
    status: data.status,
    date: data.date,
    registrationId: data.registration_id,
    studentId: data.student_id,
    studentName: data.student_name,
    reference: data.reference,
    paymentDate: data.payment_date,
    notes: data.notes,
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
      const payments = data.map(mapPayment);
      const existing = getStore<Payment>(KEY);
      const otherSessions = existing.filter(p => p.sessionId !== sid);
      setStore(KEY, [...payments, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getPayments(): Payment[] {
  return getStore<Payment>(KEY);
}

export function getPaymentsByInstitution(institutionId: string): Payment[] {
  return getPayments().filter(p => p.institutionId === institutionId);
}

export function getPaymentById(id: string): Payment | undefined {
  return getPayments().find(p => p.id === id);
}

export async function createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      transaction_id: data.transactionId,
      institution_id: data.institutionId,
      institution_name: data.institutionName,
      exam_id: data.examId,
      exam_name: data.examName,
      student_count: data.studentCount,
      amount: data.amount,
      payment_method: data.paymentMethod,
      status: data.status,
      date: data.date,
      registration_id: data.registrationId,
      student_id: data.studentId,
      student_name: data.studentName,
      reference: data.reference,
      payment_date: data.paymentDate,
      notes: data.notes,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const payment = mapPayment(result);
  
  const items = getPayments();
  items.unshift(payment);
  setStore(KEY, items);
  
  return payment;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.transactionId !== undefined) updateData.transaction_id = data.transactionId;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.institutionName !== undefined) updateData.institution_name = data.institutionName;
  if (data.examId !== undefined) updateData.exam_id = data.examId;
  if (data.examName !== undefined) updateData.exam_name = data.examName;
  if (data.studentCount !== undefined) updateData.student_count = data.studentCount;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.paymentMethod !== undefined) updateData.payment_method = data.paymentMethod;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.registrationId !== undefined) updateData.registration_id = data.registrationId;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.studentName !== undefined) updateData.student_name = data.studentName;
  if (data.reference !== undefined) updateData.reference = data.reference;
  if (data.paymentDate !== undefined) updateData.payment_date = data.paymentDate;
  if (data.notes !== undefined) updateData.notes = data.notes;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const payment = mapPayment(result);
  
  const items = getPayments();
  const idx = items.findIndex(p => p.id === id);
  if (idx !== -1) {
    items[idx] = payment;
    setStore(KEY, items);
  }
  
  return payment;
}