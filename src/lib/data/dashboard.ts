import { Institution, Student, Exam, Registration, Result, Payment, AcademicSession } from '@/lib/types';
import { fetchInstitutionsServer } from './institutions';
import { fetchStudentsServer } from './students';
import { fetchExamsServer } from './exams';
import { fetchRegistrationsServer } from './registrations';
import { fetchResultsServer } from './results';
import { fetchPaymentsServer } from './payments';
import { fetchCurrentSessionServer } from './sessions';

export interface DashboardData {
  currentSession: AcademicSession | undefined;
  institutions: Institution[];
  students: Student[];
  exams: Exam[];
  registrations: Registration[];
  results: Result[];
  payments: Payment[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const currentSession = await fetchCurrentSessionServer();
  const sid = currentSession?.id || '';

  if (!sid) {
    return {
      currentSession: undefined,
      institutions: [],
      students: [],
      exams: [],
      registrations: [],
      results: [],
      payments: [],
    };
  }

  const [institutions, students, exams, registrations, results, payments] = await Promise.all([
    fetchInstitutionsServer(),
    fetchStudentsServer(sid),
    fetchExamsServer(sid),
    fetchRegistrationsServer(sid),
    fetchResultsServer(sid),
    fetchPaymentsServer(sid),
  ]);

  return {
    currentSession,
    institutions,
    students,
    exams,
    registrations,
    results,
    payments,
  };
}
