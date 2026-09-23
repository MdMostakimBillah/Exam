import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchInstitutions } from './institutions';
import { fetchAllRegistrations } from './registrations';
import { fetchAllPayments } from './payments';
import type { DashboardStats } from '@/lib/data/dashboard';

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
  };
}

/** Aggregate dashboard numbers — refetches every 30s and on window focus. */
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return mapStats(data);
    },
    refetchInterval: STATS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
    retry: 1,
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

export function useDashboardRegistrations() {
  return useQuery({
    queryKey: ['registrations', 'all', undefined],
    queryFn: () => fetchAllRegistrations(),
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}

export function useDashboardPayments() {
  return useQuery({
    queryKey: ['payments', 'all', undefined],
    queryFn: () => fetchAllPayments(),
    refetchInterval: LISTS_REFRESH_MS,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}
