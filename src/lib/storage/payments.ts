import { Payment } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'payments';
const SUPABASE_TABLE = 'payments';

function mapPayment(data: any): Payment {
  return { id: data.id, sessionId: data.session_id, transactionId: data.transaction_id, institutionId: data.institution_id, institutionName: data.institution_name, examId: data.exam_id, examName: data.exam_name, studentCount: data.student_count, amount: data.amount, paymentMethod: data.payment_method, status: data.status, date: data.date, registrationId: data.registration_id, studentId: data.student_id, studentName: data.student_name, reference: data.reference, paymentDate: data.payment_date, notes: data.notes, submittedByStudent: data.submitted_by_student, submittedAt: data.submitted_at, receiptNumber: data.receipt_number, accountNumber: data.account_number, proofImage: data.proof_image, verifiedBySuperAdmin: data.verified_by_super_admin, verifiedAt: data.verified_at, rejectionReason: data.rejection_reason, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapPayment);
      const existing = getStore<Payment>(KEY);
      const otherSessions = existing.filter(p => p.sessionId !== sid);
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
export function getPayments(): Payment[] {
  return getStore<Payment>(KEY);
}

export function getPaymentsByInstitution(institutionId: string): Payment[] {
  return getPayments().filter(p => p.institutionId === institutionId);
}

// Async getters
export async function fetchPayments(sessionId?: string): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPayment);
}

export async function fetchPaymentsByInstitution(institutionId: string, sessionId?: string): Promise<Payment[]> {
  const payments = await fetchPayments(sessionId);
  return payments.filter(p => p.institutionId === institutionId);
}

export async function fetchPaymentById(id: string): Promise<Payment | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapPayment(data);
}

// Async standalone CRUD
export async function createPayment(data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ session_id: data.sessionId, transaction_id: data.transactionId, institution_id: data.institutionId, institution_name: data.institutionName, exam_id: data.examId, exam_name: data.examName, student_count: data.studentCount, amount: data.amount, payment_method: data.paymentMethod, status: data.status, date: data.date, registration_id: data.registrationId, student_id: data.studentId, student_name: data.studentName, reference: data.reference, payment_date: data.paymentDate, notes: data.notes }).select().single();
  if (error) throw error;
  const payment = mapPayment(result);
  const items = getPayments();
  items.unshift(payment);
  setStore(KEY, items);
  return payment;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.transactionId !== undefined) u.transaction_id = data.transactionId;
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.institutionName !== undefined) u.institution_name = data.institutionName;
  if (data.examId !== undefined) u.exam_id = data.examId;
  if (data.examName !== undefined) u.exam_name = data.examName;
  if (data.studentCount !== undefined) u.student_count = data.studentCount;
  if (data.amount !== undefined) u.amount = data.amount;
  if (data.paymentMethod !== undefined) u.payment_method = data.paymentMethod;
  if (data.status !== undefined) u.status = data.status;
  if (data.date !== undefined) u.date = data.date;
  if (data.registrationId !== undefined) u.registration_id = data.registrationId;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.studentName !== undefined) u.student_name = data.studentName;
  if (data.reference !== undefined) u.reference = data.reference;
  if (data.paymentDate !== undefined) u.payment_date = data.paymentDate;
  if (data.notes !== undefined) u.notes = data.notes;
  if (data.submittedByStudent !== undefined) u.submitted_by_student = data.submittedByStudent;
  if (data.submittedAt !== undefined) u.submitted_at = data.submittedAt;
  if (data.receiptNumber !== undefined) u.receipt_number = data.receiptNumber;
  if (data.accountNumber !== undefined) u.account_number = data.accountNumber;
  if (data.proofImage !== undefined) u.proof_image = data.proofImage;
  if (data.verifiedBySuperAdmin !== undefined) u.verified_by_super_admin = data.verifiedBySuperAdmin;
  if (data.verifiedAt !== undefined) u.verified_at = data.verifiedAt;
  if (data.rejectionReason !== undefined) u.rejection_reason = data.rejectionReason;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const payment = mapPayment(result);
  const items = getPayments();
  const idx = items.findIndex(p => p.id === id);
  if (idx !== -1) items[idx] = payment;
  setStore(KEY, items);
  return payment;
}

export async function deletePayment(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getPayments().filter(p => p.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function usePayments(sessionId?: string) { return useQuery({ queryKey: ['payments', sessionId], queryFn: () => fetchPayments(sessionId) }); }
export function usePaymentsByInstitution(institutionId: string, sessionId?: string) { return useQuery({ queryKey: ['payments', 'institution', institutionId], queryFn: () => fetchPaymentsByInstitution(institutionId, sessionId), enabled: !!institutionId }); }
export function usePaymentById(id: string) { return useQuery({ queryKey: ['payments', id], queryFn: () => fetchPaymentById(id), enabled: !!id }); }

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>) => createPayment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Payment> }) => updatePayment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}
