import { AdmitCard } from '../types';
import { getStore, setStore } from './storage';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

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
    const sid = sessionId || (await fetchCurrentSession())?.id;
    if (!sid) return;
    const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
    if (!error && data) {
      const items = data.map(mapAdmitCard);
      const existing = getStore<AdmitCard>(KEY);
      const otherSessions = existing.filter(a => a.sessionId !== sid);
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
export function getAdmitCards(): AdmitCard[] {
  return getStore<AdmitCard>(KEY);
}

// Async getters
export async function fetchAdmitCards(sessionId?: string): Promise<AdmitCard[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('session_id', sid).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapAdmitCard);
}

export async function fetchAdmitCardById(id: string): Promise<AdmitCard | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('*').eq('id', id).single();
  if (error || !data) return undefined;
  return mapAdmitCard(data);
}

// Async standalone CRUD
export async function createAdmitCard(data: Omit<AdmitCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdmitCard> {
  const supabase = createClient();
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).insert({
    session_id: data.sessionId, registration_id: data.registrationId, student_id: data.studentId,
    student_name: data.studentName, institution_name: data.institutionName, exam_name: data.examName,
    class_name: data.className, roll: data.roll, registration_number: data.registrationNumber,
    exam_date: data.examDate, exam_center: data.examCenter, qr_code: data.qrCode, instructions: data.instructions,
  }).select().single();
  if (error) throw error;
  const card = mapAdmitCard(result);
  const items = getAdmitCards();
  items.unshift(card);
  setStore(KEY, items);
  return card;
}

export async function deleteAdmitCard(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  if (error) return false;
  const items = getAdmitCards().filter(a => a.id !== id);
  setStore(KEY, items);
  return true;
}

// React Query hooks
export function useAdmitCards(sessionId?: string) {
  return useQuery({ queryKey: ['admit_cards', sessionId], queryFn: () => fetchAdmitCards(sessionId) });
}

export function useAdmitCardById(id: string) {
  return useQuery({ queryKey: ['admit_cards', id], queryFn: () => fetchAdmitCardById(id), enabled: !!id });
}

export function useCreateAdmitCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AdmitCard, 'id' | 'createdAt' | 'updatedAt'>) => createAdmitCard(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admit_cards'] }); },
  });
}

export function useDeleteAdmitCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdmitCard(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admit_cards'] }); },
  });
}
