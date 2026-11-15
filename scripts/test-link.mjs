import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
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
const email = 'cookie_test_' + Date.now() + '@medbuddy.internal';
const password = 'Password123!';
const { data: u } = await adminClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: authData, error: signErr } = await anonClient.auth.signInWithPassword({
  email,
  password,
});
if (signErr) console.error('Sign in error:', signErr);

let writtenCookies = [];
const serverClient = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll: () => [],
      setAll: (c) => {
        writtenCookies = c;
      },
    },
  },
);

await serverClient.auth.setSession({
  access_token: authData.session.access_token,
  refresh_token: authData.session.refresh_token,
});

console.log('Successfully written cookies:');
for (const c of writtenCookies) {
  console.log(`Cookie name: ${c.name}, value length: ${c.value.length}`);
}

await adminClient.auth.admin.deleteUser(u.user.id);
