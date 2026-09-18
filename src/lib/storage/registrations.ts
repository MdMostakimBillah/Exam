import { Registration } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'registrations';
const SUPABASE_TABLE = 'registrations';

function mapRegistration(data: any): Registration {
  return { id: data.id, sessionId: data.session_id, applicationId: data.application_id, studentId: data.student_id, studentName: data.student_name, institutionId: data.institution_id, institutionName: data.institution_name, examId: data.exam_id, examName: data.exam_name, className: data.class_name, status: data.status, paymentStatus: data.payment_status, studentPaymentStatus: data.student_payment_status || 'NOT_SUBMITTED', paymentAmount: data.payment_amount, transactionId: data.transaction_id, createdAt: data.created_at, updatedAt: data.updated_at };
}

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapRegistration);
      const existing = getStore<Registration>(KEY);
      const otherSessions = existing.filter(r => r.sessionId !== sid);
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
export function getRegistrations(): Registration[] {
  return getStore<Registration>(KEY);
}

export function getRegistrationsByInstitution(institutionId: string): Registration[] {
  return getRegistrations().filter(r => r.institutionId === institutionId);
}

// Async getters
export async function fetchRegistrations(sessionId?: string): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapRegistration);
}

export async function fetchRegistrationsByInstitution(institutionId: string, sessionId?: string): Promise<Registration[]> {
  const regs = await fetchRegistrations(sessionId);
  return regs.filter(r => r.institutionId === institutionId);
}

export async function fetchRegistrationsByExam(examId: string, sessionId?: string): Promise<Registration[]> {
  const regs = await fetchRegistrations(sessionId);
  return regs.filter(r => r.examId === examId);
}

export async function fetchRegistrationById(id: string): Promise<Registration | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapRegistration(data);
}

// Async standalone CRUD
export async function createRegistration(data: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Registration> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({ session_id: data.sessionId, application_id: data.applicationId, student_id: data.studentId, student_name: data.studentName, institution_id: data.institutionId, institution_name: data.institutionName, exam_id: data.examId, exam_name: data.examName, class_name: data.className, status: data.status, payment_status: data.paymentStatus, student_payment_status: data.studentPaymentStatus, payment_amount: data.paymentAmount, transaction_id: data.transactionId }).select().single();
  if (error) throw error;
  const reg = mapRegistration(result);
  const items = getRegistrations();
  items.unshift(reg);
  setStore(KEY, items);
  return reg;
}

export async function updateRegistration(id: string, data: Partial<Registration>): Promise<Registration | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.applicationId !== undefined) u.application_id = data.applicationId;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.studentName !== undefined) u.student_name = data.studentName;
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.institutionName !== undefined) u.institution_name = data.institutionName;
  if (data.examId !== undefined) u.exam_id = data.examId;
  if (data.examName !== undefined) u.exam_name = data.examName;
  if (data.className !== undefined) u.class_name = data.className;
  if (data.status !== undefined) u.status = data.status;
  if (data.paymentStatus !== undefined) u.payment_status = data.paymentStatus;
  if (data.studentPaymentStatus !== undefined) u.student_payment_status = data.studentPaymentStatus;
  if (data.paymentAmount !== undefined) u.payment_amount = data.paymentAmount;
  if (data.transactionId !== undefined) u.transaction_id = data.transactionId;
  const { data: result, error } = await createClient().from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const reg = mapRegistration(result);
  const items = getRegistrations();
  const idx = items.findIndex(r => r.id === id);
  if (idx !== -1) items[idx] = reg;
  setStore(KEY, items);
  return reg;
}

export async function deleteRegistration(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await createClient().from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getRegistrations().filter(r => r.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useRegistrations(sessionId?: string) { return useQuery({ queryKey: ['registrations', sessionId], queryFn: () => fetchRegistrations(sessionId) }); }
export function useRegistrationsByInstitution(institutionId: string, sessionId?: string) { return useQuery({ queryKey: ['registrations', 'institution', institutionId], queryFn: () => fetchRegistrationsByInstitution(institutionId, sessionId), enabled: !!institutionId }); }
export function useRegistrationsByExam(examId: string, sessionId?: string) { return useQuery({ queryKey: ['registrations', 'exam', examId], queryFn: () => fetchRegistrationsByExam(examId, sessionId), enabled: !!examId }); }
export function useRegistrationById(id: string) { return useQuery({ queryKey: ['registrations', id], queryFn: () => fetchRegistrationById(id), enabled: !!id }); }

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Registration, 'id' | 'createdAt' | 'updatedAt'>) => createRegistration(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
}

export function useUpdateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Registration> }) => updateRegistration(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
}

export function useDeleteRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRegistration(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
}
