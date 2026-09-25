"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { Result, Certificate } from "@/lib/types";

/**
 * Anonymous lookups for the public /result and /verify-certificate pages.
 *
 * These replace the old "download 20 rows and filter in the browser"
 * approach, which needed `Public read ... USING (true)` on the results and
 * certificates tables — i.e. anyone could page through the whole dataset.
 * Here the database does a single exact-match lookup and returns at most
 * one row, and the whole endpoint is rate limited per client IP.
 *
 * SERVICE ROLE: safe only because every query below is an exact-match on a
 * caller-supplied key with a hard LIMIT — never a table scan the caller can
 * steer into a dump.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESULT_COLUMNS =
  "id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,subject_marks,created_at,updated_at";

const CERTIFICATE_COLUMNS =
  "id,session_id,certificate_number,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,position,total_marks,exam_year,issue_date,result_id,qr_code,status,created_at,updated_at";

/** Keys must be short and free of PostgREST operators (?, , " ( ) : not). */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9 _\-/:.]{2,39}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ROLL = /^\d{1,6}$/;

/** Per-client-IP budget. Pruned on every call so the map cannot grow without bound. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const buckets = new Map<string, { count: number; reset: number }>();

function allow(key: string): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

async function clientKey(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return (forwarded ? forwarded.split(",")[0].trim() : null) || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

function mapResult(data: Record<string, unknown>): Result {
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    studentId: data.student_id as string,
    studentName: data.student_name as string,
    institutionId: data.institution_id as string,
    institutionName: data.institution_name as string,
    examId: data.exam_id as string,
    examName: data.exam_name as string,
    className: data.class_name as string,
    roll: data.roll as string,
    registrationNumber: data.registration_number as string,
    subjectMarks: (data.subject_marks as Result["subjectMarks"]) || [],
    totalMarks: Number(data.total_marks ?? 0),
    totalFullMarks: Number(data.total_full_marks ?? 0),
    percentage: Number(data.percentage ?? 0),
    grade: (data.grade as string) ?? "",
    position: Number(data.position ?? 0),
    pass: Boolean(data.pass),
    scholarshipStatus: (data.scholarship_status as Result["scholarshipStatus"]) ?? "NONE",
    status: (data.status as Result["status"]) ?? "PUBLISHED",
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function mapCertificate(data: Record<string, unknown>): Certificate {
  return {
    id: data.id as string,
    sessionId: data.session_id as string,
    certificateNumber: data.certificate_number as string,
    studentId: data.student_id as string,
    studentName: data.student_name as string,
    institutionId: data.institution_id as string,
    institutionName: data.institution_name as string,
    examId: data.exam_id as string,
    examName: data.exam_name as string,
    className: data.class_name as string,
    position: Number(data.position ?? 0),
    totalMarks: Number(data.total_marks ?? 0),
    examYear: (data.exam_year as Certificate["examYear"]) ?? 0,
    issueDate: data.issue_date as string,
    resultId: data.result_id as string,
    qrCode: data.qr_code as string,
    status: (data.status as Certificate["status"]) ?? "ACTIVE",
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export interface PublicResultLookup {
  ok: boolean;
  error?: string;
  result?: Result | null;
}

export async function searchPublicResults(input: {
  registrationNumber: string;
  mode: "dob" | "roll";
  dob?: string;
  roll?: string;
}): Promise<PublicResultLookup> {
  const ip = await clientKey();
  if (!allow(ip)) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  }

  const reg = String(input.registrationNumber || "").trim();
  if (!SAFE_KEY.test(reg)) {
    return { ok: false, error: "Please enter a valid registration number." };
  }

  const mode = input.mode === "roll" ? "roll" : "dob";
  const dob = String(input.dob || "");
  const roll = String(input.roll || "").trim();

  if (mode === "dob") {
    if (!SAFE_DATE.test(dob)) return { ok: false, error: "Please enter a valid date of birth." };
    const parsed = new Date(dob);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dob) {
      return { ok: false, error: "Please enter a valid date of birth." };
    }
  } else if (!SAFE_ROLL.test(roll)) {
    return { ok: false, error: "Please enter a valid roll number." };
  }

  try {
    let rows: Record<string, unknown>[] = [];

    const exact = await supabaseAdmin
      .from("results")
      .select(RESULT_COLUMNS)
      .eq("registration_number", reg)
      .limit(10);
    rows = (exact.data as Record<string, unknown>[]) || [];

    if (rows.length === 0) {
      // Case-insensitive fallback (never a wildcard: escape LIKE metachars).
      const escaped = reg.replace(/[\\%_]/g, (m) => `\\${m}`);
      const loose = await supabaseAdmin
        .from("results")
        .select(RESULT_COLUMNS)
        .ilike("registration_number", escaped)
        .limit(10);
      rows = (loose.data as Record<string, unknown>[]) || [];
    }

    if (rows.length === 0) return { ok: true, result: null };

    if (mode === "roll") {
      const match = rows.find((r) => String(r.roll ?? "") === roll);
      return { ok: true, result: match ? mapResult(match) : null };
    }

    const studentIds = rows.map((r) => r.student_id).filter(Boolean);
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id,date_of_birth")
      .in("id", studentIds as string[]);
    const dobById = new Map(
      (students || []).map((s) => [s.id, s.date_of_birth ? String(s.date_of_birth).slice(0, 10) : ""])
    );
    const match = rows.find((r) => dobById.get(r.student_id as string) === dob);
    return { ok: true, result: match ? mapResult(match) : null };
  } catch {
    return { ok: false, error: "Lookup failed. Please try again." };
  }
}

export interface PublicCertificateLookup {
  ok: boolean;
  error?: string;
  certificate?: Certificate | null;
}

export async function lookupCertificate(
  certificateNumber: string
): Promise<PublicCertificateLookup> {
  const ip = await clientKey();
  if (!allow(ip)) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  }

  const key = String(certificateNumber || "").trim();
  if (!SAFE_KEY.test(key)) {
    return { ok: false, error: "Please enter a valid certificate number." };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("certificates")
      .select(CERTIFICATE_COLUMNS)
      .eq("certificate_number", key)
      .limit(1);
    if (error) return { ok: false, error: "Lookup failed. Please try again." };
    const row = (data || [])[0] as Record<string, unknown> | undefined;
    return { ok: true, certificate: row ? mapCertificate(row) : null };
  } catch {
    return { ok: false, error: "Lookup failed. Please try again." };
  }
}
