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

const EMAIL = 'superadmin@scholarx.local';
const PASSWORD = 'SuperAdmin@2024!';

async function setupSuperAdmin() {
  console.log('Setting up Super Admin...\n');

  // 1. Find existing user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers.users.find(u => u.email === EMAIL);

  let userId: string;

  if (existing) {
    console.log(`User ${EMAIL} already exists (id: ${existing.id})`);
    userId = existing.id;

    // Reset password to ensure it works
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Super Admin',
        role: 'super_admin',
        username: 'super_admin',
      },
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      process.exit(1);
    }
    console.log('Password reset successfully');
  } else {
    // Create new user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Super Admin',
        role: 'super_admin',
        username: 'super_admin',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      process.exit(1);
    }
    userId = authData.user.id;
    console.log('Auth user created:', userId);
  }

  // 2. Ensure profile exists with correct role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (profile) {
    console.log(`Profile exists (role: ${profile.role})`);
    if (profile.role !== 'super_admin') {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'super_admin', name: 'Super Admin' })
        .eq('id', userId);
      if (error) {
        console.error('Error updating profile role:', error);
      } else {
        console.log('Profile role updated to super_admin');
      }
    }
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: EMAIL,
        name: 'Super Admin',
        role: 'super_admin',
        username: 'super_admin',
      });
    if (error) {
      console.error('Error creating profile:', error);
    } else {
      console.log('Profile created with role super_admin');
    }
  }

  // 3. Save credentials
  const fs = await import('fs');
  fs.writeFileSync(
    '.super-admin-credentials.json',
    JSON.stringify({ email: EMAIL, password: PASSWORD, created_at: new Date().toISOString() }, null, 2)
  );

  console.log('\n========================================');
  console.log('Super Admin ready!');
  console.log('========================================');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log('========================================\n');
}

setupSuperAdmin().catch(console.error);
