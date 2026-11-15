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

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testOtp() {
  console.log('--- TESTING EMAIL CODE SIGN-IN FLOW ---');
  const timestamp = Date.now();
  const email = `otp_test_${timestamp}@medbuddy.internal`;

  // 1. Create user
  const { data: userRecord, error: uErr } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (uErr) throw uErr;

  try {
    // 2. Generate a sign-in link with OTP
    console.log(`1. Generating email OTP code for ${email}...`);
    const { data: linkData, error: lErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (lErr) throw lErr;

    const otpCode = linkData.properties.email_otp;
    console.log(`  ✓ Generated OTP Code: ${otpCode}`);

    // 3. Test Invalid OTP Code
    console.log('2. Testing invalid OTP code rejection...');
    const { data: failData, error: failErr } = await anonClient.auth.verifyOtp({
      email,
      token: '000000',
      type: 'email',
    });
    if (failErr) {
      console.log(`  ✓ Invalid OTP correctly rejected: "${failErr.message}"`);
    } else {
      throw new Error('Expected invalid OTP to be rejected, but succeeded!');
    }

    // 4. Test Valid OTP Code
    console.log('3. Testing valid OTP code verification...');
    const { data: successData, error: successErr } = await anonClient.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });

    if (successErr) {
      throw new Error(`Valid OTP verification failed: ${successErr.message}`);
    }

    if (!successData.session || !successData.user) {
      throw new Error('Valid OTP did not return session or user');
    }

    console.log(`  ✓ Valid OTP verified! User authenticated: ${successData.user.id}`);
    console.log(`  ✓ Session Access Token acquired: ${successData.session.access_token.slice(0, 20)}...`);

    console.log('\n✅ EMAIL OTP VERIFICATION FLOW CONFIRMED WORKING!');
  } finally {
    await adminClient.auth.admin.deleteUser(userRecord.user.id);
    console.log('✓ Temporary test user deleted.');
  }
}

testOtp().catch((err) => {
  console.error('❌ OTP Test Failed:', err);
  process.exitCode = 1;
});
