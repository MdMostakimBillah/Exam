import { Certificate } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

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
    const sid = sessionId || (await getCurrentSession())?.id;
    if (!sid) return;
    
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      const certs = data.map(mapCertificate);
      const existing = getStore<Certificate>(KEY);
      const otherSessions = existing.filter(c => c.sessionId !== sid);
      setStore(KEY, [...certs, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getCertificates(): Certificate[] {
  return getStore<Certificate>(KEY);
}

export function getCertificatesByInstitution(institutionId: string): Certificate[] {
  return getCertificates().filter(c => c.institutionId === institutionId);
}

export function getCertificateById(id: string): Certificate | undefined {
  return getCertificates().find(c => c.id === id);
}

export function getCertificateByNumber(certificateNumber: string): Certificate | undefined {
  return getCertificates().find(c => c.certificateNumber === certificateNumber);
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
    .select()
    .single();
  
  if (error) throw error;
  
  const cert = mapCertificate(result);
  
  const items = getCertificates();
  items.unshift(cert);
  setStore(KEY, items);
  
  return cert;
}

export async function updateCertificate(id: string, data: Partial<Certificate>): Promise<Certificate | undefined> {
  const supabase = createClient();
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.sessionId !== undefined) updateData.session_id = data.sessionId;
  if (data.certificateNumber !== undefined) updateData.certificate_number = data.certificateNumber;
  if (data.studentId !== undefined) updateData.student_id = data.studentId;
  if (data.studentName !== undefined) updateData.student_name = data.studentName;
  if (data.institutionId !== undefined) updateData.institution_id = data.institutionId;
  if (data.institutionName !== undefined) updateData.institution_name = data.institutionName;
  if (data.examId !== undefined) updateData.exam_id = data.examId;
  if (data.examName !== undefined) updateData.exam_name = data.examName;
  if (data.className !== undefined) updateData.class_name = data.className;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.totalMarks !== undefined) updateData.total_marks = data.totalMarks;
  if (data.examYear !== undefined) updateData.exam_year = data.examYear;
  if (data.issueDate !== undefined) updateData.issue_date = data.issueDate;
  if (data.resultId !== undefined) updateData.result_id = data.resultId;
  if (data.qrCode !== undefined) updateData.qr_code = data.qrCode;
  if (data.status !== undefined) updateData.status = data.status;
  
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return undefined;
  
  const cert = mapCertificate(result);
  
  const items = getCertificates();
  const idx = items.findIndex(c => c.id === id);
  if (idx !== -1) {
    items[idx] = cert;
    setStore(KEY, items);
  }
  
  return cert;
}