# MedBuddy Setup & Credentials Checklist (Phase B0)

This document provides exact, click-by-click instructions for setting up the MedBuddy backend services (Supabase, Authentication, SMTP, Web Push, and Schedulers).

---

## 1. Credentials Classification: Public vs Secret

| Variable / Credential | Classification | Where It Goes | Exposure Risk |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **Public** | `.env.local`, Vercel (Production & Preview) | None (Public website URL) |
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | `.env.local`, Vercel | None (PostgREST / Auth endpoint) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** | `.env.local`, Vercel | Safe in browser; RLS enforces row access |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | **Public** | `.env.local`, Vercel | Safe in browser; used by browser to register push |
| `SUPABASE_SERVICE_ROLE_KEY` | 🚨 **SECRET** | `.env.local` (local admin/tests only) | **Bypasses RLS**. NEVER expose in browser or commit to Git |
| `VAPID_PRIVATE_KEY` | 🚨 **SECRET** | `.env.local`, Supabase Edge Function Secrets | Signs push notifications. NEVER expose in browser or Git |
| `VAPID_SUBJECT` | **Config** | `.env.local`, Supabase Edge Function Secrets | Contact mailto for push services (`mailto:...`) |
| `CRON_SECRET` | 🚨 **SECRET** | `.env.local`, Supabase Vault, Supabase Edge Function Secrets | Authenticates internal cron trigger to sender. NEVER commit |
| Supabase DB Password | 🚨 **SECRET** | Password Manager only | Grants superuser database access |
| Brevo SMTP Password | 🚨 **SECRET** | Supabase Project Settings (Custom SMTP) | Allows sending transactional emails |
| Google OAuth Client Secret | 🚨 **SECRET** | Supabase Authentication (Providers -> Google) | Authenticates OAuth handshake with Google |
| Cloudflare Turnstile Secret | 🚨 **SECRET** | Supabase Authentication (Bot Protection) | Verifies CAPTCHA tokens server-side |

> [!CAUTION]
> **Secrets never go in Git.** All secrets must remain in `.env.local` (which is in `.gitignore`), Supabase Vault / Secrets, or Vercel Environment Variables. Never commit `.env` or paste secrets into tracked repository files.

---

## 2. Setup Progress Summary

| Item | Service / Component | Status | Details |
|---|---|---|---|
| **1** | Supabase Project | ✅ Completed | Ref: `fenqdaymgofxozjgcppt` (Mumbai, `ap-south-1`) |
| **2** | Google OAuth Sign-in | ✅ Completed | Configured in Google Cloud & Supabase Auth Providers |
| **3** | Email Sign-in by Code (OTP) | ⏳ Action Needed | Template update in Supabase Dashboard (see Section 3.3) |
| **4** | Site & Redirect URLs | ✅ Completed | `https://medbuddy-s7ven.vercel.app` & `localhost:3000` |
| **5** | Custom SMTP (Brevo) | ✅ Completed | `smtp-relay.brevo.com:587` connected & verified |
| **6** | Cloudflare Turnstile (CAPTCHA) | ⏳ Optional/Recommended | Free abuse protection setup (see Section 3.6) |
| **7** | Web Push Keys (VAPID) | ✅ Generated | NIST P-256 pair in `.env.local`; ready for Edge Function secrets |
| **8** | Cron Secret & Vault | ⏳ Action Needed | Run SQL snippet in Supabase SQL Editor (see Section 3.8) |
| **9** | Dev Project Isolation | ℹ️ Guidance | Use `fenqdaymgofxozjgcppt` as dev until launch (see Section 3.9) |

---

## 3. Click-by-Click Instructions

### 3.1 Supabase Project (Completed)
- **Region**: Mumbai (`ap-south-1`).
- **Project Ref**: `fenqdaymgofxozjgcppt`
- **Project URL**: `https://fenqdaymgofxozjgcppt.supabase.co`
- **Database Password**: Stored securely in your password manager.

---

### 3.2 Google Sign-in (Completed)
- **Google Cloud Console**: OAuth 2.0 Web Application client created.
- **Authorized Redirect URI**: `https://fenqdaymgofxozjgcppt.supabase.co/auth/v1/callback`
- **Supabase Dashboard**: Authentication -> Providers -> Google enabled with Client ID & Client Secret.

---

### 3.3 Email Sign-in by 6-digit Code (Action Needed)
MedBuddy uses passwordless sign-in via a 6-digit one-time code (OTP). We must ensure the email template clearly renders the 6-digit code:

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt).
2. Go to **Authentication** (left sidebar, key icon) -> **Email Templates**.
3. Click on the **Magic Link** template tab.
4. Replace the Subject and Body with the following template:

**Subject:**
```
Your MedBuddy verification code: {{ .Token }}
```

**Body:**
```html
<h2>Sign in to MedBuddy</h2>
<p>Enter the 6-digit verification code below to sign in:</p>
<div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px 24px; display: inline-block; margin: 16px 0;">
  <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827;">{{ .Token }}</span>
</div>
<p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
<p style="color: #9ca3af; font-size: 12px;">MedBuddy &mdash; Every dose on time, every medicine safe.</p>
```

5. Click **Save Changes**.
6. Verify under **Authentication** -> **Providers** -> **Email**:
   - **Enable Email provider**: ON
   - **Confirm email**: ON (recommended)
   - **Secure email change**: ON
   - **Mailer OTP expiration**: 600 seconds (10 minutes)

---

### 3.4 URLs & Redirect Allow-list (Completed)
- **Supabase Dashboard** -> **Authentication** -> **URL Configuration**:
  - **Site URL**: `https://medbuddy-s7ven.vercel.app`
  - **Redirect URLs**:
    - `http://localhost:3000/**`
    - `https://medbuddy-s7ven.vercel.app/**`

---

### 3.5 Custom SMTP via Brevo (Completed)
- **Supabase Dashboard** -> **Project Settings** -> **Authentication** -> **SMTP Settings**:
  - **Sender Email**: `ghoshsourasish1@gmail.com`
  - **Sender Name**: `MedBuddy`
  - **Host**: `smtp-relay.brevo.com`
  - **Port**: `587`
  - **User**: `c31af7001@smtp-brevo.com`
  - **Encryption**: TLS
- Tested and verified operational.

---

### 3.6 Abuse Protection: Cloudflare Turnstile (Recommended)
Cloudflare Turnstile is 100% free and provides invisible/low-friction bot protection for authentication endpoints:

1. Sign up / Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left menu, select **Turnstile**.
3. Click **Add Site**:
   - **Site name**: `MedBuddy Auth`
   - **Domain**: `medbuddy-s7ven.vercel.app` (and add `localhost` for local development)
   - **Widget Mode**: Managed (Interactive only when suspicious) or Non-interactive.
4. Click **Create** and copy:
   - **Site Key** (Public)
   - **Secret Key** (Secret)
5. In [Supabase Dashboard](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt):
   - Go to **Authentication** -> **Bot Protection / Security**.
   - Enable **Enable CAPTCHA protection**.
   - Provider: **Cloudflare Turnstile**.
   - Paste **Turnstile Site Key** and **Turnstile Secret Key**.
   - Click **Save**.

---

### 3.7 Web Push Keys (VAPID) (Ready)
A native NIST P-256 keypair has already been generated and saved into your untracked `.env.local`:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Used by browsers in frontend to subscribe to Web Push.
- `VAPID_PRIVATE_KEY`: Secret key used by the Supabase Edge Function (`send-notifications`) to sign push requests.
- `VAPID_SUBJECT`: `mailto:ghoshsourasish1@gmail.com` (identification contact for web push relays).

**Action for Supabase Edge Functions** (when deploying Phase B2):
Set these secrets in Supabase via Supabase CLI:
```bash
npx supabase secrets set VAPID_PRIVATE_KEY="<YOUR_VAPID_PRIVATE_KEY>" VAPID_SUBJECT="mailto:ghoshsourasish1@gmail.com"
```
*(Or via Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets).*

---

### 3.8 Cron Secret & Supabase Vault (Action Needed)
A 32-byte hex `CRON_SECRET` has been generated:
```
d48ba104cbed0e4252e766799e7353e35587653ca74de3ed2b4f1bc8f44f569a
```

We must store this secret in Supabase Vault so the `pg_cron` / `pg_net` database scheduler can read it securely when triggering the Edge Function, without ever hardcoding it in SQL:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/fenqdaymgofxozjgcppt) -> **SQL Editor**.
2. Click **New Query**.
3. Paste and run the following command:

```sql
select vault.create_secret(
  'd48ba104cbed0e4252e766799e7353e35587653ca74de3ed2b4f1bc8f44f569a',
  'cron_secret'
);
```

4. Confirm it returns a UUID secret ID.
5. In Phase B2, we will also set this as the Edge Function secret:
```bash
npx supabase secrets set CRON_SECRET="d48ba104cbed0e4252e766799e7353e35587653ca74de3ed2b4f1bc8f44f569a"
```

---

### 3.9 Development Project vs Production (Guidance)
Supabase free tier provides up to **2 free projects** per account.
- **Option A (Recommended if you want complete separation):** Create a second free Supabase project named `medbuddy-dev` in Mumbai (`ap-south-1`). We run migrations, `supabase/tests/schema_scenario.sql`, and `scripts/smoke-test.mjs` against `medbuddy-dev` so production remains 100% pristine.
- **Option B (Single project):** If you prefer to use one project for now, `fenqdaymgofxozjgcppt` is completely fresh and empty. We treat it as development during Phase B1–B4, run our tests, verify everything, and run clean resets.

---

## 4. Ready to Proceed?

Once you have completed:
1. Item 3.3 (Email template with `{{ .Token }}`)
2. Item 3.8 (Run Vault SQL snippet in Supabase SQL Editor)
3. Decide on Option A vs B for Item 3.9

Reply with:
- **"done"**
- Your choice: Option A (new dev project ref) or Option B (use `fenqdaymgofxozjgcppt` as dev).
