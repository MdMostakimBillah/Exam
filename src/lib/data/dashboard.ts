import { Institution, Student, Exam, Registration, Result, Payment, AcademicSession } from '@/lib/types';
import { fetchInstitutionsServer } from './institutions';
import { fetchStudentsServer } from './students';
import { fetchExamsServer } from './exams';
import { fetchRegistrationsServer } from './registrations';
import { fetchResultsServer } from './results';
import { fetchPaymentsServer } from './payments';
import { fetchCurrentSessionServer } from './sessions';
import { createClient } from '@/lib/supabase/server';

export interface DashboardData {
  currentSession: AcademicSession | undefined;
  institutions: Institution[];
  students: Student[];
  exams: Exam[];
  registrations: Registration[];
  results: Result[];
  payments: Payment[];
}

export interface DashboardStats {
  institutions_total: number;
  institutions_pending: number;
  students_total: number;
  exams_active: number;
  registrations_total: number;
  registrations_pending: number;
  registrations_verified_approved: number;
  registrations_approved: number;
  results_total: number;
  payments_total: number;
  payments_due: number;
}

export async function fetchDashboardData(): Promise<{ data: DashboardData; stats: DashboardStats }> {
  const currentSession = await fetchCurrentSessionServer();
  const sid = currentSession?.id || '';

  if (!sid) {
    return {
      data: {
        currentSession: undefined,
        institutions: [],
        students: [],
        exams: [],
        registrations: [],
        results: [],
        payments: [],
      },
      stats: {
        institutions_total: 0,
        institutions_pending: 0,
        students_total: 0,
        exams_active: 0,
        registrations_total: 0,
        registrations_pending: 0,
        registrations_verified_approved: 0,
        registrations_approved: 0,
        results_total: 0,
        payments_total: 0,
        payments_due: 0,
      },
    };
  }

  // Fetch full datasets still needed for detailed views
  const [institutions, students, exams, registrations, results, payments] = await Promise.all([
    fetchInstitutionsServer(),
    fetchStudentsServer(sid),
    fetchExamsServer(sid),
    fetchRegistrationsServer(sid),
    fetchResultsServer(sid),
    fetchPaymentsServer(sid),
  ]);

  // Fetch aggregated stats via single RPC call
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('get_dashboard_stats');

  const stats: DashboardStats = data ? {
    institutions_total: data.institutions_total || 0,
    institutions_pending: data.institutions_pending || 0,
    students_total: data.students_total || 0,
    exams_active: data.exams_active || 0,
    registrations_total: data.registrations_total || 0,
    registrations_pending: data.registrations_pending || 0,
    registrations_verified_approved: data.registrations_verified_approved || 0,
    registrations_approved: data.registrations_approved || 0,
    results_total: data.results_total || 0,
    payments_total: data.payments_total || 0,
    payments_due: data.payments_due || 0,
  } : {
    institutions_total: 0,
    institutions_pending: 0,
    students_total: 0,
    exams_active: 0,
    registrations_total: 0,
    registrations_pending: 0,
    registrations_verified_approved: 0,
    registrations_approved: 0,
    results_total: 0,
    payments_total: 0,
    payments_due: 0,
  };

  return {
    data: {
      currentSession,
      institutions,
      students,
      exams,
      registrations,
      results,
      payments,
    },
    stats,
  };
}
