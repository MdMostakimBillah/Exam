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
  "id,session_id,student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name,roll,registration_number,total_marks,total_full_marks,percentage,grade,position,pass,scholarship_status,status,mark_setup_version,marksheet_generated_at,subject_marks,created_at,updated_at";

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
    scholarshipStatus: (data.scholarship_status as Result["scholarshipStatus"]) ?? "PENDING",
    status: (data.status as Result["status"]) ?? "PUBLISHED",
    markSetupVersion: data.mark_setup_version === null || data.mark_setup_version === undefined
      ? null
      : Number(data.mark_setup_version),
    marksheetGeneratedAt: data.marksheet_generated_at ? String(data.marksheet_generated_at) : null,
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

/**
 * The institution's English name for a stored Bangla `institution_name`.
 * Public pages (result / certificate verification) are English-first, so we
 * resolve `name_en` here once per lookup instead of shipping it on every row.
 * Never throws — the field is optional and only used as a display fallback.
 */
async function resolveInstitutionNameEn(id: unknown): Promise<string> {
  if (!id) return "";
  try {
    const { data } = await supabaseAdmin
      .from("institutions")
      .select("name_en")
      .eq("id", String(id))
      .maybeSingle();
    return String((data as { name_en?: string } | null)?.name_en || "");
  } catch {
    return "";
  }
}

/** mapResult + the English institution name. */
async function resultWithEn(row: Record<string, unknown>): Promise<Result> {
  const mapped = mapResult(row);
  mapped.institutionNameEn = await resolveInstitutionNameEn(row.institution_id);
  return mapped;
}

/** mapCertificate + the English institution name. */
async function certificateWithEn(row: Record<string, unknown>): Promise<Certificate> {
  const mapped = mapCertificate(row);
  mapped.institutionNameEn = await resolveInstitutionNameEn(row.institution_id);
  return mapped;
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
      .eq("status", "PUBLISHED")
      .eq("registration_number", reg)
      .limit(10);
    rows = (exact.data as Record<string, unknown>[]) || [];

    if (rows.length === 0) {
      // Case-insensitive fallback (never a wildcard: escape LIKE metachars).
      const escaped = reg.replace(/[\\%_]/g, (m) => `\\${m}`);
      const loose = await supabaseAdmin
        .from("results")
        .select(RESULT_COLUMNS)
        .eq("status", "PUBLISHED")
        .ilike("registration_number", escaped)
        .limit(10);
      rows = (loose.data as Record<string, unknown>[]) || [];
    }

    if (rows.length === 0) return { ok: true, result: null };

    if (mode === "roll") {
      const match = rows.find((r) => String(r.roll ?? "") === roll);
      return { ok: true, result: match ? await resultWithEn(match) : null };
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
    return { ok: true, result: match ? await resultWithEn(match) : null };
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
    return { ok: true, certificate: row ? await certificateWithEn(row) : null };
  } catch {
    return { ok: false, error: "Lookup failed. Please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* Public marksheet lookup (/marksheet)                                */
/* ------------------------------------------------------------------ */

/**
 * Everything the A4 transcript needs that the result row does not carry.
 * `generatedAt` is the super admin's generation moment (0040) and is printed
 * as the date of publication of results.
 */
export interface MarksheetData {
  result: Result;
  fatherName: string;
  motherName: string;
  photoUrl: string;
  sessionName: string;
  examDate: string | null;
  generatedAt: string;
  /** Exam grade bands — letter + point per subject; defaults if unset. */
  gradeBands: { id: string; grade: string; points: number; minPercent: number; maxPercent: number }[];
  passPercent: number;
  /** Scholarship ranges, so the sheet can print the qualifying % next to the name. */
  scholarshipCategories: { name: string; minPercent: number; maxPercent: number }[];
}

export interface MarksheetLookup {
  ok: boolean;
  error?: string;
  /** null = nothing matches roll + registration + date of birth. */
  marksheet?: MarksheetData | null;
  /** Identity proved, but the super admin has not generated the marksheet yet. */
  notGenerated?: boolean;
}

/** Mirrors DEFAULT_GRADE_BANDS in storage/mark-setup.ts (kept literal so this
 *  server file never imports the client-side supabase module). */
const FALLBACK_BANDS = [
  { id: "grade_a_plus", grade: "A+", points: 5, minPercent: 80, maxPercent: 100 },
  { id: "grade_a", grade: "A", points: 4, minPercent: 70, maxPercent: 79.99 },
  { id: "grade_a_minus", grade: "A-", points: 3.5, minPercent: 60, maxPercent: 69.99 },
  { id: "grade_b", grade: "B", points: 3, minPercent: 50, maxPercent: 59.99 },
  { id: "grade_c", grade: "C", points: 2, minPercent: 40, maxPercent: 49.99 },
  { id: "grade_d", grade: "D", points: 1, minPercent: 33, maxPercent: 39.99 },
  { id: "grade_f", grade: "F", points: 0, minPercent: 0, maxPercent: 32.99 },
];

/** Mirrors DEFAULT_SCHOLARSHIP_CATEGORIES in storage/mark-setup.ts. */
const FALLBACK_SCHOLARSHIPS = [
  { name: "TALENT_POOL", minPercent: 90, maxPercent: 100 },
  { name: "GENERAL", minPercent: 80, maxPercent: 89.99 },
];

/**
 * Roll + registration number + date of birth → the student's transcript.
 *
 * All three are required: the registration number finds the row, the roll
 * narrows it (student ids repeat across classes) and the date of birth is
 * the ownership proof, exactly like /result. The transcript is returned only
 * when the super admin has generated it — a proved caller who is too early
 * gets `notGenerated` instead of a bare "not found", since they already
 * demonstrated they own the record.
 */
export async function lookupPublicMarksheet(input: {
  registrationNumber: string;
  roll: string;
  dob: string;
}): Promise<MarksheetLookup> {
  const ip = await clientKey();
  if (!allow(ip)) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  }

  const reg = String(input.registrationNumber || "").trim();
  const roll = String(input.roll || "").trim();
  const dob = String(input.dob || "").trim();

  if (!SAFE_KEY.test(reg)) return { ok: false, error: "Please enter a valid registration number." };
  if (!SAFE_ROLL.test(roll)) return { ok: false, error: "Please enter a valid roll number." };
  if (!SAFE_DATE.test(dob)) return { ok: false, error: "Please enter a valid date of birth." };
  const parsedDob = new Date(dob);
  if (Number.isNaN(parsedDob.getTime()) || parsedDob.toISOString().slice(0, 10) !== dob) {
    return { ok: false, error: "Please enter a valid date of birth." };
  }

  try {
    const selectRows = () =>
      supabaseAdmin
        .from("results")
        .select(RESULT_COLUMNS)
        .eq("status", "PUBLISHED")
        .eq("registration_number", reg)
        .limit(10);

    const { data } = await selectRows();
    let rows = (data as Record<string, unknown>[]) || [];

    if (rows.length === 0) {
      const escaped = reg.replace(/[\\%_]/g, (m) => `\\${m}`);
      const loose = await supabaseAdmin
        .from("results")
        .select(RESULT_COLUMNS)
        .eq("status", "PUBLISHED")
        .ilike("registration_number", escaped)
        .limit(10);
      rows = (loose.data as Record<string, unknown>[]) || [];
    }

    const byRoll = rows.find((r) => String(r.roll ?? "") === roll);
    if (!byRoll) return { ok: true, marksheet: null };

    // Ownership proof: the entered DOB must be the student's.
    const studentRes = await supabaseAdmin
      .from("students")
      .select("id,date_of_birth,father_name,mother_name,photo_url")
      .eq("id", String(byRoll.student_id))
      .limit(1);
    const student = (studentRes.data as Record<string, unknown>[] | null)?.[0];
    const studentDob = student?.date_of_birth ? String(student.date_of_birth).slice(0, 10) : "";
    if (!student || studentDob !== dob) return { ok: true, marksheet: null };

    const generatedAt = byRoll.marksheet_generated_at ? String(byRoll.marksheet_generated_at) : "";
    if (!generatedAt) return { ok: true, marksheet: null, notGenerated: true };

    const result = await resultWithEn(byRoll);

    const [examRes, sessionRes, configRes] = await Promise.all([
      supabaseAdmin.from("exams").select("exam_date").eq("id", result.examId).limit(1),
      supabaseAdmin.from("academic_sessions").select("name").eq("id", result.sessionId).limit(1),
      supabaseAdmin
        .from("exam_mark_configs")
        .select("grade_bands,scholarship_categories,pass_percent")
        .eq("exam_id", result.examId)
        .limit(1),
    ]);

    const exam = (examRes.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const session = (sessionRes.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const config = (configRes.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const bands = Array.isArray(config?.grade_bands) && config.grade_bands.length
      ? (config.grade_bands as MarksheetData["gradeBands"])
      : FALLBACK_BANDS;

    return {
      ok: true,
      marksheet: {
        result,
        fatherName: String(student.father_name || ""),
        motherName: String(student.mother_name || ""),
        photoUrl: String(student.photo_url || ""),
        sessionName: String(session?.name || ""),
        examDate: exam?.exam_date ? String(exam.exam_date) : null,
        generatedAt,
        gradeBands: bands,
        passPercent: Number(config?.pass_percent ?? 33),
        scholarshipCategories: Array.isArray(config?.scholarship_categories)
          ? (config.scholarship_categories as MarksheetData["scholarshipCategories"])
          : FALLBACK_SCHOLARSHIPS,
      },
    };
  } catch {
    return { ok: false, error: "Lookup failed. Please try again." };
  }
}
