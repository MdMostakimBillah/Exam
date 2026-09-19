import { Registration } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

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

export async function fetchRegistrationsServer(
  sessionId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Registration[]> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(REGISTRATION_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapRegistration);
}
