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

// In-memory lockout tracking (resets on server restart - acceptable for now)
const studentAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkStudentLockout(identifier: string): { locked: boolean; retryAfter: number } {
  const record = studentAttempts.get(identifier);
  if (!record) return { locked: false, retryAfter: 0 };
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (now - record.lastAttempt > fiveMinutes) { studentAttempts.delete(identifier); return { locked: false, retryAfter: 0 }; }
  if (record.count >= 3) { return { locked: true, retryAfter: Math.ceil((fiveMinutes - (now - record.lastAttempt)) / 1000) }; }
  return { locked: false, retryAfter: 0 };
}

function recordStudentAttempt(identifier: string, success: boolean) {
  if (success) { studentAttempts.delete(identifier); return; }
  const record = studentAttempts.get(identifier);
  const now = Date.now();
  if (!record || now - record.lastAttempt > 5 * 60 * 1000) { studentAttempts.set(identifier, { count: 1, lastAttempt: now }); }
  else { record.count += 1; record.lastAttempt = now; }
}

export async function loginStudent(studentId: string, phoneOrEmail: string): Promise<StudentLoginResult> {
  const supabase = createClient();
  const identifier = `student:${studentId.toLowerCase()}`;

  const lockStatus = checkStudentLockout(identifier);
  if (lockStatus.locked) {
    return { success: false, error: "Account temporarily locked.", locked: true, retryAfter: lockStatus.retryAfter };
  }

  // Find student by student_id
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*, institutions(name)")
    .eq("student_id", studentId)
    .single();

  if (studentError || !student) {
    recordStudentAttempt(identifier, false);
    return { success: false, error: "Invalid student ID or credentials" };
  }

  // Verify phone or email matches
  const inputLower = phoneOrEmail.toLowerCase().trim();
  const phoneMatch = student.phone?.toLowerCase() === inputLower;
  const emailMatch = student.email?.toLowerCase() === inputLower;

  if (!phoneMatch && !emailMatch) {
    recordStudentAttempt(identifier, false);
    const lockStatusAfter = checkStudentLockout(identifier);
    return { success: false, error: "Invalid student ID or credentials", locked: lockStatusAfter.locked, retryAfter: lockStatusAfter.locked ? lockStatusAfter.retryAfter : 0 };
  }

  // Create or sign in with Supabase Auth
  const authEmail = `student_${studentId}@scholarx.local`;
  const authPassword = `student_${studentId}_${phoneOrEmail}`;

  // Try to sign in first
  let { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });

  // If sign in fails, create the auth user
  if (signInError) {
    const { error: signUpError } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { role: "student", student_id: studentId } } });
    if (signUpError && !signUpError.message.includes("already registered")) {
      recordStudentAttempt(identifier, false);
      return { success: false, error: "Authentication failed" };
    }
    // Try sign in again
    await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
  }

  // Link student to auth user
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("students").update({ user_id: user.id }).eq("id", student.id);
  }

  recordStudentAttempt(identifier, true);

  return {
    success: true,
    student: {
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
    },
  };
}

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
