import { useCallback } from 'react';
import { Institution } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLang } from '@/contexts/language-context';
import { deleteInstitutionServer, type DeleteInstitutionResult } from '@/lib/auth/institution-actions';
import { normalizeRollDigits, normalizeRollRangePair } from '@/lib/marks/roll-range';

const SUPABASE_TABLE = 'institutions';

const INSTITUTION_COLUMNS = 'id,name,name_en,code,slug,email,phone,address,city,district,contact_person,contact_person_phone,admin_user_id,status,logo_url,principal_signature_url,allow_admit_card_download,allow_mark_entry,mark_entry_roll_from,mark_entry_roll_to,allow_marksheet_download,allow_certificate_download,total_students,total_applications,created_at,updated_at';

/**
 * While any of the columns added by migrations 0022, 0033, 0038 and 0043 is
 * pending, PostgREST rejects this list in the WHOLE select/RETURNING.
 * `selectResilient` below strips only the column(s) the error names and
 * retries, so columns that already exist keep reading and saving.
 */

const isPreMigrationError = (error: unknown): boolean =>
  /(principal_signature_url|allow_admit_card_download|allow_mark_entry|mark_entry_roll_from|mark_entry_roll_to|allow_marksheet_download|allow_certificate_download)/.test(
    String((error as { message?: string })?.message ?? '')
  );

/** Which not-yet-applied column the failed statement complained about. */
const missingLegacyColumn = (error: unknown): string | null => {
  const msg = String((error as { message?: string })?.message ?? '');
  if (/allow_mark_entry/.test(msg)) return 'allow_mark_entry';
  if (/mark_entry_roll_from/.test(msg)) return 'mark_entry_roll_from';
  if (/mark_entry_roll_to/.test(msg)) return 'mark_entry_roll_to';
  if (/allow_marksheet_download/.test(msg)) return 'allow_marksheet_download';
  if (/allow_certificate_download/.test(msg)) return 'allow_certificate_download';
  if (/allow_admit_card_download/.test(msg)) return 'allow_admit_card_download';
  if (/principal_signature_url/.test(msg)) return 'principal_signature_url';
  return null;
};

type PgResult<T> = { data: T; error: { message?: string; code?: string; details?: unknown } | null };

/**
 * Run a SELECT, retrying while PostgREST rejects a column this database
 * does not have yet (migrations 0022/0033/0038/0043 pending). Each retry strips
 * ONLY the column the error names and retries — up to seven rounds cover every
 * pending column at once.
 */
async function selectResilient<T>(
  build: (select: string) => PromiseLike<PgResult<T>>,
  initial: string = INSTITUTION_COLUMNS,
): Promise<PgResult<T>> {
  let select = initial;
  let result = await build(select);
  for (let i = 0; i < 7 && result.error && isPreMigrationError(result.error); i++) {
    const missing = missingLegacyColumn(result.error);
    if (!missing || !select.includes(`,${missing}`)) break;
    select = select.replace(`,${missing}`, '');
    result = await build(select);
  }
  return result;
}

const INSTITUTIONS_STALE_TIME = 60 * 1000; // 1 min (was 5 min) - keeps lists fresh after RLS or data fixes

const INSTITUTION_SLUG_CACHE = new Map<string, Institution>();

function mapInstitution(data: any): Institution {
  return {
    id: data.id,
    name: data.name,
    nameEn: data.name_en ?? '',
    code: data.code,
    slug: data.slug,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    district: data.district,
    contactPerson: data.contact_person,
    contactPersonPhone: data.contact_person_phone,
    adminUserId: data.admin_user_id,
    status: data.status,
    logo: data.logo_url,
    principalSignature: data.principal_signature_url ?? '',
    allowAdmitCardDownload: data.allow_admit_card_download ?? false,
    allowMarkEntry: data.allow_mark_entry ?? false,
    markEntryRollFrom: data.mark_entry_roll_from ?? null,
    markEntryRollTo: data.mark_entry_roll_to ?? null,
    allowMarksheetDownload: data.allow_marksheet_download ?? false,
    allowCertificateDownload: data.allow_certificate_download ?? false,
    totalStudents: data.total_students,
    totalApplications: data.total_applications,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Upload the principal's signature image to the public bucket
 * (`institution-signatures/` folder — INSERT allowed for signed-in
 * staff by migration 0022). Returns the public URL.
 */
export async function uploadPrincipalSignature(slug: string, file: File): Promise<string> {
  const safeSlug =
    String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) ||
    "institution";
  const ext =
    (file.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  const path = `institution-signatures/${safeSlug}-${Date.now()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("public")
    .upload(path, file, { contentType: file.type || "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("public").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not resolve signature URL");
  return data.publicUrl;
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const supabase = createClient();
  let { data, error } = await selectResilient<any[]>((sel) =>
    supabase.from(SUPABASE_TABLE).select(sel).order('created_at', { ascending: false }),
  );
  if (error) {
    console.error("[fetchInstitutions] Supabase error:", error.message, error.code, error.details);
    throw error;
  }
  if (!data) return [];
  const list = data.map(mapInstitution);
  for (const inst of list) {
    if (inst.slug) INSTITUTION_SLUG_CACHE.set(inst.slug, inst);
  }
  return list;
}

export async function fetchInstitutionById(id: string): Promise<Institution | undefined> {
  const supabase = createClient();
  let { data, error } = await selectResilient((sel) =>
    supabase.from(SUPABASE_TABLE).select(sel).eq('id', id).single(),
  );
  if (error) {
    console.error("[fetchInstitutionById] Supabase error:", error.message, error.code, error.details);
    throw error;
  }
  if (!data) return undefined;
  const mapped = mapInstitution(data);
  if (mapped.slug) INSTITUTION_SLUG_CACHE.set(mapped.slug, mapped);
  return mapped;
}

export async function fetchInstitutionBySlug(slug: string): Promise<Institution | undefined> {
  const supabase = createClient();
  let { data, error } = await selectResilient((sel) =>
    supabase.from(SUPABASE_TABLE).select(sel).eq('slug', slug).single(),
  );
  if (error) {
    console.error("[fetchInstitutionBySlug] Supabase error:", error.message, error.code, error.details);
    throw error;
  }
  if (!data) return undefined;
  const mapped = mapInstitution(data);
  if (mapped.slug) INSTITUTION_SLUG_CACHE.set(mapped.slug, mapped);
  return mapped;
}

/**
 * Tables that store their OWN copy of the institution's name.
 * When a super admin updates an institution name, sync all copies across
 * related tables so they stay consistent everywhere.
 */
const INSTITUTION_NAME_COPY_TABLES = ['registrations', 'payments', 'results', 'certificates', 'support_reports'];

async function syncInstitutionNameCopies(institutionId: string, name: string): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    INSTITUTION_NAME_COPY_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).update({ institution_name: name }).eq('institution_id', institutionId);
      if (error) console.warn(`[institutions] could not sync ${table}.institution_name:`, error.message);
    }),
  );
}

export async function updateInstitution(id: string, data: Partial<Institution>): Promise<Institution | undefined> {
  const supabase = createClient();
  const u: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) u.name = data.name;
  if (data.nameEn !== undefined) u.name_en = data.nameEn;
  if (data.code !== undefined) u.code = data.code;
  if (data.slug !== undefined) u.slug = data.slug;
  if (data.email !== undefined) u.email = data.email;
  if (data.phone !== undefined) u.phone = data.phone;
  if (data.address !== undefined) u.address = data.address;
  if (data.city !== undefined) u.city = data.city;
  if (data.district !== undefined) u.district = data.district;
  if (data.contactPerson !== undefined) u.contact_person = data.contactPerson;
  if (data.contactPersonPhone !== undefined) u.contact_person_phone = data.contactPersonPhone;
  if (data.adminUserId !== undefined) u.admin_user_id = data.adminUserId;
  if (data.status !== undefined) u.status = data.status;
  if (data.logo !== undefined) u.logo_url = data.logo;
  if (data.principalSignature !== undefined) u.principal_signature_url = data.principalSignature;
  if (data.allowAdmitCardDownload !== undefined) u.allow_admit_card_download = data.allowAdmitCardDownload;
  if (data.allowMarkEntry !== undefined) u.allow_mark_entry = data.allowMarkEntry;
  if (data.markEntryRollFrom !== undefined && data.markEntryRollTo !== undefined) {
    const normalized = normalizeRollRangePair(data.markEntryRollFrom, data.markEntryRollTo);
    u.mark_entry_roll_from = normalized.from;
    u.mark_entry_roll_to = normalized.to;
  } else {
    if (data.markEntryRollFrom !== undefined) {
      u.mark_entry_roll_from = normalizeRollDigits(data.markEntryRollFrom) || null;
    }
    if (data.markEntryRollTo !== undefined) {
      u.mark_entry_roll_to = normalizeRollDigits(data.markEntryRollTo) || null;
    }
  }
  if (data.allowMarksheetDownload !== undefined) u.allow_marksheet_download = data.allowMarksheetDownload;
  if (data.allowCertificateDownload !== undefined) u.allow_certificate_download = data.allowCertificateDownload;
  const payloadKey: Record<string, keyof Institution> = {
    principal_signature_url: 'principalSignature',
    allow_admit_card_download: 'allowAdmitCardDownload',
    allow_mark_entry: 'allowMarkEntry',
    mark_entry_roll_from: 'markEntryRollFrom',
    mark_entry_roll_to: 'markEntryRollTo',
    allow_marksheet_download: 'allowMarksheetDownload',
    allow_certificate_download: 'allowCertificateDownload',
  };
  const migrationFile: Record<string, string> = {
    allow_admit_card_download: '0033_admit_card_download_permission.sql',
    allow_mark_entry: '0043_mark_entry_permission_and_roll_range.sql',
    mark_entry_roll_from: '0043_mark_entry_permission_and_roll_range.sql',
    mark_entry_roll_to: '0043_mark_entry_permission_and_roll_range.sql',
    allow_marksheet_download: '0038_student_download_permissions.sql',
    allow_certificate_download: '0038_student_download_permissions.sql',
  };
  let selectCols = INSTITUTION_COLUMNS;
  let blockedMigrationCol: string | null = null;
  let { data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(selectCols).single();
  for (let i = 0; i < 7 && error && isPreMigrationError(error); i++) {
    const missingColumn = missingLegacyColumn(error);
    if (!missingColumn) break;
    const dropKey = payloadKey[missingColumn];
    const wasRequested = Boolean(dropKey && data[dropKey] !== undefined);
    if (wasRequested) {
      delete u[missingColumn];
      if (!blockedMigrationCol && missingColumn !== 'principal_signature_url') {
        blockedMigrationCol = missingColumn;
      }
    }
    if (selectCols.includes(`,${missingColumn}`)) {
      selectCols = selectCols.replace(`,${missingColumn}`, '');
    } else if (!wasRequested) {
      break;
    }
    ({ data: result, error } = await supabase.from(SUPABASE_TABLE).update(u).eq('id', id).select(selectCols).single());
  }
  if (error) {
    console.error("[updateInstitution] Supabase error:", error.message, error.code, error.details);
    throw error;
  }
  if (blockedMigrationCol) {
    const migration = migrationFile[blockedMigrationCol] || '0043_mark_entry_permission_and_roll_range.sql';
    throw new Error(
      `Migration ${migration.split('_')[0]} not applied yet — run supabase/migrations/${migration} in the Supabase SQL Editor`
    );
  }
  if (data.name !== undefined && data.name.trim()) {
    await syncInstitutionNameCopies(id, data.name.trim());
  }
  const mapped = mapInstitution(result);
  if (mapped.slug) INSTITUTION_SLUG_CACHE.set(mapped.slug, mapped);
  return mapped;
}

/**
 * Permanently deletes an institution and EVERYTHING that belongs to it —
 * all DB rows (students, registrations, payments, results, certificates,
 * marks, admit cards, exam centers, user notifications, profiles), the
 * stored images, and the login accounts. Delegates to the server action
 * (service role + cascade RPC); throws on failure so the UI can surface it.
 */
export async function deleteInstitution(id: string): Promise<DeleteInstitutionResult> {
  const result = await deleteInstitutionServer(id);
  if (!result.success) throw new Error(result.error || 'Could not delete institution');
  return result;
}

export function useInstitutions() { return useQuery({ queryKey: ['institutions'], queryFn: fetchInstitutions, staleTime: INSTITUTIONS_STALE_TIME }); }

/**
 * Language-aware institution name, same rule as the sidebar / topbar:
 * English UI → `name_en`, Bangla UI → `name`.
 *
 * Records (registrations, payments, results, certificates, students …) carry
 * the Bangla `institution_name`, so pass that string — or the institution id
 * when you have it — and get the localised label back. Unknown names are
 * returned unchanged, so nothing is ever blanked out while the list loads.
 *
 *   const instName = useInstitutionName();
 *   <TableCell>{instName(r.institutionName, r.institutionId)}</TableCell>
 */
export function useInstitutionName() {
  const { lang } = useLang();
  const { data: institutions = [] } = useInstitutions();
  const bn = lang === 'bn';
  return useCallback((value?: string | null, id?: string) => {
    const raw = String(value ?? '').trim();
    const inst =
      (id ? institutions.find((i) => i.id === id) : undefined) ||
      (raw
        ? institutions.find(
            (i) => (i.name || '').trim() === raw || (i.nameEn || '').trim() === raw
          )
        : undefined);
    if (!inst) return raw;
    if (bn) return raw || inst.name;
    return inst.nameEn || raw || inst.name;
  }, [institutions, bn]);
}
export function useInstitutionById(id: string) { return useQuery({ queryKey: ['institutions', id], queryFn: () => fetchInstitutionById(id), enabled: !!id, staleTime: INSTITUTIONS_STALE_TIME }); }
export function useInstitutionBySlug(slug: string) {
  return useQuery({
    queryKey: ['institutions', 'slug', slug],
    queryFn: () => fetchInstitutionBySlug(slug),
    initialData: () => INSTITUTION_SLUG_CACHE.get(slug),
    enabled: !!slug,
    staleTime: INSTITUTIONS_STALE_TIME,
  });
}

export function useUpdateInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Institution> }) => updateInstitution(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institutions'] });
      qc.invalidateQueries({ queryKey: ['registrations'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteInstitution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInstitution(id),
    onSuccess: () => {
      // The wipe spans every dataset (students, registrations, payments,
      // results, certificates, marks, admit cards, profiles, dashboard
      // stats) — refresh everything so no stale count survives.
      qc.invalidateQueries();
    },
  });
}
