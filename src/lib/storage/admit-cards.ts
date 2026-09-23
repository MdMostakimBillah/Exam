import { AdmitCard, Registration, Student, ExamCenter } from '../types';
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

/** Default bilingual directions printed in the card's footer box. */
export const DEFAULT_INSTRUCTIONS = [
  '1. The examinee must bring the Registration Card along with the Admit Card in the exam hall.',
  '2. The examinee must sign the attendance sheet for each subject in the exam hall.',
  '১. পরীক্ষার্থীকে নিবন্ধন কার্ডসহ প্রবেশপত্র পরীক্ষাকক্ষে আনতে হবে।',
  '২. প্রতিটি বিষয়ের পরীক্ষায় উপস্থিতি শীটে স্বাক্ষর করতে হবে।',
].join('\n');

/** Every registration_id that already has a card in this session (paged past the 1000-row cap). */
async function fetchExistingRegistrationIds(sessionId: string): Promise<Set<string>> {
  const supabase = createClient();
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from('admit_cards')
      .select('registration_id')
      .eq('session_id', sessionId)
      .range(from, from + PAGE - 1);
    if (error) break;
    data?.forEach((r: { registration_id: string }) => ids.add(r.registration_id));
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

export interface GenerateAdmitCardsInput {
  sessionId: string;
  examName: string;
  /** YYYY-MM-DD — exam.examStartDate || exam.examDate (exam_date is NOT NULL) */
  examDate: string;
  className: string;
  /** APPROVED registrations for this exam + class (filtered by the page) */
  regs: Registration[];
  /** Students of the class — must include exam_roll */
  students: Student[];
  /** Session exam centers */
  centers: ExamCenter[];
}

export interface GenerateAdmitCardsResult {
  /** New cards inserted */
  created: number;
  /** Registrations that already had a card (skipped — re-run safe) */
  existing: number;
  /** Registrations skipped because the student has no exam roll yet */
  noRoll: number;
  /** No exam centers configured — center text stored as "TBD" */
  noCenters: boolean;
  /** Centers whose allocated will exceed their capacity after this run */
  overCapacity: string[];
  /** Registrations routed to the first center because no center had a free seat */
  fallbackToFirst: number;
}

/**
 * Generate admit cards for one exam + class. Re-run safe:
 * - existing registration_ids are skipped (unique index is the backstop),
 * - students without an exam roll are skipped (roll is NOT NULL),
 * - center = the one linked to the student's institution
 *          -> else first center with a free seat (capacity 0 = unlimited)
 *          -> else the first center at all (+ warning),
 * - seat accounting (allocated) only runs for newly created rows.
 */
export async function generateAdmitCards(input: GenerateAdmitCardsInput): Promise<GenerateAdmitCardsResult> {
  const supabase = createClient();
  const existing = await fetchExistingRegistrationIds(input.sessionId);
  const studentById = new Map(input.students.map(s => [s.id, s]));
  // Oldest first so "(001)" codes and fallback picks stay stable.
  const sortedCenters = [...input.centers].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const allocDelta = new Map<string, number>();
  const rows: Record<string, unknown>[] = [];
  let existingCount = 0;
  let noRoll = 0;
  let fallbackToFirst = 0;

  for (const reg of input.regs) {
    if (existing.has(reg.id)) { existingCount++; continue; }
    const student = studentById.get(reg.studentId);
    if (!student?.examRoll) { noRoll++; continue; }

    let center = sortedCenters.find(c => c.institutionId && c.institutionId === reg.institutionId);
    if (!center) {
      center = sortedCenters.find(c =>
        (c.capacity || 0) <= 0 || (c.allocated || 0) + (allocDelta.get(c.id) || 0) < c.capacity
      );
      if (!center && sortedCenters.length > 0) {
        center = sortedCenters[0];
        fallbackToFirst++;
      }
    }

    const centerText = center
      ? (center.address ? `${center.name} – ${center.address}` : center.name)
      : 'TBD';
    if (center) allocDelta.set(center.id, (allocDelta.get(center.id) || 0) + 1);

    rows.push({
      session_id: input.sessionId,
      registration_id: reg.id,
      student_id: reg.studentId,
      student_name: reg.studentName,
      institution_name: reg.institutionName,
      exam_name: input.examName,
      class_name: input.className,
      roll: student.examRoll,
      registration_number: reg.registrationNumber,
      exam_date: input.examDate,
      exam_center: centerText,
      qr_code: `/result?reg=${reg.registrationNumber}`,
      instructions: DEFAULT_INSTRUCTIONS,
    });
  }

  // Bulk insert; on a race (unique violation) fall back to row-by-row.
  let created = 0;
  if (rows.length > 0) {
    const { error } = await supabase.from('admit_cards').insert(rows);
    if (!error) created = rows.length;
    else if (error.code === '23505') {
      for (const row of rows) {
        const { error: rowError } = await supabase.from('admit_cards').insert(row);
        if (!rowError) created++;
      }
    } else throw error;
  }

  // Seat accounting for the centers we handed out this run.
  const overCapacity: string[] = [];
  for (const [centerId, delta] of allocDelta) {
    const center = sortedCenters.find(c => c.id === centerId);
    if (!center) continue;
    const next = (center.allocated || 0) + delta;
    if ((center.capacity || 0) > 0 && next > center.capacity) overCapacity.push(center.name);
    await supabase
      .from('exam_centers')
      .update({ allocated: next, updated_at: new Date().toISOString() })
      .eq('id', centerId);
  }

  return {
    created,
    existing: existingCount,
    noRoll,
    noCenters: rows.length > 0 && sortedCenters.length === 0,
    overCapacity,
    fallbackToFirst,
  };
}

export function useGenerateAdmitCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateAdmitCards,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admit_cards'] });
      qc.invalidateQueries({ queryKey: ['exam_centers'] });
    },
  });
}
