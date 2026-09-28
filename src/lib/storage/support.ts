import { SupportReport, SupportCategory, SupportStatus } from '../types';
import { createClient } from '@/lib/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type { SupportReport, SupportCategory, SupportStatus };

const TABLE = 'support_reports';

const REPORT_COLUMNS =
  'id,user_id,institution_id,institution_name,reporter_name,reporter_email,reporter_phone,category,subject,message,status,admin_note,created_at,updated_at';

function mapReport(data: any): SupportReport {
  return {
    id: data.id,
    userId: data.user_id ?? undefined,
    institutionId: data.institution_id ?? undefined,
    institutionName: data.institution_name ?? undefined,
    reporterName: data.reporter_name,
    reporterEmail: data.reporter_email ?? undefined,
    reporterPhone: data.reporter_phone ?? undefined,
    category: data.category,
    subject: data.subject,
    message: data.message,
    status: data.status,
    adminNote: data.admin_note ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** Super admin inbox: every report, newest first. */
export async function fetchSupportReports(): Promise<SupportReport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(REPORT_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapReport);
}

/** Reports filed by the signed-in user (RLS already restricts the rows). */
export async function fetchMySupportReports(userId: string): Promise<SupportReport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(REPORT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapReport);
}

export interface CreateSupportReportInput {
  userId: string;
  institutionId?: string;
  institutionName?: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  category: SupportCategory;
  subject: string;
  message: string;
}

export async function createSupportReport(input: CreateSupportReportInput): Promise<SupportReport> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: input.userId,
      institution_id: input.institutionId ?? null,
      institution_name: input.institutionName ?? null,
      reporter_name: input.reporterName,
      reporter_email: input.reporterEmail ?? null,
      reporter_phone: input.reporterPhone ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
    })
    .select(REPORT_COLUMNS)
    .single();
  if (error) throw error;

  // Best-effort: ping every super admin so the inbox is seen promptly.
  // The SECURITY DEFINER helper from migration 0008 does the insert;
  // a missing grant/function must never fail the reporter's submission.
  try {
    const { error: notifyError } = await supabase.rpc('create_notification_for_super_admins', {
      p_title: 'New support report',
      p_message: `${input.institutionName ? input.institutionName + ' — ' : ''}${input.subject}`,
      p_type: 'warning',
      p_link: '/super-admin/support',
    });
    if (notifyError) console.warn('[createSupportReport] notification skipped:', notifyError.message);
  } catch {
    // notification is a convenience, not part of the write contract
  }

  return mapReport(data);
}

/** Super admin: change status and/or leave a reply. */
export async function updateSupportReport(
  id: string,
  data: { status?: SupportStatus; adminNote?: string },
): Promise<SupportReport | undefined> {
  const supabase = createClient();
  const payload: any = { updated_at: new Date().toISOString() };
  if (data.status !== undefined) payload.status = data.status;
  if (data.adminNote !== undefined) payload.admin_note = data.adminNote;
  const { data: result, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(REPORT_COLUMNS)
    .single();
  if (error) return undefined;
  return mapReport(result);
}

export async function deleteSupportReport(id: string): Promise<boolean> {
  const { error } = await createClient().from(TABLE).delete().eq('id', id);
  return !error;
}

export function useSupportReports() {
  return useQuery({
    queryKey: ['support_reports'],
    queryFn: fetchSupportReports,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // the inbox picks up new reports on its own
  });
}

export function useMySupportReports(userId: string) {
  return useQuery({
    queryKey: ['support_reports', 'mine', userId],
    queryFn: () => fetchMySupportReports(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function useCreateSupportReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportReport,
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['support_reports'] });
      if (vars.userId) qc.invalidateQueries({ queryKey: ['support_reports', 'mine', vars.userId] });
    },
  });
}

export function useUpdateSupportReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: SupportStatus; adminNote?: string } }) =>
      updateSupportReport(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support_reports'] }),
  });
}

export function useDeleteSupportReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupportReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support_reports'] }),
  });
}

// ============================================================
// Help desk contact (system_settings, category "helpdesk")
// Readable by everyone (the public /help page shows it),
// writable by the super admin only.
// ============================================================

const HELPLINE_KEYS = ['helpdeskPhone', 'helpdeskEmail', 'helpdeskHours'] as const;

export interface HelpdeskContact {
  phone: string;
  email: string;
  hours: string;
}

export const HELPDESK_DEFAULTS: HelpdeskContact = { phone: '', email: '', hours: '' };

export async function fetchHelpdeskContact(): Promise<HelpdeskContact> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('system_settings')
    .select('key,value')
    .in('key', [...HELPLINE_KEYS]);
  if (error || !data) return { ...HELPDESK_DEFAULTS };
  const map = Object.fromEntries(data.map((s: any) => [s.key, s.value]));
  return {
    phone: map.helpdeskPhone ?? '',
    email: map.helpdeskEmail ?? '',
    hours: map.helpdeskHours ?? '',
  };
}

export function useHelpdeskContact() {
  return useQuery({
    queryKey: ['helpdesk_contact'],
    queryFn: fetchHelpdeskContact,
    staleTime: 60 * 1000,
  });
}

/** Super admin: save the number every institution is told to call. */
export async function saveHelpdeskContact(contact: HelpdeskContact): Promise<void> {
  const supabase = createClient();
  const rows = [
    { key: 'helpdeskPhone', value: contact.phone, category: 'helpdesk' },
    { key: 'helpdeskEmail', value: contact.email, category: 'helpdesk' },
    { key: 'helpdeskHours', value: contact.hours, category: 'helpdesk' },
  ];
  for (const row of rows) {
    const { error } = await supabase.from('system_settings').upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
}

export function useSaveHelpdeskContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveHelpdeskContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['helpdesk_contact'] }),
  });
}
