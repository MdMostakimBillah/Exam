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
  class: string;
  section: string;
  roll: string;
  photo?: string;
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

  const { data: student } = await supabase
    .from("students")
    .select("*, institutions(name)")
    .eq("user_id", user.id)
    .single();

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
    class: student.class,
    section: student.section || "",
    roll: student.roll || "",
    photo: student.photo_url,
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
