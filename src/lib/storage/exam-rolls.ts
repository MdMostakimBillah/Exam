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

interface StudentRollRow {
  id: string;
  gender?: string | null;
  exam_roll?: string | null;
  created_at?: string | null;
}

/**
 * Client-side roll assignment fallback in case the database RPC
 * has not yet been updated with the migration.
 */
async function generateExamRollsClient(
  sessionId: string,
  className: string,
  cleanGender?: string
): Promise<GenerateRollsResult> {
  const supabase = createClient();

  let prefix = getRollPrefix(className);
  if (!prefix) {
    const { data: clsRow } = await supabase
      .from('classes')
      .select('code')
      .ilike('name', className.trim())
      .limit(1)
      .maybeSingle();
    if (clsRow?.code) {
      prefix = getRollPrefix(className, clsRow.code);
    }
  }

  if (!prefix) {
    throw new Error(`Cannot determine roll prefix for "${className}"`);
  }

  // Fetch all students of this session and class
  const { data: rawStudents, error: stuError } = await supabase
    .from(STUDENTS_TABLE)
    .select('id, gender, exam_roll, created_at')
    .eq('session_id', sessionId)
    .eq('class', className);

  if (stuError || !rawStudents) {
    throw new Error(stuError?.message || 'Failed to fetch students');
  }

  const classStudents = rawStudents as StudentRollRow[];

  // Calculate current max sequence across ALL students of this class/prefix in this session
  let maxSeq = 0;
  for (const s of classStudents) {
    if (s.exam_roll && s.exam_roll.startsWith(prefix)) {
      const seq = parseInt(s.exam_roll.slice(2), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  // Target students matching gender filter
  const targetStudents = classStudents.filter((s: StudentRollRow) => {
    if (!cleanGender) return true;
    return s.gender && s.gender.toUpperCase() === cleanGender;
  });

  const total = targetStudents.length;
  const already = targetStudents.filter((s: StudentRollRow) => !!s.exam_roll).length;

  if (total === 0) {
    throw new Error(cleanGender
      ? `No ${cleanGender} students found for "${className}" in this session`
      : `No students found for "${className}" in this session`);
  }

  // Pending students who need a roll
  const pending = targetStudents.filter((s: StudentRollRow) => !s.exam_roll);
  if (pending.length === 0) {
    return {
      assigned: 0,
      already,
      total,
      prefix,
      start: null,
      end: null,
    };
  }

  // Fetch registrations for pending students to determine registration order
  const pendingIds = pending.map((p: StudentRollRow) => p.id);
  const { data: regRows } = await supabase
    .from('registrations')
    .select('student_id, created_at')
    .eq('session_id', sessionId)
    .in('student_id', pendingIds);

  const firstRegMap = new Map<string, number>();
  for (const r of (regRows || []) as { student_id?: string; created_at?: string }[]) {
    if (!r.student_id) continue;
    const time = new Date(r.created_at || 0).getTime();
    const existing = firstRegMap.get(r.student_id);
    if (existing === undefined || time < existing) {
      firstRegMap.set(r.student_id, time);
    }
  }

  // Sort pending students: registered first (by earliest registration), then by created_at
  pending.sort((a: StudentRollRow, b: StudentRollRow) => {
    const ta = firstRegMap.get(a.id);
    const tb = firstRegMap.get(b.id);
    if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb;
    if (ta !== undefined && tb === undefined) return -1;
    if (ta === undefined && tb !== undefined) return 1;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  // Assign rolls sequentially starting from maxSeq + 1
  let assigned = 0;
  let startRoll: string | null = null;
  let endRoll: string | null = null;

  for (const s of pending) {
    const seq = maxSeq + 1;
    if (seq > 9999) {
      throw new Error(`Roll numbers exhausted for prefix ${prefix} (9999 max per class)`);
    }
    const rollStr = `${prefix}${String(seq).padStart(4, '0')}`;
    if (assigned === 0) startRoll = rollStr;
    endRoll = rollStr;
    maxSeq = seq;
    assigned++;

    const { error: updateError } = await supabase
      .from(STUDENTS_TABLE)
      .update({ exam_roll: rollStr, updated_at: new Date().toISOString() })
      .eq('id', s.id);

    if (updateError) {
      throw new Error(`Failed to assign roll to student: ${updateError.message}`);
    }
  }

  return {
    assigned,
    already,
    total,
    prefix,
    start: startRoll,
    end: endRoll,
  };
}

/**
 * Assigns exam roll numbers to every student of the class (or gender within the class)
 * that doesn't have one yet. Assigns in REGISTRATION order — the earliest-registered
 * student gets the first (lowest) number, continuing sequentially after any previously
 * generated rolls for this class.
 */
export async function generateExamRolls(
  sessionId: string,
  className: string,
  gender?: string
): Promise<GenerateRollsResult> {
  const supabase = createClient();
  const cleanGender = gender && gender.trim() !== '' && gender.toUpperCase() !== 'ALL'
    ? gender.trim().toUpperCase()
    : undefined;

  // 1. Try RPC first
  try {
    const rpcParams: Record<string, any> = {
      p_session_id: sessionId,
      p_class: className,
    };
    if (cleanGender) {
      rpcParams.p_gender = cleanGender;
    }
    const { data, error } = await supabase.rpc('generate_class_exam_rolls', rpcParams);
    if (!error && data) {
      return data as GenerateRollsResult;
    }
    // If error was parameter mismatch because migration 0041 is not run yet,
    // and gender was NOT specified, try the legacy 2-parameter RPC
    if (error && !cleanGender) {
      const retry = await supabase.rpc('generate_class_exam_rolls', {
        p_session_id: sessionId,
        p_class: className,
      });
      if (!retry.error && retry.data) {
        return retry.data as GenerateRollsResult;
      }
    }
  } catch (err) {
    console.warn('generate_class_exam_rolls RPC failed, falling back to client-side roll assignment:', err);
  }

  // 2. Client-side fallback if RPC is not available or doesn't support p_gender
  return generateExamRollsClient(sessionId, className, cleanGender);
}

export function useGenerateExamRolls() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, className, gender }: { sessionId: string; className: string; gender?: string }) =>
      generateExamRolls(sessionId, className, gender),
    onSuccess: () => {
      // Covers by-class lists, class summaries, the students page and the
      // dashboard stats so every surface shows the new rolls immediately.
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}
