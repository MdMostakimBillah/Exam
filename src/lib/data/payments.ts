import { Payment } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

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

export async function fetchPaymentsServer(
  sessionId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Payment[]> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(PAYMENT_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapPayment);
}
