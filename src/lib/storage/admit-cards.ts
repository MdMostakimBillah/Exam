import { AdmitCard } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { getCurrentSession } from './sessions';

const KEY = 'admit_cards';
const SUPABASE_TABLE = 'admit_cards';

function mapAdmitCard(data: any): AdmitCard {
  return {
    id: data.id,
    sessionId: data.session_id,
    registrationId: data.registration_id,
    studentId: data.student_id,
    studentName: data.student_name,
    institutionName: data.institution_name,
    examName: data.exam_name,
    className: data.class_name,
    roll: data.roll,
    registrationNumber: data.registration_number,
    examDate: data.exam_date,
    examCenter: data.exam_center,
    qrCode: data.qr_code,
    instructions: data.instructions,
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
      const cards = data.map(mapAdmitCard);
      const existing = getStore<AdmitCard>(KEY);
      const otherSessions = existing.filter(c => c.sessionId !== sid);
      setStore(KEY, [...cards, ...otherSessions]);
    }
  } catch {
    // Ignore sync errors
  }
}

if (typeof window !== 'undefined') {
  syncFromSupabase();
}

export function getAdmitCards(): AdmitCard[] {
  return getStore<AdmitCard>(KEY);
}

export function getAdmitCardById(id: string): AdmitCard | undefined {
  return getAdmitCards().find(c => c.id === id);
}

export async function createAdmitCard(data: Omit<AdmitCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdmitCard> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      session_id: data.sessionId,
      registration_id: data.registrationId,
      student_id: data.studentId,
      student_name: data.studentName,
      institution_name: data.institutionName,
      exam_name: data.examName,
      class_name: data.className,
      roll: data.roll,
      registration_number: data.registrationNumber,
      exam_date: data.examDate,
      exam_center: data.examCenter,
      qr_code: data.qrCode,
      instructions: data.instructions,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  const card = mapAdmitCard(result);
  
  const items = getAdmitCards();
  items.unshift(card);
  setStore(KEY, items);
  
  return card;
}