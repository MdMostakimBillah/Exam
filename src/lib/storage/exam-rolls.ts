import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const STUDENTS_TABLE = 'students';

export interface ClassRollSummary {
  className: string;
  total: number;
  rolled: number;
}

export interface GenerateRollsResult {
  assigned: number;
  already: number;
  total: number;
  prefix: string;
  start: string | null;
  end: string | null;
}

const EN_WORD_NUM: Record<string, number> = {
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3,
  four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6,
  seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9,
  ten: 10, tenth: 10,
};
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const BN_WORD_NUM: [string, number][] = [
  ['এক', 1], ['দুই', 2], ['তিন', 3], ['চার', 4],
  ['পঞ্চম', 5], ['পাঁচ', 5], ['ছয়', 6], ['সাত', 7],
  ['আট', 8], ['নয়', 9], ['দশ', 10],
];

/**
 * Class label -> class NUMBER (1-10). Class names are free-form — values
 * like '5', 'Class 5', 'Five', 'Fifth', 'শ্রেণী ৫' all exist in real data.
 * Order: digits (incl. Bangla) -> English words -> Bangla words -> class code.
 * Must mirror the resolution inside generate_class_exam_rolls() in SQL.
 */
export function getClassNumber(className: string, classCode?: string): number | null {
  if (!className) return null;
  const ascii = className.replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d)));
  const digits = ascii.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  const word = ascii.toLowerCase().match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/
  );
  if (word) return EN_WORD_NUM[word[1]];
  for (const [w, n] of BN_WORD_NUM) {
    if (className.includes(w)) return n;
  }
  if (classCode) {
    const codeDigits = classCode.match(/\d+/);
    if (codeDigits) return parseInt(codeDigits[0], 10);
  }
  return null;
}

/**
 * Class number -> 2-digit roll prefix:
 *   Class 1 -> '11', Class 2 -> '22', ... Class 9 -> '99', Class 10 -> '10'.
 * Returns null when no class number (1-10) can be determined.
 */
export function getRollPrefix(className: string, classCode?: string): string | null {
  const n = getClassNumber(className, classCode);
  if (n !== null && n >= 1 && n <= 9) return `${n}${n}`;
  if (n === 10) return '10';
  return null;
}

function classSortKey(className: string): number {
  return getClassNumber(className) ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Per-class student counts for the viewed session, straight from the
 * students table: how many students the class has and how many already
 * have an exam roll. Drives the class dropdown and the stats cards.
 */
export async function fetchClassRollSummaries(sessionId?: string): Promise<ClassRollSummary[]> {
  if (!sessionId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from(STUDENTS_TABLE)
    .select('class, exam_roll')
    .eq('session_id', sessionId);
  if (error) throw error;
  const map = new Map<string, ClassRollSummary>();
  for (const row of data || []) {
    const cls = row.class;
    if (!cls) continue;
    const summary = map.get(cls) || { className: cls, total: 0, rolled: 0 };
    summary.total += 1;
    if (row.exam_roll) summary.rolled += 1;
    map.set(cls, summary);
  }
  return [...map.values()].sort(
    (a, b) => classSortKey(a.className) - classSortKey(b.className) || a.className.localeCompare(b.className)
  );
}

export function useClassRollSummaries(sessionId?: string) {
  return useQuery({
    queryKey: ['students', 'class-summaries', sessionId],
    queryFn: () => fetchClassRollSummaries(sessionId),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Assigns exam roll numbers to every student of the class that doesn't
 * have one yet. The database function assigns in REGISTRATION order —
 * the earliest-registered student gets the first (lowest) number.
 */
export async function generateExamRolls(sessionId: string, className: string): Promise<GenerateRollsResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('generate_class_exam_rolls', {
    p_session_id: sessionId,
    p_class: className,
  });
  if (error) throw error;
  return data as GenerateRollsResult;
}

export function useGenerateExamRolls() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, className }: { sessionId: string; className: string }) =>
      generateExamRolls(sessionId, className),
    onSuccess: () => {
      // Covers by-class lists, class summaries, the students page and the
      // dashboard stats so every surface shows the new rolls immediately.
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}
