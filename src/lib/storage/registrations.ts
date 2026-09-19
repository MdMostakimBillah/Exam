import { Registration } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'registrations';

const REGISTRATION_COLUMNS = 'id,session_id,application_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,status,payment_status,student_payment_status,payment_amount,transaction_id,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

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
    studentPaymentStatus: data.student_payment_status || 'NOT_SUBMITTED',
    paymentAmount: data.payment_amount,
    transactionId: data.transaction_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchRegistrations(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapRegistration);
}

export async function fetchRegistrationsByInstitution(institutionId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('session_id', sid)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapRegistration);
}

export async function fetchRegistrationsByExam(examId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('session_id', sid)
    .eq('exam_id', examId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapRegistration);
}

export async function fetchRegistrationById(id: string): Promise<Registration | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(REGISTRATION_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapRegistration(data);
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
      student_payment_status: data.studentPaymentStatus,
      payment_amount: data.paymentAmount,
      transaction_id: data.transactionId,
    })
    .select(REGISTRATION_COLUMNS)
    .single();
  if (error) throw error;
  return mapRegistration(result);
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
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(REGISTRATION_COLUMNS).single();
  if (error) return undefined;
  return mapRegistration(result);
}

export async function deleteRegistration(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useRegistrations(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['registrations', sessionId, page, pageSize],
    queryFn: () => fetchRegistrations(sessionId, page, pageSize),
    staleTime: 30 * 1000,
  });
}
export function useRegistrationsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['registrations', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchRegistrationsByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 30 * 1000,
  });
}
export function useRegistrationsByExam(examId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['registrations', 'exam', examId, sessionId],
    queryFn: () => fetchRegistrationsByExam(examId, sessionId),
    enabled: !!examId,
    staleTime: 30 * 1000,
  });
}
export function useRegistrationById(id: string) {
  return useQuery({
    queryKey: ['registrations', id],
    queryFn: () => fetchRegistrationById(id),
    enabled: !!id,
  });
}

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
