import { Exam } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_TABLE = 'exams';

const EXAM_COLUMNS = 'id,session_id,name,code,academic_year,description,registration_start_date,registration_end_date,exam_date,exam_start_date,exam_end_date,registration_fee,late_fee,classes,subjects,routine,status,created_at,updated_at';

function mapExam(data: any): Exam {
  return {
    id: data.id,
    sessionId: data.session_id,
    name: data.name,
    code: data.code,
    academicYear: data.academic_year,
    description: data.description,
    registrationStartDate: data.registration_start_date,
    registrationEndDate: data.registration_end_date,
    examDate: data.exam_date,
    examStartDate: data.exam_start_date,
    examEndDate: data.exam_end_date,
    registrationFee: data.registration_fee,
    lateFee: data.late_fee,
    classes: data.classes || [],
    subjects: data.subjects || [],
    routine: data.routine || [],
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchExamsServer(sessionId: string): Promise<Exam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(EXAM_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapExam);
}

export async function fetchExamRegistrationCountsServer(sessionId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_exam_registration_counts', { p_session_id: sessionId });
  if (error || !data) return {};
  return (data as Array<{ exam_id: string; registration_count: number }>).reduce(
    (acc, row) => { acc[row.exam_id] = Number(row.registration_count); return acc; },
    {} as Record<string, number>,
  );
}
