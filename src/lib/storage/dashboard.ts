import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchInstitutions } from './institutions';
import { fetchAllRegistrations } from './registrations';
import { fetchAllPayments } from './payments';
import { fetchCurrentSession } from './sessions';
import type { DashboardStats } from '@/lib/data/dashboard';
import type { Registration, Payment } from '@/lib/types';

/**
 * Live-refresh settings for the super-admin dashboard.
 * The global QueryClient defaults (refetchOnWindowFocus: false,
 * staleTime: 60s) make the dashboard feel static — these hooks
 * override them so numbers update without a page reload.
 */
const STATS_REFRESH_MS = 30_000;
const LISTS_REFRESH_MS = 60_000;

function mapStats(d: any): DashboardStats {
  return {
    institutions_total: d?.institutions_total || 0,
    institutions_pending: d?.institutions_pending || 0,
    students_total: d?.students_total || 0,
    exams_active: d?.exams_active || 0,
    registrations_total: d?.registrations_total || 0,
    registrations_pending: d?.registrations_pending || 0,
    registrations_verified_approved: d?.registrations_verified_approved || 0,
    registrations_approved: d?.registrations_approved || 0,
    results_total: d?.results_total || 0,
    payments_total: d?.payments_total || 0,
    payments_due: d?.payments_due || 0,
    registrations_today: Number(d?.registrations_today ?? 0),
    registrations_approved_today: Number(d?.registrations_approved_today ?? 0),
    payments_paid_today: Number(d?.payments_paid_today ?? 0),
    payments_due_today: Number(d?.payments_due_today ?? 0),
  };
}

/**
 * Aggregate dashboard numbers — scoped to the given session (a new empty
 * session shows all zeros) and refetched every 30s / on window focus.
 * Disabled until a session id is known so it never falls back to
 * counting every session.
 */
export function useDashboardStats(sessionId?: string) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats', sessionId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_session_id: sessionId!,
      });
      if (error) throw error;
      return mapStats(data);
    },
    enabled: !!sessionId,
    refetchInterval: STATS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
    retry: 1,
  });
}

/**
 * Lightweight pending registrations queue (limit 5) for dashboard display,
 * eliminating the need to pull thousands of historical rows over the wire.
 */
export async function fetchDashboardPendingRegistrations(sessionId?: string, limit = 5): Promise<Registration[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from('registrations')
    .select('id,session_id,application_id,registration_number,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,status,payment_status,student_payment_status,payment_amount,transaction_id,created_at,updated_at')
    .eq('session_id', sid)
    .not('status', 'in', '("APPROVED","VERIFIED","REJECTED")')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((d: any) => ({
    id: d.id,
    sessionId: d.session_id,
    applicationId: d.application_id,
    registrationNumber: d.registration_number || '',
    studentId: d.student_id,
    studentName: d.student_name,
    studentPhoto: undefined,
    institutionId: d.institution_id,
    institutionName: d.institution_name,
    examId: d.exam_id,
    examName: d.exam_name,
    className: d.class_name,
    status: d.status,
    paymentStatus: d.payment_status,
    studentPaymentStatus: d.student_payment_status || 'NOT_SUBMITTED',
    paymentAmount: d.payment_amount,
    transactionId: d.transaction_id,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

/**
 * Lightweight pending payments queue (limit 5) for dashboard display.
 */
export async function fetchDashboardPendingPayments(sessionId?: string, limit = 5): Promise<Payment[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from('payments')
    .select('id,session_id,institution_id,institution_name,exam_id,exam_name,amount,student_count,payment_method,transaction_id,date,proof_image,status,submitted_at,verified_at,rejected_reason,notes,created_at,updated_at')
    .eq('session_id', sid)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((d: any) => ({
    id: d.id,
    sessionId: d.session_id,
    institutionId: d.institution_id,
    institutionName: d.institution_name,
    examId: d.exam_id,
    examName: d.exam_name,
    amount: Number(d.amount || 0),
    studentCount: d.student_count,
    paymentMethod: d.payment_method,
    transactionId: d.transaction_id,
    date: d.date,
    proofImage: d.proof_image,
    status: d.status,
    submittedAt: d.submitted_at,
    verifiedAt: d.verified_at,
    rejectedReason: d.rejected_reason,
    notes: d.notes,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export function useDashboardPendingRegistrations(sessionId?: string) {
  return useQuery({
    queryKey: ['registrations', 'dashboard-pending', sessionId],
    queryFn: () => fetchDashboardPendingRegistrations(sessionId, 5),
    enabled: !!sessionId,
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000,
  });
}

export function useDashboardPendingPayments(sessionId?: string) {
  return useQuery({
    queryKey: ['payments', 'dashboard-pending', sessionId],
    queryFn: () => fetchDashboardPendingPayments(sessionId, 5),
    enabled: !!sessionId,
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000,
  });
}

// The three list hooks below mirror the exact query keys/fetchers of the
// existing hooks (useInstitutions / useAllRegistrations / useAllPayments)
// so the dashboard shares their cache instead of duplicating fetches —
// they just add live-refresh options on top.

export function useDashboardInstitutions() {
  return useQuery({
    queryKey: ['institutions'],
    queryFn: fetchInstitutions,
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardRegistrations(sessionId?: string) {
  return useQuery({
    queryKey: ['registrations', 'all', sessionId],
    queryFn: () => fetchAllRegistrations(sessionId),
    enabled: !!sessionId,
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}

export function useDashboardPayments(sessionId?: string) {
  return useQuery({
    queryKey: ['payments', 'all', sessionId],
    queryFn: () => fetchAllPayments(sessionId),
    enabled: !!sessionId,
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}
