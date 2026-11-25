import { useMemo } from 'react';
import { Student } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentSession } from './sessions';

const SUPABASE_TABLE = 'students';

const STUDENT_COLUMNS = 'id,institution_id,session_id,first_name,last_name,first_name_bn,last_name_bn,student_id,class,section,roll,exam_roll,date_of_birth,gender,father_name,mother_name,phone,address,photo_url,status,created_at,updated_at';

// Lightweight columns list omitting multi-KB base64 photo_url for ultra-fast list queries
export const STUDENT_LIST_COLUMNS = 'id,institution_id,session_id,first_name,last_name,first_name_bn,last_name_bn,student_id,class,section,roll,exam_roll,date_of_birth,gender,father_name,mother_name,phone,address,status,created_at,updated_at';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Tables that store their OWN copy of the student's name, snapshotted when the
 * row was created. Every page reading them (Registrations, Payments, Results,
 * Certificates, Admit Cards) renders that copy, so renaming a student has to be
 * pushed into all of them — otherwise the Students page shows the new name while
 * those pages keep the old one. `marks` has no name column (the marks sheet reads
 * `registrations.student_name`, which is covered first).
 */
const STUDENT_NAME_COPY_TABLES = ['registrations', 'payments', 'results', 'certificates', 'admit_cards'];

async function syncStudentNameCopies(studentId: string, fullName: string): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    STUDENT_NAME_COPY_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).update({ student_name: fullName }).eq('student_id', studentId);
      // Never fail the student edit over a mirrored copy — surface it instead.
      if (error) console.warn(`[students] could not sync ${table}.student_name:`, error.message);
    }),
  );
}

function mapStudent(data: any): Student {
  return {
    id: data.id,
    institutionId: data.institution_id,
    sessionId: data.session_id,
    firstName: data.first_name,
    lastName: data.last_name,
    firstNameBn: data.first_name_bn,
    lastNameBn: data.last_name_bn,
    studentId: data.student_id,
    class: data.class,
    section: data.section,
    roll: data.roll,
    dateOfBirth: data.date_of_birth,
    gender: data.gender,
    fatherName: data.father_name,
    motherName: data.mother_name,
    phone: data.phone,
    address: data.address,
    photo: data.photo_url,
    examRoll: data.exam_roll,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchStudents(sessionId?: string, page?: number, pageSize?: number): Promise<Student[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;

  if (page !== undefined && pageSize !== undefined) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_LIST_COLUMNS)
      .order('created_at', { ascending: false });
    if (sid) query = query.eq('session_id', sid);
    const { data, error } = await query.range(from, to);
    if (error) {
      console.error('[students] fetchStudents error:', error);
      return [];
    }
    if (!data) return [];
    return data.map(mapStudent);
  }

  // Fetch all students (pages past Supabase's 1000-row cap)
  const PAGE = 1000;
  const all: any[] = [];
  for (let p = 0; p < 50; p++) {
    const from = p * PAGE;
    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_LIST_COLUMNS)
      .order('created_at', { ascending: false });
    if (sid) query = query.eq('session_id', sid);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) {
      console.error('[students] fetchStudents error:', error);
      break;
    }
    if (!data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapStudent);
}

/**
 * Fetches only student_id values for an institution+session (lightweight, no pagination).
 * Used by generateStudentId to find the next available number.
 */
export async function fetchStudentIdsByInstitution(institutionId: string, sessionId?: string): Promise<string[]> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return [];
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('student_id')
    .eq('session_id', sid)
    .eq('institution_id', institutionId);
  if (error || !data) return [];
  return data.map((row: { student_id: string }) => row.student_id);
}

export async function fetchStudentsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number): Promise<Student[]> {
  const supabase = createClient();
  if (!institutionId) return [];
  const sid = sessionId || (await fetchCurrentSession())?.id;

  if (page !== undefined && pageSize !== undefined) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_LIST_COLUMNS)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });
    if (sid) query = query.eq('session_id', sid);
    const { data, error } = await query.range(from, to);
    if (error) {
      console.error('[students] fetchStudentsByInstitution error:', error);
      return [];
    }
    if (!data) return [];
    return data.map(mapStudent);
  }

  // Fetch all students for this institution (pages past Supabase's 1000-row cap)
  const PAGE = 1000;
  const all: any[] = [];
  for (let p = 0; p < 50; p++) {
    const from = p * PAGE;
    let query = supabase
      .from(SUPABASE_TABLE)
      .select(STUDENT_LIST_COLUMNS)
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });
    if (sid) query = query.eq('session_id', sid);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) {
      console.error('[students] fetchStudentsByInstitution error:', error);
      break;
    }
    if (!data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapStudent);
}

export async function fetchStudentById(id: string): Promise<Student | undefined> {
  const { data, error } = await createClient().from(SUPABASE_TABLE).select(STUDENT_COLUMNS).eq('id', id).single();
  if (error || !data) return undefined;
  return mapStudent(data);
}

export async function fetchStudentByStudentId(studentId: string, sessionId?: string): Promise<Student | undefined> {
  const supabase = createClient();
  const sid = sessionId || (await fetchCurrentSession())?.id;
  if (!sid) return undefined;
  const { data, error } = await supabase.from(SUPABASE_TABLE).select(STUDENT_COLUMNS).eq('student_id', studentId).eq('session_id', sid).single();
  if (error || !data) return undefined;
  return mapStudent(data);
}

export async function createStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
  const supabase = createClient();
  const { data: result, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert({
      institution_id: data.institutionId,
      session_id: data.sessionId,
      first_name: data.firstName,
      last_name: data.lastName,
      first_name_bn: data.firstNameBn,
      last_name_bn: data.lastNameBn,
      student_id: data.studentId,
      class: data.class,
      section: data.section,
      roll: data.roll,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      father_name: data.fatherName,
      mother_name: data.motherName,
      phone: data.phone,
      address: data.address,
      photo_url: data.photo,
      status: data.status,
    })
    .select(STUDENT_COLUMNS)
    .single();
  if (error) throw error;
  return mapStudent(result);
}

export async function updateStudent(id: string, data: Partial<Student>): Promise<Student | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.institutionId !== undefined) u.institution_id = data.institutionId;
  if (data.sessionId !== undefined) u.session_id = data.sessionId;
  if (data.firstName !== undefined) u.first_name = data.firstName;
  if (data.lastName !== undefined) u.last_name = data.lastName;
  if (data.firstNameBn !== undefined) u.first_name_bn = data.firstNameBn;
  if (data.lastNameBn !== undefined) u.last_name_bn = data.lastNameBn;
  if (data.studentId !== undefined) u.student_id = data.studentId;
  if (data.class !== undefined) u.class = data.class;
  if (data.section !== undefined) u.section = data.section;
  if (data.roll !== undefined) u.roll = data.roll;
  if (data.dateOfBirth !== undefined) u.date_of_birth = data.dateOfBirth;
  if (data.gender !== undefined) u.gender = data.gender;
  if (data.fatherName !== undefined) u.father_name = data.fatherName;
  if (data.motherName !== undefined) u.mother_name = data.motherName;
  if (data.phone !== undefined) u.phone = data.phone;
  if (data.address !== undefined) u.address = data.address;
  if (data.photo !== undefined) u.photo_url = data.photo;
  if (data.status !== undefined) u.status = data.status;
  const { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(STUDENT_COLUMNS).single();
  if (error) return undefined;

  // Keep the name copies stored on Registrations/Payments/Results/Certificates/
  // Admit Cards in step with the edit — otherwise those pages keep showing the
  // name the student had before this change.
  if (data.firstName !== undefined || data.lastName !== undefined) {
    const fullName = `${result.first_name ?? ''} ${result.last_name ?? ''}`.trim();
    await syncStudentNameCopies(id, fullName);
  }

  return mapStudent(result);
}

export async function deleteStudent(id: string): Promise<boolean> {
  const supabase = createClient();
  
  // First, get the student to find the photo URL for cleanup
  const { data: student } = await supabase.from(SUPABASE_TABLE).select('photo_url').eq('id', id).single();
  
  // Delete all related data (RLS may block some, but ON DELETE CASCADE handles the rest at DB level)
  // Delete registrations first (they reference student_id)
  await supabase.from('registrations').delete().eq('student_id', id);
  // Delete marks
  await supabase.from('marks').delete().eq('student_id', id);
  // Delete results  
  await supabase.from('results').delete().eq('student_id', id);
  // Delete certificates
  await supabase.from('certificates').delete().eq('student_id', id);
  // Delete admit cards
  await supabase.from('admit_cards').delete().eq('student_id', id);
  // Delete payments referencing this student
  await supabase.from('payments').delete().eq('student_id', id);
  
  // Delete the student record
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('id', id);
  
  // Try to delete the student photo from storage if it exists
  if (student?.photo_url) {
    try {
      // Extract file path from the URL
      const urlParts = student.photo_url.split('/');
      const bucketIndex = urlParts.findIndex((p: string) => p === 'student-photos' || p === 'students');
      if (bucketIndex !== -1) {
        const filePath = urlParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from(urlParts[bucketIndex]).remove([filePath]);
      }
    } catch {
      // Ignore storage errors - photo cleanup is best-effort
    }
  }
  
  return !error;
}

/**
 * Per-institution student counts (institution_id -> count) for ONE session,
 * computed directly from the students table instead of the stale
 * institutions.total_students counter (which the app never updated).
 * A new (empty) session yields no rows -> every count shows 0 while
 * previous sessions' rows stay untouched in the database.
 * Refetches every 30s and on window focus so the Institutions table
 * "Students" column stays dynamic without a page reload.
 */
export function useInstitutionStudentCounts(sessionId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['students', 'counts', 'by-institution', sessionId],
    queryFn: async () => {
      const supabase = createClient();
      // Fast path: use PostgreSQL server-side aggregation RPC if available
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_session_institution_student_counts', {
          p_session_id: sessionId!,
        });
        if (!rpcErr && rpcData && typeof rpcData === 'object') {
          return rpcData as Record<string, number>;
        }
      } catch {}

      // Fallback: lightweight table query
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('institution_id')
        .eq('session_id', sessionId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.institution_id) {
          counts[row.institution_id] = (counts[row.institution_id] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!sessionId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

/**
 * Per-class student counts (class name -> count) for ONE session, computed
 * directly from the students table so the Classes table's "Students" column
 * is live rather than derived from a counter nothing updates. A session with
 * no students yields an empty map, so every class shows 0.
 * Refetches every 30s and on window focus — same cadence as
 * useInstitutionStudentCounts so both tables stay in sync without reloads.
 */
export function useClassStudentCounts(sessionId?: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['students', 'counts', 'by-class', sessionId],
    queryFn: async () => {
      const supabase = createClient();
      // Fast path: use PostgreSQL server-side aggregation RPC if available
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_session_class_student_counts', {
          p_session_id: sessionId!,
        });
        if (!rpcErr && rpcData && typeof rpcData === 'object') {
          return rpcData as Record<string, number>;
        }
      } catch {}

      // Fallback: lightweight table query
      const { data, error } = await supabase
        .from(SUPABASE_TABLE)
        .select('class')
        .eq('session_id', sessionId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        if (row.class) counts[row.class] = (counts[row.class] || 0) + 1;
      }
      return counts;
    },
    enabled: !!sessionId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useStudents(sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['students', sessionId, page, pageSize],
    queryFn: () => fetchStudents(sessionId, page, pageSize),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

// Own column list including exam_roll (0013) plus the biographical fields the
// Admit Card page prints — kept separate from STUDENT_COLUMNS so every other
// students page keeps working before migration 0013 is run.
const CLASS_ROLL_COLUMNS = 'id,institution_id,session_id,first_name,last_name,first_name_bn,last_name_bn,student_id,class,section,roll,exam_roll,date_of_birth,gender,father_name,mother_name,phone,address,status,created_at,updated_at';

/**
 * All students of one class in a session (across every institution),
 * including their exam roll. Used by the super-admin Roll Numbers page.
 * Throws on error so the page can surface "run migration 0013".
 */
export async function fetchStudentsByClass(sessionId?: string, className?: string): Promise<Student[]> {
  const supabase = createClient();
  if (!sessionId || !className) return [];
  const PAGE = 1000;
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select(CLASS_ROLL_COLUMNS)
      .eq('session_id', sessionId)
      .eq('class', className)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all.map(mapStudent);
}

export function useStudentsByClass(sessionId?: string, className?: string) {
  return useQuery({
    queryKey: ['students', 'by-class', sessionId, className],
    queryFn: () => fetchStudentsByClass(sessionId, className),
    enabled: !!sessionId && !!className,
    staleTime: 30 * 1000,
  });
}

export function useStudentsByInstitution(institutionId: string, sessionId?: string, page?: number, pageSize?: number) {
  return useQuery({
    queryKey: ['students', 'institution', institutionId, sessionId, page, pageSize],
    queryFn: () => fetchStudentsByInstitution(institutionId, sessionId, page, pageSize),
    enabled: !!institutionId,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useStudentById(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => fetchStudentById(id),
    enabled: !!id,
  });
}

export type StudentPhotoVariant = 'thumb' | 'card' | 'full';

export interface UseStudentPhotosOptions {
  variant?: StudentPhotoVariant;
  enabled?: boolean;
}

const PHOTO_CACHE_TTL_MS = 5 * 60 * 1000;
const PHOTO_IDB_NAME = 'scholarx_photo_cache_v1';
const PHOTO_IDB_STORE = 'photos';
const PHOTO_FETCH_CHUNK_SIZE = 40;
const PHOTO_FETCH_CONCURRENCY = 3;

interface CachedPhotoEntry {
  photo: string | null;
  ts: number;
}

const photoMemCache: Record<StudentPhotoVariant, Map<string, CachedPhotoEntry>> = {
  thumb: new Map(),
  card: new Map(),
  full: new Map(),
};

const inflightPhotoRequests = new Map<string, Promise<string | null>>();

let photoDbPromise: Promise<IDBDatabase | null> | null = null;

function openPhotoCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  if (photoDbPromise) return photoDbPromise;
  photoDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = window.indexedDB.open(PHOTO_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_IDB_STORE)) {
          db.createObjectStore(PHOTO_IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return photoDbPromise;
}

async function readIdbPhotos(
  ids: string[],
  variant: StudentPhotoVariant,
  now: number
): Promise<Map<string, CachedPhotoEntry>> {
  const result = new Map<string, CachedPhotoEntry>();
  if (ids.length === 0) return result;
  const db = await openPhotoCacheDb();
  if (!db) return result;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_IDB_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_IDB_STORE);
      for (const id of ids) {
        const key = `${variant}:${id}`;
        const req = store.get(key);
        req.onsuccess = () => {
          const val = req.result as { key: string; photo: string | null; ts: number } | undefined;
          if (val && now - val.ts < PHOTO_CACHE_TTL_MS) {
            result.set(id, { photo: val.photo ?? null, ts: val.ts });
          }
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(result);
      tx.onabort = () => resolve(result);
    } catch {
      resolve(result);
    }
  });
}

async function writeIdbPhotos(
  entries: Array<{ id: string; photo: string | null; ts: number }>,
  variant: StudentPhotoVariant
): Promise<void> {
  if (entries.length === 0) return;
  const db = await openPhotoCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_IDB_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_IDB_STORE);
      for (const entry of entries) {
        store.put({
          key: `${variant}:${entry.id}`,
          photo: entry.photo,
          ts: entry.ts,
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function invalidateStudentPhotoCache(studentId?: string): void {
  const variants: StudentPhotoVariant[] = ['thumb', 'card', 'full'];
  for (const v of variants) {
    if (studentId) {
      photoMemCache[v].delete(studentId);
    } else {
      photoMemCache[v].clear();
    }
  }
  void openPhotoCacheDb().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(PHOTO_IDB_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_IDB_STORE);
      if (studentId) {
        for (const v of variants) store.delete(`${v}:${studentId}`);
      } else {
        store.clear();
      }
    } catch {
      // Ignore cache cleanup errors
    }
  });
}

function readFreshMemoryPhotos(
  ids: string[],
  variant: StudentPhotoVariant
): { map: Record<string, string>; allHit: boolean; oldestTs: number | undefined } {
  const now = Date.now();
  const cache = photoMemCache[variant];
  const map: Record<string, string> = {};
  let allHit = ids.length > 0;
  let oldestTs: number | undefined;

  for (const id of ids) {
    const entry = cache.get(id);
    if (!entry || now - entry.ts >= PHOTO_CACHE_TTL_MS) {
      allHit = false;
      continue;
    }
    if (entry.photo) map[id] = entry.photo;
    if (oldestTs === undefined || entry.ts < oldestTs) {
      oldestTs = entry.ts;
    }
  }

  return { map, allHit, oldestTs };
}

async function fetchPhotoChunkFromNetwork(
  chunk: string[],
  variant: StudentPhotoVariant
): Promise<{ ok: boolean; photos: Record<string, string> }> {
  // Fast path: Next.js batch photo route with server-side thumbnail/card sizing via sharp
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/students/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chunk, variant }),
      });
      if (res.ok) {
        const json = (await res.json()) as { photos?: Record<string, string> };
        return { ok: true, photos: json.photos || {} };
      }
      if (res.status === 401) {
        return { ok: false, photos: {} };
      }
    } catch {
      // Fall through to direct Supabase query fallback
    }
  }

  // Fallback path: direct PostgREST batch lookup
  const supabase = createClient();
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('id, photo_url')
    .in('id', chunk)
    .not('photo_url', 'is', null);

  if (error || !data) {
    return { ok: false, photos: {} };
  }

  const photos: Record<string, string> = {};
  for (const row of data) {
    if (row.photo_url) photos[row.id] = row.photo_url;
  }
  return { ok: true, photos };
}

/**
 * Fetches student photos with a 3-tier normalized cache (memory -> IndexedDB -> network),
 * in-flight per-ID deduplication, priority-ordered chunking, and bounded concurrency.
 */
export async function fetchStudentPhotos(
  studentIds: string[],
  variant: StudentPhotoVariant = 'thumb'
): Promise<Record<string, string>> {
  const orderedIds = Array.from(new Set(studentIds.filter(Boolean)));
  if (orderedIds.length === 0) return {};

  const now = Date.now();
  const mem = photoMemCache[variant];
  const resolved = new Map<string, string | null>();
  const missingAfterMem: string[] = [];

  for (const id of orderedIds) {
    const entry = mem.get(id);
    if (entry && now - entry.ts < PHOTO_CACHE_TTL_MS) {
      resolved.set(id, entry.photo);
    } else {
      missingAfterMem.push(id);
    }
  }

  // Tier 2: IndexedDB lookup in a single batched transaction
  const missingAfterIdb: string[] = [];
  if (missingAfterMem.length > 0) {
    const idbHits = await readIdbPhotos(missingAfterMem, variant, now);
    for (const id of missingAfterMem) {
      const hit = idbHits.get(id);
      if (hit) {
        mem.set(id, hit);
        resolved.set(id, hit.photo);
      } else {
        missingAfterIdb.push(id);
      }
    }
  }

  // Tier 3: Deduplicate in-flight requests and fetch remaining IDs in priority order
  const inflightWaits: Array<{ id: string; promise: Promise<string | null> }> = [];
  const toFetch: string[] = [];
  const deferredResolvers = new Map<string, (val: string | null) => void>();

  for (const id of missingAfterIdb) {
    const reqKey = `${variant}:${id}`;
    const existingPromise = inflightPhotoRequests.get(reqKey);
    if (existingPromise) {
      inflightWaits.push({ id, promise: existingPromise });
    } else {
      toFetch.push(id);
      const promise = new Promise<string | null>((resolve) => {
        deferredResolvers.set(id, resolve);
      });
      inflightPhotoRequests.set(reqKey, promise);
    }
  }

  if (toFetch.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < toFetch.length; i += PHOTO_FETCH_CHUNK_SIZE) {
      chunks.push(toFetch.slice(i, i + PHOTO_FETCH_CHUNK_SIZE));
    }

    let nextChunkIdx = 0;
    const worker = async () => {
      while (nextChunkIdx < chunks.length) {
        const chunkIdx = nextChunkIdx++;
        const chunk = chunks[chunkIdx];
        try {
          const { ok, photos } = await fetchPhotoChunkFromNetwork(chunk, variant);
          const ts = Date.now();
          const idbBatch: Array<{ id: string; photo: string | null; ts: number }> = [];

          for (const id of chunk) {
            const val = photos[id] || null;
            resolved.set(id, val);
            if (ok) {
              mem.set(id, { photo: val, ts });
              idbBatch.push({ id, photo: val, ts });
            }
            deferredResolvers.get(id)?.(val);
            inflightPhotoRequests.delete(`${variant}:${id}`);
          }

          if (idbBatch.length > 0) {
            void writeIdbPhotos(idbBatch, variant);
          }
        } catch {
          for (const id of chunk) {
            resolved.set(id, null);
            deferredResolvers.get(id)?.(null);
            inflightPhotoRequests.delete(`${variant}:${id}`);
          }
        }
      }
    };

    const workerCount = Math.min(PHOTO_FETCH_CONCURRENCY, chunks.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  if (inflightWaits.length > 0) {
    await Promise.all(
      inflightWaits.map(async ({ id, promise }) => {
        const val = await promise;
        resolved.set(id, val);
      })
    );
  }

  const out: Record<string, string> = {};
  for (const id of orderedIds) {
    const val = resolved.get(id);
    if (val) out[id] = val;
  }
  return out;
}

/**
 * On-demand batch photo lookup with normalized per-student caching (memory + IndexedDB)
 * and server-side thumbnail/card resizing so repeated views and PDF exports are fast.
 */
export function useStudentPhotos(
  studentIds: string[],
  options?: UseStudentPhotosOptions
) {
  const variant: StudentPhotoVariant = options?.variant ?? 'thumb';
  const enabled = options?.enabled ?? true;

  const { orderedUniqueIds, idsKey } = useMemo(() => {
    const ordered = Array.from(new Set(studentIds.filter(Boolean)));
    const key = ordered.slice().sort().join(',');
    return { orderedUniqueIds: ordered, idsKey: key };
  }, [studentIds]);

  return useQuery<Record<string, string>>({
    queryKey: ['students', 'photos', variant, idsKey],
    queryFn: () => fetchStudentPhotos(orderedUniqueIds, variant),
    initialData: () => {
      if (!enabled || orderedUniqueIds.length === 0) return undefined;
      const snap = readFreshMemoryPhotos(orderedUniqueIds, variant);
      return snap.allHit ? snap.map : undefined;
    },
    initialDataUpdatedAt: () => {
      if (!enabled || orderedUniqueIds.length === 0) return undefined;
      const snap = readFreshMemoryPhotos(orderedUniqueIds, variant);
      return snap.allHit ? snap.oldestTs : undefined;
    },
    placeholderData: (prev) => {
      if (orderedUniqueIds.length === 0) return prev;
      const snap = readFreshMemoryPhotos(orderedUniqueIds, variant);
      return Object.keys(snap.map).length > 0 ? snap.map : prev;
    },
    enabled: enabled && orderedUniqueIds.length > 0,
    staleTime: PHOTO_CACHE_TTL_MS,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => createStudent(data),
    onSuccess: (created) => {
      if (created?.id) invalidateStudentPhotoCache(created.id);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) => updateStudent(id, data),
    onSuccess: (_result, variables) => {
      if (variables?.data?.photo !== undefined) {
        invalidateStudentPhotoCache(variables.id);
      }
      qc.invalidateQueries({ queryKey: ['students'] });
      // Registration/Payment/Result/Certificate/Admit-card rows display the
      // student's name — refetch them too so an edit here shows up on those
      // pages without a manual refresh.
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
      qc.invalidateQueries({ queryKey: ['admit_cards'] });
      qc.invalidateQueries({ queryKey: ['admit-cards'] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: (_result, id) => {
      invalidateStudentPhotoCache(id);
      // Invalidate ALL related queries so deleted student data disappears everywhere
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['admit_cards'] });
      qc.invalidateQueries({ queryKey: ['admit-cards'] });
      qc.invalidateQueries({ queryKey: ['marks'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
