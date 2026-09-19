import { Certificate } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'certificates';

const CERTIFICATE_COLUMNS = 'id,session_id,certificate_number,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,position,total_marks,exam_year,issue_date,result_id,qr_code,status,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

function mapCertificate(data: any): Certificate {
  return {
    id: data.id,
    sessionId: data.session_id,
    certificateNumber: data.certificate_number,
    studentId: data.student_id,
    studentName: data.student_name,
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    examId: data.exam_id,
    examName: data.exam_name,
    className: data.class_name,
    position: data.position,
    totalMarks: data.total_marks,
    examYear: data.exam_year,
    issueDate: data.issue_date,
    resultId: data.result_id,
    qrCode: data.qr_code,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchCertificates(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Certificate[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(CERTIFICATE_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapCertificate);
}

export async function fetchCertificatesByInstitution(institutionId: string, sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Certificate[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(CERTIFICATE_COLUMNS)
    .eq('session_id', sid)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapCertificate);
}

export async function fetchCertificateById(id: string): Promise<Certificate | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(CERTIFICATE_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapCertificate(data);
}

export async function fetchCertificateByNumber(certificateNumber: string): Promise<Certificate | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(CERTIFICATE_COLUMNS).eq('certificate_number', certificateNumber).single();
  if (error || !data) return undefined;
  return mapCertificate(data);
}

export async function createCertificate(data: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Certificate> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      certificate_number: data.certificateNumber,
      student_id: data.studentId,
      student_name: data.studentName,
      institution_id: data.institutionId,
      institution_name: data.institutionName,
      exam_id: data.examId,
      exam_name: data.examName,
      class_name: data.className,
      position: data.position,
      total_marks: data.totalMarks,
      exam_year: data.examYear,
      issue_date: data.issueDate,
      result_id: data.resultId,
      qr_code: data.qrCode,
      status: data.status,
    })
    .select(CERTIFICATE_COLUMNS)
    .single();
  if (error) throw error;
  return mapCertificate(result);
}

export async function updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.certificateNumber !== undefined) u.certificate_number = data.certificateNumber;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.studentName !== undefined) u.student_name = data.studentName;
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.institutionName !== undefined) u.institution_name = data.institutionName;
  if (data.examId !== undefined) u.exam_id = data.examId;
  if (data.examName !== undefined) u.exam_name = data.examName;
  if (data.className !== undefined) u.class_name = data.className;
  if (data.position !== undefined) u.position = data.position;
  if (data.totalMarks !== undefined) u.total_marks = data.totalMarks;
  if (data.examYear !== undefined) u.exam_year = data.examYear;
  if (data.issueDate !== undefined) u.issue_date = data.issueDate;
  if (data.resultId !== undefined) u.result_id = data.resultId;
  if (data.qrCode !== undefined) u.qr_code = data.qrCode;
  if (data.status !== undefined) u.status = data.status;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(CERTIFICATE_COLUMNS).single();
  if (error) return undefined;
  return mapCertificate(result);
}

export async function deleteCertificate(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useCertificates(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['certificates', sessionId, page, pageSize],
    queryFn: () => fetchCertificates(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}

export function useCertificatesByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['certificates', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchCertificatesByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 60 * 1000,
  });
}

export function useCertificateById(id: string) {
  return useQuery({
    queryKey: ['certificates', id],
    queryFn: () => fetchCertificateById(id),
    enabled: !!id,
  });
}

export function useCertificateByNumber(certificateNumber: string) {
  return useQuery({
    queryKey: ['certificates', 'number', certificateNumber],
    queryFn: () => fetchCertificateByNumber(certificateNumber),
    enabled: !!certificateNumber,
  });
}

export function useCreateCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>) => createCertificate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}

export function useUpdateCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Certificate> }) => updateCertificate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}

export function useDeleteCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCertificate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}
