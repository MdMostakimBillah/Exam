import { AdmitCard } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'admit_cards';

const ADMIT_CARD_COLUMNS = 'id,session_id,registration_id,student_id,student_name,institution_name,exam_name,class_name,roll,registration_number,exam_date,exam_center,qr_code,instructions,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

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

export async function fetchAdmitCards(sessionId?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<AdmitCard[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(ADMIT_CARD_COLUMNS)
    .eq('session_id', sid)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error || !data) return [];
  return data.map(mapAdmitCard);
}

export async function fetchAdmitCardById(id: string): Promise<AdmitCard | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(ADMIT_CARD_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapAdmitCard(data);
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
    .select(ADMIT_CARD_COLUMNS)
    .single();
  if (error) throw error;
  return mapAdmitCard(result);
}

export async function deleteAdmitCard(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  return !error;
}

export function useAdmitCards(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['admit_cards', sessionId, page, pageSize],
    queryFn: () => fetchAdmitCards(sessionId, page, pageSize),
    staleTime: 60 * 1000,
  });
}
export function useAdmitCardById(id: string) {
  return useQuery({
    queryKey: ['admit_cards', id],
    queryFn: () => fetchAdmitCardById(id),
    enabled: !!id,
  });
}

export function useCreateAdmitCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<AdmitCard, 'id' | 'createdAt' | 'updatedAt'>) => createAdmitCard(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admit_cards'] }),
  });
}

export function useDeleteAdmitCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdmitCard(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admit_cards'] }),
  });
}
