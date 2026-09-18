import { Certificate } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const KEY = 'certificates';
const SUPABASE_TABLE = 'certificates';

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

async function syncFromSupabase(sessionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const supabase = createClient();
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapCertificate);
      const existing = getStore<Certificate>(KEY);
      const otherSessions = existing.filter(c => c.sessionId !== sid);
      setStore(KEY, [...items, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

// Sync getters (localStorage)
export function getCertificates(): Certificate[] {
  return getStore<Certificate>(KEY);
}

export function getCertificatesByInstitution(institutionId: string): Certificate[] {
  return getCertificates().filter(c => c.institutionId === institutionId);
}

export function getCertificateByNumber(certificateNumber: string): Certificate | undefined {
  return getCertificates().find(c => c.certificateNumber === certificateNumber);
}

// Async getters
export async function fetchCertificates(sessionId?: string): Promise<Certificate[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapCertificate);
}

export async function fetchCertificatesByInstitution(institutionId: string, sessionId?: string): Promise<Certificate[]> {
  const certs = await fetchCertificates(sessionId);
  return certs.filter(c => c.institutionId === institutionId);
}

export async function fetchCertificateById(id: string): Promise<Certificate | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapCertificate(data);
}

export async function fetchCertificateByNumber(certificateNumber: string): Promise<Certificate | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('certificate_number', certificateNumber).single();
  if (error || !data) return undefined;
  return mapCertificate(data);
}

// Async standalone CRUD
export async function createCertificate(data: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Promise<Certificate> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({
    session_id: data.sessionId, certificate_number: data.certificateNumber, student_id: data.studentId,
    student_name: data.studentName, institution_id: data.institutionId, institution_name: data.institutionName,
    exam_id: data.examId, exam_name: data.examName, class_name: data.className, position: data.position,
    total_marks: data.totalMarks, exam_year: data.examYear, issue_date: data.issueDate, result_id: data.resultId,
    qr_code: data.qrCode, status: data.status,
  }).select().single();
  if (error) throw error;
  const cert = mapCertificate(result);
  const items = getCertificates();
  items.unshift(cert);
  setStore(KEY, items);
  return cert;
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
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select().single();
  if (error) return undefined;
  const cert = mapCertificate(result);
  const items = getCertificates();
  const idx = items.findIndex(c => c.id === id);
  if (idx !== -1) items[idx] = cert;
  setStore(KEY, items);
  return cert;
}

export async function deleteCertificate(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getCertificates().filter(c => c.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useCertificates(sessionId?: string) {
  return useQuery({ queryKey: ['certificates', sessionId], queryFn: () => fetchCertificates(sessionId) });
}

export function useCertificatesByInstitution(institutionId: string, sessionId?: string) {
  return useQuery({ queryKey: ['certificates', 'institution', institutionId], queryFn: () => fetchCertificatesByInstitution(institutionId, sessionId), enabled: !!institutionId });
}

export function useCertificateById(id: string) {
  return useQuery({ queryKey: ['certificates', id], queryFn: () => fetchCertificateById(id), enabled: !!id });
}

export function useCertificateByNumber(certificateNumber: string) {
  return useQuery({ queryKey: ['certificates', 'number', certificateNumber], queryFn: () => fetchCertificateByNumber(certificateNumber), enabled: !!certificateNumber });
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
