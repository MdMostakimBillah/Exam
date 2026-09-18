import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fixSuperAdminProfile() {
  console.log('Checking super admin profile...\n');

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const superAdmin = existingUsers.users.find(u =>
    u.user_metadata?.role === 'super_admin' || u.email?.includes('admin')
  );

  if (!superAdmin) {
    console.log('No super admin auth user found. Create one in Supabase Dashboard > Auth > Users.');
    return;
  }

  console.log(`Found auth user: ${superAdmin.email} (id: ${superAdmin.id})`);

  // Check if profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', superAdmin.id)
    .single();

  if (profile) {
    console.log(`Profile exists (role: ${profile.role})`);
    if (profile.role !== 'super_admin') {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin', name: 'Super Admin' })
        .eq('id', superAdmin.id);
      console.log('Fixed: role updated to super_admin');
    } else {
      console.log('Profile is correct. Login should work.');
    }
  } else {
    await supabase
      .from('profiles')
      .insert({
        id: superAdmin.id,
        email: superAdmin.email,
        name: 'Super Admin',
        role: 'super_admin',
        username: 'super_admin',
      });
    console.log('Created missing profile with role super_admin');
  }

  console.log(`\nLogin with: ${superAdmin.email}`);
}

fixSuperAdminProfile().catch(console.error);
