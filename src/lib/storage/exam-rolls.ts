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

/**
 * Class number -> 2-digit roll prefix:
 *   Class 1 -> '11', Class 2 -> '22', ... Class 9 -> '99', Class 10 -> '10'.
 * Returns null when the label contains no supported class number (1-10).
 */
export function getRollPrefix(className: string): string | null {
  const m = className.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (n >= 1 && n <= 9) return `${n}${n}`;
  if (n === 10) return '10';
  return null;
}

function classSortKey(className: string): number {
  const m = className.match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
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
