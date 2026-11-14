# MedBuddy Setup & Credentials Checklist (Phase F0 Review Update)

This document provides exact, click-by-click instructions and copy-paste commands for setting up and verifying the MedBuddy backend services (Supabase, Authentication, SMTP, Web Push, Vault, and Edge Functions).

---

## 1. Credentials Classification: Public vs Secret

| Variable / Credential           | Classification | Where It Goes                                       | Exposure Risk                                               |
| ------------------------------- | -------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | **Public**     | `.env.local`, Vercel (Production & Preview)         | None (Public website URL)                                   |
| `NEXT_PUBLIC_SUPABASE_URL`      | **Public**     | `.env.local`, Vercel                                | None (PostgREST / Auth endpoint)                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public**     | `.env.local`, Vercel                                | Safe in browser; RLS enforces row access                    |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | **Public**     | `.env.local`, Vercel                                | Safe in browser; used by browser to register push           |
| `SUPABASE_SERVICE_ROLE_KEY`     | 🚨 **SECRET**  | `.env.local` (local admin/tests only)               | **Bypasses RLS**. NEVER expose in browser or commit to Git  |
| `VAPID_PRIVATE_KEY`             | 🚨 **SECRET**  | `.env.local`, Supabase Edge Function Secrets        | Signs push notifications. NEVER expose in browser or Git    |
| `VAPID_SUBJECT`                 | **Config**     | `.env.local`, Supabase Edge Function Secrets        | Contact mailto for push services (`mailto:...`)             |
| `CRON_SECRET`                   | 🚨 **SECRET**  | `.env.local`, Supabase Vault, Edge Function Secrets | Authenticates internal cron trigger to sender. NEVER commit |
| Supabase DB Password            | 🚨 **SECRET**  | Password Manager, `.env.local` (admin tests)        | Grants superuser database access                            |
| Brevo SMTP Password             | 🚨 **SECRET**  | Supabase Project Settings (Custom SMTP)             | Allows sending transactional emails                         |
| Google OAuth Client Secret      | 🚨 **SECRET**  | Supabase Authentication (Providers -> Google)       | Authenticates OAuth handshake with Google                   |
| Cloudflare Turnstile Secret     | 🚨 **SECRET**  | Supabase Authentication (Bot Protection)            | Verifies CAPTCHA tokens server-side                         |

> [!CAUTION]
> **Secrets never go in Git.** All secrets must remain in `.env.local` (which is in `.gitignore`), Supabase Vault / Secrets, or Vercel Environment Variables. Never commit `.env` or paste secrets into tracked repository files.

---

## 2. Setup Progress Summary

| Item   | Service / Component            | Status                  | Details                                                               |
| ------ | ------------------------------ | ----------------------- | --------------------------------------------------------------------- |
| **1**  | Supabase Project               | ✅ Completed            | Ref: `fenqdaymgofxozjgcppt` (Mumbai, `ap-south-1`)                    |
| **2**  | Google OAuth Sign-in           | ✅ Completed            | Configured in Google Cloud & Supabase Auth Providers                  |
| **3**  | Email Sign-in by Code (OTP)    | ⏳ Action Needed        | Template update in Supabase Dashboard (see Section 3.4)               |
| **4**  | Site & Redirect URLs           | ✅ Completed            | `https://medbuddy-s7ven.vercel.app` & `http://localhost:3000/**`      |
| **5**  | Custom SMTP (Brevo)            | ✅ Completed            | `smtp-relay.brevo.com:587` connected & verified                       |
| **6**  | Cloudflare Turnstile (CAPTCHA) | ⏳ Optional/Recommended | Free abuse protection setup (see Section 3.5)                         |
| **7**  | Web Push Keys (VAPID)          | ✅ Generated & Set      | NIST P-256 pair in `.env.local` and Edge Function secrets             |
| **8**  | Supabase Vault Secrets         | ✅ Completed            | `cron_secret` and `project_url` verified in Vault                     |
| **9**  | Edge Function Deployment       | ✅ Deployed             | Deployed with `--no-verify-jwt`; update in Phase F2 (see Section 3.3) |
| **10** | Dev Project Isolation          | ℹ️ Guidance             | Guidance on second dev project vs single project (see Section 3.6)    |

---

## 3. Action Items & Exact Commands

### 3.1 Supabase Vault Secrets (Action Needed)

The scheduler requires **two secrets** stored in Supabase Vault so `pg_net` / `pg_cron` can dynamically look them up without hardcoding credentials in migrations:

1. `cron_secret`: Shared secret token matching Edge Function `CRON_SECRET`.
2. `project_url`: Base URL of your Supabase project with **no trailing slash** (`https://fenqdaymgofxozjgcppt.supabase.co`).

#### Exact SQL to run in Supabase SQL Editor:

1. Open [Supabase Dashboard -> SQL Editor](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt/sql).
2. Run the check query:

```sql
-- 1. Check existing vault secrets
select id, name, created_at from vault.decrypted_secrets;
```

3. If `project_url` is missing, create it by running:

```sql
-- 2. Create project_url secret (NO trailing slash)
select vault.create_secret('https://fenqdaymgofxozjgcppt.supabase.co', 'project_url');
```

4. If `cron_secret` is missing or needs updating to match your `.env.local` value:

```sql
-- 3. Create cron_secret (replace <your-cron-secret> with value from .env.local)
select vault.create_secret('<your-cron-secret>', 'cron_secret');
```

5. Confirm both secrets appear in `vault.decrypted_secrets`:

```sql
select id, name, created_at from vault.decrypted_secrets;
```

---

### 3.2 Edge Function Secrets (Verified & Command Reference)

The `send-notifications` Edge Function requires 4 secrets. Supabase automatically injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

To update or set secrets via Supabase CLI, run:

```bash
npx supabase secrets set CRON_SECRET="<value-from-env-local>" VAPID_PRIVATE_KEY="<value-from-env-local>" VAPID_PUBLIC_KEY="<value-from-env-local>" VAPID_SUBJECT="<value-from-env-local>"
```

To list and verify current secrets:

```bash
npx supabase secrets list
```

---

### 3.3 Deploy the Edge Function (Command Reference)

Deploy the `send-notifications` function with JWT verification disabled (because requests are authenticated via the `x-cron-secret` header from `pg_net`):

```bash
npx supabase functions deploy send-notifications --no-verify-jwt
```

---

### 3.4 Email Sign-in Code Template (Action Needed)

MedBuddy uses passwordless sign-in via a 6-digit one-time code (OTP). Ensure the email template displays the 6-digit code:

1. Open [Supabase Dashboard -> Authentication -> Email Templates](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt/auth/templates).
2. Click on the **Magic Link** tab.
3. Replace the Subject and Body:

**Subject:**

```
Your MedBuddy verification code: {{ .Token }}
```

**Body:**

```html
<h2>Sign in to MedBuddy</h2>
<p>Enter the 6-digit verification code below to sign in:</p>
<div
  style="background-color: #f3f4f6; border-radius: 8px; padding: 16px 24px; display: inline-block; margin: 16px 0;"
>
  <span
    style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827;"
    >{{ .Token }}</span
  >
</div>
<p style="color: #6b7280; font-size: 14px;">
  This code will expire in 10 minutes. If you did not request this, you can safely ignore this
  email.
</p>
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
<p style="color: #9ca3af; font-size: 12px;">
  MedBuddy &mdash; Every dose on time, every medicine safe.
</p>
```

4. Click **Save Changes**.
5. Under **Authentication** -> **Providers** -> **Email**, verify:
   - **Enable Email provider**: ON
   - **Confirm email**: ON
   - **Mailer OTP expiration**: 600 seconds (10 minutes)

---

### 3.5 Abuse Protection: Cloudflare Turnstile (Recommended)

1. Log in to [Cloudflare Dashboard -> Turnstile](https://dash.cloudflare.com/).
2. Click **Add Site**:
   - **Site name**: `MedBuddy Auth`
   - **Domain**: `medbuddy-s7ven.vercel.app` (and add `localhost`)
   - **Widget Mode**: Managed
3. Copy **Site Key** and **Secret Key**.
4. In [Supabase Dashboard -> Authentication -> Bot Protection](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt/auth/protection):
   - Toggle **Enable CAPTCHA protection** to ON.
   - Provider: **Cloudflare Turnstile**.
   - Enter **Site Key** and **Secret Key**, then click **Save**.

---

### 3.6 Separate Development Project Guidance

- **Recommendation:** Before real users sign up, create a second free Supabase project (e.g. `medbuddy-dev`) so automated smoke tests (`ALLOW_TEST_USERS=true`) never touch production data.
- **Single Project Note:** If the free plan limits your account to 1 project, `fenqdaymgofxozjgcppt` can be used for testing during active development. Automated smoke tests clean up after themselves in a `finally` block. This decision is tracked in `docs/DECISIONS.md`.

---

### 3.7 Verify Scheduler & Vault Health

Verify that the scheduler and Vault secrets are properly configured without exposing secrets:

```bash
npm run health
```

Must return:

```text
Scheduler Health Verdict: OK
All scheduler checks passed cleanly.
```

---

## 4. Phase F0 Action Checklist

Please perform the following actions:

1. [x] Run the SQL in Section 3.1 to add `project_url` to Supabase Vault:
   ```sql
   select vault.create_secret('https://fenqdaymgofxozjgcppt.supabase.co', 'project_url');
   ```
2. [x] Confirm the Magic Link email template in Section 3.4 shows `{{ .Token }}`.
3. [x] All Phase F0 setup items completed and verified.
