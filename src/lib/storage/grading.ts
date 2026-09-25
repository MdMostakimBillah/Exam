import { GradingScale } from '../types';
import { getSystemSetting, setSystemSetting } from './system-settings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const GRADING_SETTING_KEY = 'grading';

export const DEFAULT_SCALE: GradingScale = {
  bands: [
    { min: 80, grade: 'A+' },
    { min: 70, grade: 'A' },
    { min: 60, grade: 'A-' },
    { min: 50, grade: 'B' },
    { min: 40, grade: 'C' },
    { min: 33, grade: 'D' },
  ],
  passPercent: 33,
  scholarshipPercent: 60,
};

function parseScale(value: string | null): GradingScale {
  if (!value) return DEFAULT_SCALE;
  try {
    const parsed = JSON.parse(value) as GradingScale;
    if (Array.isArray(parsed?.bands) && typeof parsed?.passPercent === 'number') return parsed;
  } catch { /* ignore */ }
  return DEFAULT_SCALE;
}

export async function fetchGradingScale(): Promise<GradingScale> {
  const setting = await getSystemSetting(GRADING_SETTING_KEY);
  return parseScale(setting?.value ?? null);
}

export async function saveGradingScale(scale: GradingScale): Promise<GradingScale> {
  await setSystemSetting(GRADING_SETTING_KEY, JSON.stringify(scale), 'grading');
  return scale;
}

export function calculateGrade(percentage: number, scale: GradingScale = DEFAULT_SCALE): string {
  const matched = scale.bands
    .filter((b) => percentage >= b.min)
    .sort((a, b) => b.min - a.min)[0];
  return matched?.grade ?? 'F';
}

export function isPass(percentage: number, scale: GradingScale = DEFAULT_SCALE): boolean {
  return percentage >= scale.passPercent;
}

export function isScholarship(percentage: number, scale: GradingScale = DEFAULT_SCALE): boolean {
  return percentage >= scale.scholarshipPercent;
}

export function useGradingScale() {
  return useQuery<GradingScale>({
    queryKey: ['grading'],
    queryFn: fetchGradingScale,
    staleTime: 60 * 1000,
  });
}

export function useSaveGradingScale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scale: GradingScale) => saveGradingScale(scale),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grading'] });
    },
  });
}
