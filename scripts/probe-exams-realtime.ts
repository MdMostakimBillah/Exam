/**
 * End-to-end diagnostic for exam-status live sync (migration 0020).
 *
 * 1. Subscribes to postgres_changes on public.exams (service role).
 * 2. Bumps `updated_at` (benign, no semantic change) on one exam.
 * 3. Reports whether the change event arrives.
 *
 * Interpretation:
 *  - event received            → realtime + publication working ✅
 *  - SUBSCRIBED, no event      → exams table NOT in supabase_realtime publication (run 0020)
 *  - CHANNEL_ERROR / timeout   → Realtime disabled on the project
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Minimal .env.local loader
const env: Record<string, string> = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL!;
const key = env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

async function main() {
  const { data: exams, error } = await supabase
    .from('exams')
    .select('id, name, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(3);
  if (error) { console.error('exams select failed:', error.message); process.exit(1); }
  console.log('Current exams:', exams);
  const target = exams![0];
  if (!target) { console.log('No exams to probe.'); process.exit(0); }

  let received = false;
  const channel = supabase
    .channel('probe-exams-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'exams' }, (payload) => {
      received = true;
      console.log('✅ EVENT RECEIVED — realtime publication is active for exams.');
      console.log('   new status:', (payload.new as any).status, '| updated_at:', (payload.new as any).updated_at);
    })
    .subscribe((status) => console.log('channel status:', status));

  // Wait for subscription to settle
  await new Promise((r) => setTimeout(r, 3000));

  console.log(`Bumping updated_at on exam "${target.name}" (${target.status}) …`);
  const { error: updErr } = await supabase
    .from('exams')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (updErr) { console.error('update failed:', updErr.message); }

  await new Promise((r) => setTimeout(r, 8000));

  if (!received) {
    console.log('❌ NO EVENT after update.');
    console.log('   → If channel status was "SUBSCRIBED": exams is NOT in the supabase_realtime publication → RUN migration 0020.');
    console.log('   → If channel status was "CHANNEL_ERROR"/"TIMED_OUT": Realtime is disabled on the Supabase project.');
  }
  await supabase.removeChannel(channel);
  process.exit(received ? 0 : 2);
}

main();
