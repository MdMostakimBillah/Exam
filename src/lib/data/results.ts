import { Result } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_TABLE = 'results';

const RESULT_LIST_COLUMNS = 'id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,mark_setup_version,created_at,updated_at';

const RESULT_FULL_COLUMNS = RESULT_LIST_COLUMNS + ',subject_marks';

const DEFAULT_PAGE_SIZE = 20;

function mapResult(data: any): Result {
  return {
    id: data.id,
    sessionId: data.session_id,
    studentId: data.student_id,
    studentName: data.student_name,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    examId: data.exam_id,
    examName: data.exam_name,
    className: data.class_name,
    roll: data.roll,
    registrationNumber: data.registration_number,
    subjectMarks: data.subject_marks || [],
    totalMarks: Number(data.total_marks ?? 0),
    totalFullMarks: Number(data.total_full_marks ?? 0),
    percentage: Number(data.percentage ?? 0),
    grade: data.grade || '',
    position: Number(data.position ?? 0),
    pass: Boolean(data.pass),
    scholarshipStatus: data.scholarship_status || 'PENDING',
    status: data.status,
    markSetupVersion: data.mark_setup_version === null || data.mark_setup_version === undefined
      ? null
      : Number(data.mark_setup_version),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchResultsServer(
  sessionId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<Result[]> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_LIST_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapResult);
}

export async function fetchResultByIdServer(id: string): Promise<Result | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(RESULT_FULL_COLUMNS)
    .eq('id', id)
    .single();
  if (error || !data) return undefined;
  return mapResult(data);
}
