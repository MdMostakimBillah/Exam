"use server";

import { createClient } from "@/lib/supabase/server";

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

// Simple in-memory store for student login attempts (resets on server restart)
// In production, use Redis or database
const studentAttempts = new Map<string, { count: number; lastAttempt: number }>();

function checkStudentLockout(identifier: string): { locked: boolean; retryAfter: number } {
  const record = studentAttempts.get(identifier);
  if (!record) return { locked: false, retryAfter: 0 };

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Reset if last attempt was more than 5 minutes ago
  if (now - record.lastAttempt > fiveMinutes) {
    studentAttempts.delete(identifier);
    return { locked: false, retryAfter: 0 };
  }

  if (record.count >= 3) {
    const remaining = Math.ceil((fiveMinutes - (now - record.lastAttempt)) / 1000);
    return { locked: true, retryAfter: remaining };
  }

  return { locked: false, retryAfter: 0 };
}

function recordStudentAttempt(identifier: string, success: boolean) {
  if (success) {
    studentAttempts.delete(identifier);
    return;
  }

  const record = studentAttempts.get(identifier);
  const now = Date.now();

  if (!record || now - record.lastAttempt > 5 * 60 * 1000) {
    studentAttempts.set(identifier, { count: 1, lastAttempt: now });
  } else {
    record.count += 1;
    record.lastAttempt = now;
  }
}

export async function loginStudent(
  studentId: string,
  phoneOrEmail: string
): Promise<StudentLoginResult> {
  const supabase = await createClient();
  const identifier = `student:${studentId.toLowerCase()}`;

  // Check lockout
  const lockStatus = checkStudentLockout(identifier);
  if (lockStatus.locked) {
    return {
      success: false,
      error: "Account temporarily locked. Try again in 5 minutes.",
      locked: true,
      retryAfter: lockStatus.retryAfter,
    };
  }

  // Find student by student_id
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
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

    // Check if this attempt caused lockout
    const lockStatusAfter = checkStudentLockout(identifier);
    return {
      success: false,
      error: "Invalid student ID or credentials",
      locked: lockStatusAfter.locked,
      retryAfter: lockStatusAfter.retryAfter,
    };
  }

  // Get institution name
  const { data: institution } = await supabase
    .from("institutions")
    .select("name")
    .eq("id", student.institution_id)
    .single();

  // Success
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
      institutionName: institution?.name || "",
      class: student.class,
      section: student.section || "",
      roll: student.roll || "",
      photo: student.photo_url,
    },
  };
}

export async function getStudentSession(): Promise<StudentSession | null> {
  // Server-side: read from headers or cookie
  // Client-side: read from localStorage
  if (typeof window === "undefined") {
    // Server-side: would need cookie-based session
    // For now, client-side auth via localStorage
    return null;
  }

  try {
    const stored = localStorage.getItem("scholarx_student_session");
    if (!stored) return null;
    return JSON.parse(stored) as StudentSession;
  } catch {
    return null;
  }
}

export async function setStudentSession(student: StudentSession): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.setItem("scholarx_student_session", JSON.stringify(student));
}

export async function clearStudentSession(): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem("scholarx_student_session");
}

export async function isStudentAuthenticated(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("scholarx_student_session");
}
