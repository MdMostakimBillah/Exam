import { Payment } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'payments';

const PAYMENT_COLUMNS = 'id,session_id,transaction_id,institution_id,institution_name,exam_id,exam_name,student_count,amount,payment_method,status,date,registration_id,student_id,student_name,reference,payment_date,notes,submitted_by_student,submitted_at,receipt_number,account_number,proof_image,verified_by_super_admin,verified_at,rejection_reason,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

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
    submittedByStudent: data.submitted_by_student,
    submittedAt: data.submitted_at,
    receiptNumber: data.receipt_number,
    accountNumber: data.account_number,
    proofImage: data.proof_image,
    verifiedBySuperAdmin: data.verified_by_super_admin,
    verifiedAt: data.verified_at,
    rejectionReason: data.rejection_reason,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchPayments(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(PAYMENT_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapPayment);
}

export async function fetchPaymentsByInstitution(institutionId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(PAYMENT_COLUMNS)
    .eq('session_id', sid)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapPayment);
}

export async function fetchPaymentById(id: string): Promise<Payment | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(PAYMENT_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapPayment(data);
}

/**
 * Fetch ALL payments for a session (pages past the 1000-row per-request cap),
 * newest first. Used by the super-admin payments page for accurate totals.
 */
export async function fetchAllPayments(sessionId?: string): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const PAGE = 1000;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(PAYMENT_COLUMNS)
      .eq('session_id', sid)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapPayment);
}

/**
 * Fetch ALL payments for one institution in a session (pages past the
 * 1000-row per-request cap), newest first.
 */
export async function fetchAllPaymentsByInstitution(institutionId: string, sessionId?: string): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const PAGE = 1000;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(PAYMENT_COLUMNS)
      .eq('session_id', sid)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapPayment);
}

/**
 * Due amount = (sum of all student registration fees) − (sum of approved
 * PAID payments), floored at 0. Approving an 800tk payment drops Due by 800tk.
 */
export function computeDue(registrations: { paymentAmount: number }[], payments: Payment[]): number {
  const totalFees = registrations.reduce((sum, r) => sum + Number(r.paymentAmount || 0), 0);
  const paid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return Math.max(totalFees - paid, 0);
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
      account_number: data.accountNumber,
      receipt_number: data.receiptNumber,
      submitted_by_student: data.submittedByStudent,
      submitted_at: data.submittedAt,
      proof_image: data.proofImage,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) throw error;
  return mapPayment(result);
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
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(PAYMENT_COLUMNS).single();
  if (error) return undefined;
  return mapPayment(result);
}

export async function deletePayment(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function usePayments(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['payments', sessionId, page, pageSize],
    queryFn: () => fetchPayments(sessionId, page, pageSize),
    staleTime: 30 * 1000,
  });
}
export function usePaymentsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['payments', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchPaymentsByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 30 * 1000,
  });
}
export function useAllPayments(sessionId?: string) {
  return useQuery({
    queryKey: ['payments', 'all', sessionId],
    queryFn: () => fetchAllPayments(sessionId),
    staleTime: 30 * 1000,
  });
}
export function useAllPaymentsByInstitution(institutionId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['payments', 'all', 'institution', institutionId, sessionId],
    queryFn: () => fetchAllPaymentsByInstitution(institutionId, sessionId),
    enabled: !!institutionId,
    staleTime: 30 * 1000,
  });
}
export async function fetchPaymentsByStudent(studentId: string): Promise<Payment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(PAYMENT_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapPayment);
}

export function usePaymentsByStudent(studentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['payments', 'student', studentId],
    queryFn: () => fetchPaymentsByStudent(studentId),
    enabled: !!studentId && (options?.enabled ?? true),
  });
}

export function usePaymentById(id: string) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => fetchPaymentById(id),
    enabled: !!id,
  });
}

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
