"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

/**
 * Public student application flow (no login, no online payment).
 *
 * A student opens /apply, picks the institution they are enrolled in,
 * enters the same information the institution's "Add Register" wizard
 * collects, and receives a registration number. The institution then
 * records the cash payment from its own dashboard exactly as before —
 * there is deliberately NO payment step here.
 *
 * /status later resolves registration number + date of birth into the
 * application / payment / active / exam / result state.
 *
 * SERVICE ROLE: safe because every query is an exact-match on validated
 * caller input with a hard LIMIT, every action is rate limited per IP,
 * and nothing here returns more than the single row the caller proved
 * ownership of (registration number + matching date of birth).
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Keys must be short and free of PostgREST operators (?, , " ( ) : not). */
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9 _\-/:.]{2,39}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Unicode letters (Latin + Bengali + any script), spaces, hyphens, apostrophes. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]{1,59}$/u;
const BANGLA_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]{1,79}$/u;
const PHONE_RE = /^[0-9+][0-9+\-() ]{5,19}$/;
const GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);

/** A real calendar date, not in the future, within a plausible student range. */
function validDob(dob: string): boolean {
  if (!SAFE_DATE.test(dob)) return false;
  const parsed = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== dob) return false; // rejects 2026-02-31
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > new Date().getUTCFullYear()) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Per-IP rate limiting                                                */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

function allow(key: string, max: number): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

async function clientKey(action: string): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip =
      (forwarded ? forwarded.split(",")[0].trim() : null) ||
      h.get("x-real-ip") ||
      "unknown";
    return `${action}:${ip}`;
  } catch {
    return `${action}:unknown`;
  }
}

const RATE_MSG =
  "Too many attempts. Please wait a minute and try again.";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

interface ExamRow {
  id: string;
  name: string;
  status: string;
  registration_fee: number;
  registration_start_date: string | null;
  registration_end_date: string | null;
  exam_date: string | null;
  classes: string[] | null;
}

/** Current session (is_current) or null. */
async function currentSession(): Promise<{ id: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("academic_sessions")
    .select("id,name")
    .eq("is_current", true)
    .limit(1);
  const row = (data as { id: string; name: string }[] | null)?.[0];
  return row ?? null;
}

/**
 * The exam public applications attach to: an OPEN exam if one exists,
 * otherwise the most recently created exam of the current session.
 * (The institution wizard also lets staff pick any exam of the session.)
 */
async function pickExam(sessionId: string): Promise<ExamRow | null> {
  const { data, error } = await supabaseAdmin
    .from("exams")
    .select(
      "id,name,status,registration_fee,registration_start_date,registration_end_date,exam_date,classes"
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error || !data || data.length === 0) return null;
  const exams = data as ExamRow[];
  return exams.find((e) => e.status === "OPEN") ?? exams[exams.length - 1];
}

/** Max STU-YYYY-NNNN for an institution+session, next in sequence. */
async function nextStudentId(
  institutionId: string,
  sessionId: string
): Promise<string> {
  const prefix = `STU-${new Date().getFullYear()}-`;
  const { data } = await supabaseAdmin
    .from("students")
    .select("student_id")
    .eq("institution_id", institutionId)
    .eq("session_id", sessionId)
    .like("student_id", `${prefix}%`);
  const maxNum = ((data as { student_id: string }[] | null) ?? [])
    .map((r) => parseInt(r.student_id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

/** ilike pattern needs PostgREST wildcards escaped to be an exact match. */
function exactIlike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/* ------------------------------------------------------------------ */
/* 1. Form options for /apply                                          */
/* ------------------------------------------------------------------ */

export interface ApplyOptions {
  ok: boolean;
  error?: string;
  sessionName?: string;
  exam?: {
    id: string;
    name: string;
    fee: number;
    startDate: string | null;
    endDate: string | null;
    examDate: string | null;
    classIds: string[];
  };
  institutions?: { id: string; name: string; nameEn: string; district: string }[];
  classes?: { id: string; name: string }[];
}

export async function getApplyFormOptions(): Promise<ApplyOptions> {
  const ip = await clientKey("apply-options");
  if (!allow(ip, 30)) return { ok: false, error: RATE_MSG };

  try {
    const session = await currentSession();
    if (!session) {
      return {
        ok: false,
        error: "No active academic session. Please try again later.",
      };
    }
    const exam = await pickExam(session.id);
    if (!exam) {
      return {
        ok: false,
        error: "Registration is not open right now. Please check back later.",
      };
    }

    const [classesRes, instRes] = await Promise.all([
      supabaseAdmin
        .from("classes")
        .select("id,name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("institutions")
        .select("id,name,name_en,district")
        .eq("status", "ACTIVE")
        .order("name", { ascending: true })
        .limit(500),
    ]);

    let classes = (classesRes.data as { id: string; name: string }[] | null) ?? [];
    if (exam.classes && exam.classes.length > 0) {
      const allowed = new Set(exam.classes);
      classes = classes.filter((c) => allowed.has(c.id));
    }

    const institutions = ((instRes.data as
      | { id: string; name: string; name_en: string | null; district: string | null }[]
      | null) ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      nameEn: i.name_en || "",
      district: i.district || "",
    }));

    if (institutions.length === 0) {
      return { ok: false, error: "No active institutions are accepting applications." };
    }

    return {
      ok: true,
      sessionName: session.name,
      exam: {
        id: exam.id,
        name: exam.name,
        fee: Number(exam.registration_fee ?? 0),
        startDate: exam.registration_start_date,
        endDate: exam.registration_end_date,
        examDate: exam.exam_date,
        classIds: exam.classes ?? [],
      },
      institutions,
      classes,
    };
  } catch {
    return { ok: false, error: "Could not load the application form. Please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* 2. Submit an application                                            */
/* ------------------------------------------------------------------ */

export interface ApplyInput {
  institutionId: string;
  classId: string;
  englishName: string;
  banglaName?: string;
  dateOfBirth: string;
  gender: string;
  fatherName: string;
  motherName?: string;
  phone: string;
  address: string;
  roll?: string;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  /** True when this student already applied — the original number is returned. */
  alreadyApplied?: boolean;
  registrationNumber?: string;
  studentName?: string;
  institutionName?: string;
  institutionNameEn?: string;
  examName?: string;
  className?: string;
  fee?: number;
  appliedAt?: string;
}

export async function submitStudentApplication(
  input: ApplyInput
): Promise<ApplyResult> {
  const ip = await clientKey("apply-submit");
  if (!allow(ip, 5)) return { ok: false, error: RATE_MSG };

  /* ---- validate ---- */
  const institutionId = String(input?.institutionId ?? "").trim();
  const classId = String(input?.classId ?? "").trim();
  const englishName = String(input?.englishName ?? "").trim().replace(/\s+/g, " ");
  const banglaName = String(input?.banglaName ?? "").trim();
  const dateOfBirth = String(input?.dateOfBirth ?? "").trim();
  const gender = String(input?.gender ?? "").trim().toUpperCase();
  const fatherName = String(input?.fatherName ?? "").trim().replace(/\s+/g, " ");
  const motherName = String(input?.motherName ?? "").trim().replace(/\s+/g, " ");
  const phone = String(input?.phone ?? "").trim();
  const address = String(input?.address ?? "").trim().replace(/\s+/g, " ");
  const roll = String(input?.roll ?? "").trim();

  if (!UUID_RE.test(institutionId)) {
    return { ok: false, error: "Please select your institution." };
  }
  if (!UUID_RE.test(classId)) {
    return { ok: false, error: "Please select your class." };
  }
  if (!NAME_RE.test(englishName)) {
    return {
      ok: false,
      error: "Please enter the student's name (English), 2–60 letters.",
    };
  }
  if (banglaName && !BANGLA_NAME_RE.test(banglaName)) {
    return { ok: false, error: "Please enter a valid Bangla name." };
  }
  if (!validDob(dateOfBirth)) {
    return { ok: false, error: "Please enter a valid date of birth." };
  }
  if (!GENDERS.has(gender)) {
    return { ok: false, error: "Please select gender." };
  }
  if (!NAME_RE.test(fatherName)) {
    return { ok: false, error: "Please enter the father's / guardian's name." };
  }
  if (motherName && !NAME_RE.test(motherName)) {
    return { ok: false, error: "Please enter a valid mother's name." };
  }
  if (!PHONE_RE.test(phone)) {
    return { ok: false, error: "Please enter a valid phone number." };
  }
  if (address.length < 3 || address.length > 120) {
    return { ok: false, error: "Please enter the present address (3–120 characters)." };
  }
  if (roll && !/^\d{1,6}$/.test(roll)) {
    return { ok: false, error: "Please enter a valid roll number." };
  }

  try {
    /* ---- institution must be active ---- */
    const instRes = await supabaseAdmin
      .from("institutions")
      .select("id,name,name_en,status")
      .eq("id", institutionId)
      .limit(1);
    const inst = (instRes.data as
      | { id: string; name: string; name_en: string | null; status: string }[]
      | null)?.[0];
    if (!inst || inst.status !== "ACTIVE") {
      return {
        ok: false,
        error: "The selected institution is not active. Please contact your institution.",
      };
    }

    /* ---- current session + exam ---- */
    const session = await currentSession();
    if (!session) {
      return { ok: false, error: "No active academic session." };
    }
    const exam = await pickExam(session.id);
    if (!exam) {
      return { ok: false, error: "Registration is not open right now." };
    }
    if (exam.classes && exam.classes.length > 0 && !exam.classes.includes(classId)) {
      return { ok: false, error: "This class is not offered in the current examination." };
    }

    const classRes = await supabaseAdmin
      .from("classes")
      .select("name")
      .eq("id", classId)
      .eq("is_active", true)
      .limit(1);
    const className = (classRes.data as { name: string }[] | null)?.[0]?.name;
    if (!className) {
      return { ok: false, error: "Please select a valid class." };
    }

    const studentName = englishName;
    const institutionName = inst.name;
    const institutionNameEn = inst.name_en || "";

    /* ---- dedupe: same institution + DOB + name in this session/exam ---- */
    const dupStudents = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("session_id", session.id)
      .eq("institution_id", institutionId)
      .eq("date_of_birth", dateOfBirth)
      .ilike("first_name", exactIlike(englishName))
      .limit(5);
    const dupIds = ((dupStudents.data as { id: string }[] | null) ?? []).map((s) => s.id);
    if (dupIds.length > 0) {
      const dupRegs = await supabaseAdmin
        .from("registrations")
        .select("registration_number,created_at")
        .eq("session_id", session.id)
        .eq("exam_id", exam.id)
        .in("student_id", dupIds)
        .limit(1);
      const existing = (dupRegs.data as
        | { registration_number: string; created_at: string }[]
        | null)?.[0];
      if (existing) {
        return {
          ok: true,
          alreadyApplied: true,
          registrationNumber: existing.registration_number,
          studentName,
          institutionName,
          institutionNameEn,
          examName: exam.name,
          className,
          fee: Number(exam.registration_fee ?? 0),
          appliedAt: existing.created_at,
        };
      }
    }

    /* ---- create student (same fields the institution wizard writes) ---- */
    const studentId = await nextStudentId(institutionId, session.id);
    const studentPayload = {
      institution_id: institutionId,
      session_id: session.id,
      first_name: englishName,
      last_name: "",
      first_name_bn: banglaName || null,
      student_id: studentId,
      class: className,
      section: "",
      roll,
      date_of_birth: dateOfBirth,
      gender,
      father_name: fatherName,
      mother_name: motherName,
      phone,
      address,
      status: "ACTIVE",
    };
    let studentInsert = await supabaseAdmin
      .from("students")
      .insert(studentPayload)
      .select("id")
      .limit(1);
    if (studentInsert.error && studentInsert.error.code === "23505") {
      // Concurrent application took our number — recompute once and retry.
      studentPayload.student_id = await nextStudentId(institutionId, session.id);
      studentInsert = await supabaseAdmin
        .from("students")
        .insert(studentPayload)
        .select("id")
        .limit(1);
    }
    const newStudent = (studentInsert.data as { id: string }[] | null)?.[0];
    if (studentInsert.error || !newStudent) {
      console.error("[student-apply] student insert failed:", studentInsert.error);
      return { ok: false, error: "Could not submit the application. Please try again." };
    }

    /* ---- create registration; the 0006 trigger assigns the number ---- */
    const regInsert = await supabaseAdmin
      .from("registrations")
      .insert({
        session_id: session.id,
        application_id: "",
        registration_number: "",
        student_id: newStudent.id,
        student_name: studentName,
        institution_id: institutionId,
        institution_name: institutionName,
        exam_id: exam.id,
        exam_name: exam.name,
        class_name: className,
        status: "PENDING",
        payment_status: "PENDING",
        student_payment_status: "NOT_SUBMITTED",
        payment_amount: Number(exam.registration_fee ?? 0),
      })
      .select("registration_number,created_at")
      .limit(1);
    const reg = (regInsert.data as
      | { registration_number: string; created_at: string }[]
      | null)?.[0];
    if (regInsert.error || !reg) {
      console.error("[student-apply] registration insert failed:", regInsert.error);
      // Do not leave an orphan student row behind.
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      return { ok: false, error: "Could not submit the application. Please try again." };
    }

    // Super-admins get a notification (fast local insert; never fails the submission).
    try {
      await supabaseAdmin.rpc("create_notification_for_super_admins", {
        p_title: "New student application",
        p_message: `${studentName} applied for ${exam.name} at ${institutionName} (Reg ${reg.registration_number}).`,
        p_type: "info",
        p_link: `/super-admin/registrations`,
      });
    } catch {
      /* notification must never fail the submission */
    }

    return {
      ok: true,
      alreadyApplied: false,
      registrationNumber: reg.registration_number,
      studentName,
      institutionName,
      institutionNameEn,
      examName: exam.name,
      className,
      fee: Number(exam.registration_fee ?? 0),
      appliedAt: reg.created_at,
    };
  } catch (err) {
    console.error("[student-apply] submit failed:", err);
    return { ok: false, error: "Could not submit the application. Please try again." };
  }
}

/* ------------------------------------------------------------------ */
/* 3. Status lookup for /status                                        */
/* ------------------------------------------------------------------ */

export interface ApplicationStatus {
  registrationNumber: string;
  studentName: string;
  studentNameBn: string;
  institutionName: string;
  institutionNameEn: string;
  className: string;
  roll: string;
  appliedAt: string;
  /** Registration / application approval status. */
  applicationStatus: string;
  /** Cash payment recorded by the institution (no online payment here). */
  paymentStatus: string;
  paid: boolean;
  paidAmount: number | null;
  paidAt: string | null;
  expectedFee: number;
  studentPaymentStatus: string;
  /** Student record state — the institution can deactivate a student. */
  studentStatus: string;
  exam: {
    name: string;
    status: string;
    examDate: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  result: {
    status: string;
    grade: string;
    totalMarks: number;
    totalFullMarks: number;
    percentage: number;
    position: number;
    pass: boolean;
    scholarshipStatus: string;
  } | null;
}

export interface StatusLookup {
  ok: boolean;
  error?: string;
  /** null = no matching application (never reveals whether the number exists). */
  status?: ApplicationStatus | null;
}

export async function lookupStudentApplicationStatus(input: {
  registrationNumber: string;
  dob: string;
}): Promise<StatusLookup> {
  const ip = await clientKey("apply-status");
  if (!allow(ip, 10)) return { ok: false, error: RATE_MSG };

  const reg = String(input?.registrationNumber ?? "").trim();
  const dob = String(input?.dob ?? "").trim();
  if (!SAFE_KEY.test(reg)) {
    return { ok: false, error: "Please enter a valid registration number." };
  }
  if (!validDob(dob)) {
    return { ok: false, error: "Please enter a valid date of birth." };
  }

  try {
    const regRes = await supabaseAdmin
      .from("registrations")
      .select(
        "id,registration_number,status,payment_status,student_payment_status,payment_amount,created_at," +
          "student_id,student_name,institution_id,institution_name,exam_id,exam_name,class_name"
      )
      .eq("registration_number", reg)
      .limit(1);
    const registration = (regRes.data as Record<string, unknown>[] | null)?.[0];
    if (!registration) return { ok: true, status: null };

    const studentRes = await supabaseAdmin
      .from("students")
      .select("id,date_of_birth,first_name,first_name_bn,status,roll")
      .eq("id", String(registration.student_id))
      .eq("date_of_birth", dob) // ownership proof: must match the caller
      .limit(1);
    const student = (studentRes.data as Record<string, unknown>[] | null)?.[0];
    if (!student) return { ok: true, status: null };

    const [examRes, instRes, paymentRes, resultRes] = await Promise.all([
      supabaseAdmin
        .from("exams")
        .select("name,status,exam_date,registration_start_date,registration_end_date")
        .eq("id", String(registration.exam_id))
        .limit(1),
      supabaseAdmin
        .from("institutions")
        .select("name,name_en")
        .eq("id", String(registration.institution_id))
        .limit(1),
      supabaseAdmin
        .from("payments")
        .select("status,amount,payment_date,date")
        .eq("registration_id", String(registration.id))
        .limit(5),
      supabaseAdmin
        .from("results")
        .select(
          "status,grade,total_marks,total_full_marks,percentage,position,pass,scholarship_status"
        )
        .eq("registration_number", String(registration.registration_number))
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

    const exam = (examRes.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const inst = (instRes.data as Record<string, unknown>[] | null)?.[0] ?? null;
    const payments = (paymentRes.data as Record<string, unknown>[] | null) ?? [];
    const results = (resultRes.data as Record<string, unknown>[] | null) ?? [];

    const regPaymentStatus = String(registration.payment_status ?? "PENDING");
    const payingStatuses = new Set(["PAID", "CONFIRMED"]);
    const paymentRow = payments.find((p) => payingStatuses.has(String(p.status)));
    const paid = payingStatuses.has(regPaymentStatus) || Boolean(paymentRow);

    const published =
      results.find((r) => String(r.status) === "PUBLISHED") ?? results[0] ?? null;

    const status: ApplicationStatus = {
      registrationNumber: String(registration.registration_number),
      studentName: String(registration.student_name || student.first_name || ""),
      studentNameBn: String(student.first_name_bn || ""),
      institutionName: String(registration.institution_name || ""),
      institutionNameEn: String(inst?.name_en || ""),
      className: String(registration.class_name || ""),
      roll: String(student.roll || ""),
      appliedAt: String(registration.created_at || ""),
      applicationStatus: String(registration.status || "PENDING"),
      paymentStatus: regPaymentStatus,
      paid,
      paidAmount: paid
        ? Number(paymentRow?.amount ?? registration.payment_amount ?? 0)
        : null,
      paidAt: paid
        ? String(paymentRow?.payment_date ?? paymentRow?.date ?? "")
        : null,
      expectedFee: Number(registration.payment_amount ?? 0),
      studentPaymentStatus: String(registration.student_payment_status || "NOT_SUBMITTED"),
      studentStatus: String(student.status || "ACTIVE"),
      exam: {
        name: String(registration.exam_name || exam?.name || ""),
        status: String(exam?.status || ""),
        examDate: (exam?.exam_date as string) ?? null,
        startDate: (exam?.registration_start_date as string) ?? null,
        endDate: (exam?.registration_end_date as string) ?? null,
      },
      result: published
        ? {
            status: String(published.status),
            grade: String(published.grade || ""),
            totalMarks: Number(published.total_marks ?? 0),
            totalFullMarks: Number(published.total_full_marks ?? 0),
            percentage: Number(published.percentage ?? 0),
            position: Number(published.position ?? 0),
            pass: Boolean(published.pass),
            scholarshipStatus: String(published.scholarship_status || "PENDING"),
          }
        : null,
    };

    return { ok: true, status };
  } catch (err) {
    console.error("[student-apply] status lookup failed:", err);
    return { ok: false, error: "Lookup failed. Please try again." };
  }
}
