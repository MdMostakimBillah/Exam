"use client";

import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface StudentSession {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  institutionId: string;
  institutionName: string;
  /** Institution's English name (name_en) — used when the UI is English. */
  institutionNameEn?: string;
  class: string;
  section: string;
  roll: string;
  photo?: string;
  /** Super admin granted this institution's students the Marksheet section. */
  allowMarksheetDownload: boolean;
  /** Super admin granted this institution's students the Certificates section. */
  allowCertificateDownload: boolean;
}

export interface StudentLoginResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  retryAfter?: number;
  student?: StudentSession;
}

// NOTE: loginStudent() moved to ./student-login (a server action). The old
// client-side implementation kept its lockout in this module-level Map,
// which reset on every page load and was trivially bypassed, and it wrote a
// predictable Supabase Auth password (`student_<id>_<phoneOrEmail>`).

export async function getStudentSession(): Promise<StudentSession | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: student, error: studentError } = await supabase
    .from("students")
    .select("*, institutions(name,name_en,allow_marksheet_download,allow_certificate_download)")
    .eq("user_id", user.id)
    .single();

  if (studentError) {
    // 0038 not applied yet: PostgREST rejects the whole select for an
    // unknown column — retry without the two flags (they read as off).
    ({ data: student } = await supabase
      .from("students")
      .select("*, institutions(name,name_en)")
      .eq("user_id", user.id)
      .single());
  }

  if (!student) return null;

  return {
    id: student.id,
    studentId: student.student_id,
    firstName: student.first_name,
    lastName: student.last_name,
    email: student.email || "",
    phone: student.phone || "",
    institutionId: student.institution_id,
    institutionName: student.institutions?.name || "",
    institutionNameEn: student.institutions?.name_en || "",
    class: student.class,
    section: student.section || "",
    roll: student.roll || "",
    photo: student.photo_url,
    allowMarksheetDownload: !!student.institutions?.allow_marksheet_download,
    allowCertificateDownload: !!student.institutions?.allow_certificate_download,
  };
}

export async function clearStudentSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function isStudentAuthenticated(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export function useStudentSession() {
  return useQuery({
    queryKey: ['studentSession'],
    queryFn: getStudentSession,
    staleTime: 5 * 60 * 1000,
  });
}
