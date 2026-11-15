import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const email = 'rpc_test_' + Date.now() + '@medbuddy.internal';
const password = 'Password123!';
const { data: u } = await adminClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: authData } = await userClient.auth.signInWithPassword({ email, password });

// insert consent
await userClient
  .from('consents')
  .insert([{ document: 'terms', version: '1.0' }]);

// call fn_create_care_profile
const { data: profileId, error: rpcErr } = await userClient.rpc('fn_create_care_profile', {
  p_name: 'Alex River',
  p_is_me: true,
  p_timezone: 'Asia/Kolkata',
});

console.log('RPC result:', { profileId, rpcErr });

await adminClient.auth.admin.deleteUser(u.user.id);
