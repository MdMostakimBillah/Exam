import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Generate secure random password
function generateSecurePassword(length = 24): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  // Ensure at least one of each required type
  if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
  if (!/[a-z]/.test(password)) password = 'a' + password.slice(1);
  if (!/[0-9]/.test(password)) password = '1' + password.slice(1);
  if (!/[!@#$%^&*]/.test(password)) password = '!' + password.slice(1);
  return password;
}

// Generate secure username
function generateSecureUsername(): string {
  const adjectives = ['secure', 'swift', 'bold', 'keen', 'wise', 'firm', 'calm', 'strong'];
  const nouns = ['admin', 'guard', 'chief', 'lead', 'head', 'boss', 'master', 'captain'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${adj}_${noun}_${num}`;
}

async function setupSuperAdmin() {
  console.log('Setting up Super Admin...\n');

  // Check if super admin already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const superAdminExists = existingUsers.users.some(u => 
    u.user_metadata?.role === 'super_admin' || u.email === 'superadmin@scholarx.local'
  );

  if (superAdminExists) {
    console.log('Super admin already exists. Skipping creation.');
    return;
  }

  const username = 'super_admin';
  const email = 'superadmin@scholarx.local';
  const password = 'qvML&v@FgrRZ$qXkUL1qr@*^0J9068ay';

  console.log('Creating super admin with:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Username (display): ${username}`);
  console.log('');

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: 'Super Admin',
      role: 'super_admin',
      username,
    },
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    process.exit(1);
  }

  console.log('Auth user created:', authData.user.id);

  // Create profile in profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      name: 'Super Admin',
      role: 'super_admin',
      username,
    });

  if (profileError) {
    if (profileError.code === '23505') {
      console.log('Profile already exists (created by trigger). Skipping.');
    } else {
      console.error('Error creating profile:', profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      process.exit(1);
    }
  }

  console.log('Profile created successfully');

  // Save credentials to a secure file (for first-time setup only)
  const fs = await import('fs');
  const credentials = {
    email,
    password,
    username,
    created_at: new Date().toISOString(),
    note: 'SAVE THESE CREDENTIALS SECURELY. This file will not be created again.',
  };

  fs.writeFileSync(
    '.super-admin-credentials.json',
    JSON.stringify(credentials, null, 2)
  );

  console.log('\n✅ Super Admin created successfully!');
  console.log('📁 Credentials saved to .super-admin-credentials.json');
  console.log('⚠️  IMPORTANT: Save these credentials and delete the file after first login!');
  console.log('');
  console.log('Login credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
}

setupSuperAdmin().catch(console.error);