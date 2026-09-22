import { Registration } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'registrations';

const REGISTRATION_COLUMNS = 'id,session_id,application_id,registration_number,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,status,payment_status,student_payment_status,payment_amount,transaction_id,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapRegistration(data: any): Registration {
  return {
    id: data.id,
    sessionId: data.session_id,
    applicationId: data.application_id,
    registrationNumber: data.registration_number || '',
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

/**
 * Normalize a registration status for filtering/counting.
 * APPROVED and VERIFIED both count as APPROVED; returns '' when unknown.
 */
export function normalizeRegistrationStatus(status?: string): string {
  if (!status) return '';
  const u = status.toUpperCase();
  if (u === 'APPROVED' || u === 'VERIFIED') return 'APPROVED';
  if (u === 'PENDING') return 'PENDING';
  if (u === 'REJECTED') return 'REJECTED';
  return u;
}

/**
 * Fetch ALL registrations for an institution + session (pages past the 1000-row
 * per-request cap), newest first. Used to map students to their latest
 * registration number & status on the Students page.
 */
export async function fetchAllRegistrationsByInstitution(institutionId: string, sessionId?: string): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const PAGE = 1000;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(REGISTRATION_COLUMNS)
      .eq('session_id', sid)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapRegistration);
}

/**
 * Fetch ALL registrations across every institution for a session (pages past the
 * 1000-row per-request cap), newest first. Used by the super-admin students list.
 */
export async function fetchAllRegistrations(sessionId?: string): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const PAGE = 1000;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(REGISTRATION_COLUMNS)
      .eq('session_id', sid)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapRegistration);
}

export function useAllRegistrationsByInstitution(institutionId: string, sessionId?: string) {
  return useQuery({
    queryKey: ['registrations', 'all', 'institution', institutionId, sessionId],
    queryFn: () => fetchAllRegistrationsByInstitution(institutionId, sessionId),
    enabled: !!institutionId,
    staleTime: 30 * 1000,
  });
}

export function useAllRegistrations(sessionId?: string) {
  return useQuery({
    queryKey: ['registrations', 'all', sessionId],
    queryFn: () => fetchAllRegistrations(sessionId),
    staleTime: 30 * 1000,
  });
}

/**
 * Fetches ALL application_ids globally (no institution filter, no pagination).
 * Used by generateAppId to find the next available number.
 */
export async function fetchAllApplicationIds(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('application_id');
  if (error || !data) return [];
  return data.map((row: { application_id: string }) => row.application_id);
}

/**
 * Fetches ALL registration_numbers globally (no institution filter, no pagination).
 * Used by generateRegistrationNumber to find the next available number.
 */
export async function fetchAllRegistrationNumbers(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('registration_number');
  if (error || !data) return [];
  return data.map((row: { registration_number: string }) => row.registration_number).filter(Boolean);
}

/**
 * Generate the next GLOBAL registration number using a database function.
 * The function is SECURITY DEFINER so it bypasses RLS and returns a number that
 * is sequential across ALL institutions (institution B continues from where
 * institution A left off).
 * Format: YYYYNNNNNN (e.g., 2026000001, 2026000002, ...)
 *
 * Throws if the database function is unavailable. We must NEVER fall back to a
 * client-side computation here: RLS only exposes this institution's rows, so a
 * client-side max+1 would hand out a duplicate (e.g. 2026000001 again).
 * A BEFORE INSERT trigger (migration 0006) is the final safety net — it assigns
 * the authoritative next number inside the database on every insert.
 */
export async function generateGlobalRegistrationNumber(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_next_registration_number');
  if (error || !data) {
    const message = error?.message || 'get_next_registration_number() is unavailable';
    console.error('[registration-number] RPC get_next_registration_number failed:', message, error);
    throw new Error(message);
  }
  return data as string;
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
      registration_number: data.registrationNumber,
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
  if (data.registrationNumber !== undefined) u.registration_number = data.registrationNumber;
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
export async function fetchRegistrationsByStudent(studentId: string): Promise<Registration[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapRegistration);
}

export function useRegistrationsByStudent(studentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['registrations', 'student', studentId],
    queryFn: () => fetchRegistrationsByStudent(studentId),
    enabled: !!studentId && (options?.enabled ?? true),
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

/**
 * Fetches all registration numbers for a specific institution.
 * Used by the fallback path in generateRegistrationNumber when the RPC is unavailable.
 */
export async function fetchRegistrationNumbersByInstitution(institutionId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('registration_number')
    .eq('institution_id', institutionId);
  if (error || !data) return [];
  return data.map((row: { registration_number: string }) => row.registration_number).filter(Boolean);
}
