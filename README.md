# MedBuddy

> **Every dose. Every expiry. Every loved one.**

A calm, privacy-first medicine expiry, refill, and adherence tracker built with Next.js 16, React 19, TypeScript, Supabase, and Serwist PWA.

[![Live on Vercel](https://img.shields.io/badge/Live%20Demo-medbuddy--s7ven.vercel.app-090C12?style=for-the-badge&logo=vercel&logoColor=white)](https://medbuddy-s7ven.vercel.app/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Serwist-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://serwist.pages.dev/)

---

## Overview

MedBuddy is designed to eliminate the anxiety of managing prescription medicines, opened syrups, eye drops, and refills. It combines a state-of-the-art marketing landing experience with a fully functional, privacy-first web application.

- **Production URL:** [https://medbuddy-s7ven.vercel.app/](https://medbuddy-s7ven.vercel.app/)
- **Core Routes:**
  - `/` — Marketing site with interactive 3D capsule canvas, expiry demo slider, and caregiver timeline.
  - `/app` — Today adherence screen (Due now, Later today, Missed, Done today, As needed).
  - `/app/cabinet` — Medicine inventory list with 4 clinical expiry bands and stock counters.
  - `/app/medicine/[id]` — Medicine detail view with box ledger, schedules, and stock adjustment tools.
  - `/app/medicine/add` — Guided 3-step medicine onboarding (info -> physical box -> schedule).
  - `/app/settings` — Care profile settings, notification preferences, VAPID push setup, JSON data export, and permanent account deletion.
  - `/app/privacy` — App Privacy Notice (_"Draft: needs legal review before launch"_).
  - `/privacy` — Website privacy notice (explicitly documenting zero cookies on marketing routes).
  - `/offline` — Precached service worker offline fallback screen.

---

## Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Client PWA                     │
│  - App Shell & Navigation (/app, /app/cabinet, /settings)   │
│  - Serwist Service Worker (Static assets precache only)     │
│  - React Query (Optimistic mutations & cache invalidation)  │
└──────────────┬───────────────────────────────┬──────────────┘
               │ HTTPS                         │ Web Push (VAPID)
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Next.js 16 Server       │ │     Supabase Backend       │
│  - Scoped Middleware:        │ │  - PostgreSQL 16 with RLS  │
│    * /: Zero cookies         │ │  - Supabase Auth (SSR)     │
│    * /app: medbuddy_app_state│ │  - Security Definer RPCs   │
│  - Fail-Closed Route Guards  │ │  - pg_cron Schedule Engine │
│  - Dynamic SSR Metadata      │ │  - Notification Pipeline   │
└──────────────────────────────┘ └────────────────────────────┘
```

### Key Technical Pillars

1. **Scoped Middleware & Cookie Isolation**:
   - The marketing site (`/`, `/privacy`, `/offline`) sets **zero cookies** and runs completely stateless.
   - The authenticated app (`/app/*`) uses HttpOnly, Secure, SameSite=Lax `@supabase/ssr` cookies.
   - An essential HMAC-SHA256 signed `medbuddy_app_state` cookie caches verified onboarding state (10-minute TTL) to eliminate redundant database queries on page navigation.

2. **First-Expiry-First-Out (FEFO) Inventory Engine**:
   - Doses automatically deduct stock from the earliest-expiring available box.
   - Opened bottle countdowns dynamically calculate `min(expiry_date, opened_on + shelf_life_days)`.
   - Undo restores consumed stock back to the original physical batch box.

3. **Privacy-Preserving Web Push (VAPID)**:
   - Direct browser push notifications with zero third-party trackers or cross-site analytics.
   - Lock-screen privacy toggle (`hide_names_in_notifications`) sanitizes notification text on device lock screens.

4. **Self-Service Data Rights**:
   - One-click machine-readable JSON data export (`fn_export_my_data`).
   - Permanent account deletion (`fn_delete_my_data`) with typed confirmation (`DELETE`), executing a clean cascade across all database tables with verified zero residuals.

5. **Strict Service Worker Privacy**:
   - Serwist precaches only same-origin static assets (`/_next/static/`, fonts, images, icons, `/offline`, `/app`).
   - Explicitly rejects caching any cross-origin requests, `/api/`, `/rest/`, `/auth/`, or requests with Authorization headers.

---

## Tech Stack

| Domain              | Technologies                                                                                |
| :------------------ | :------------------------------------------------------------------------------------------ |
| **Framework**       | Next.js 16.4.6 (App Router, Webpack), React 19.3.1, TypeScript 5.8.3                        |
| **Styling**         | SCSS Modules, CSS Custom Properties, Dark Glassmorphism, Zero CSS Frameworks                |
| **Backend**         | Supabase (PostgreSQL 16, Row Level Security, pg_cron, Database Functions)                   |
| **State & Data**    | TanStack React Query 5.107, `@supabase/ssr` 0.12, Zod 4.6                                   |
| **PWA & Offline**   | Serwist 9.5 (`@serwist/next`), Web App Manifest, Service Worker                             |
| **3D & Motion**     | Three.js 0.187, React Three Fiber 9.8, Drei 10.7, GSAP 3.15, Framer Motion 14.12, Lenis 1.3 |
| **Quality & Tests** | Playwright 1.65, Node Test Runner, ESLint 9, Prettier 3                                     |

---

## Local Development Setup

### 1. Prerequisites

- Node.js 20+ (Node 22 or 24 recommended)
- PostgreSQL client (`psql`) installed and in PATH (for database scenario testing)

### 2. Clone and Install

```bash
git clone https://github.com/SourasishG/MedBuddy-Medicine-Expiry-Refill-Tracker.git
cd MedBuddy-Medicine-Expiry-Refill-Tracker
npm install
```

### 3. Environment Variables

Create `.env.local` based on `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_COOKIE_SECRET=your-32-char-random-secret-key-here
ALLOW_TEST_USERS=true
TEST_BASE_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Test Suite

MedBuddy includes a comprehensive automated test matrix spanning unit tests, database scenarios, security audits, and Playwright end-to-end user journeys:

### Complete Test Matrix

```bash
# 1. Typecheck & Lint
npm run typecheck
npm run lint

# 2. Code Style Formatting
npm run format:check

# 3. Production Build
npm run build

# 4. Database Scenario Tests (PSQL + RLS)
npm run db:test

# 5. Push Notification Sender Verification
node scripts/test-notification-sender.mjs

# 6. Backend & Scheduler Health Check
npm run health

# 7. Security Audit (No Service Role Key in Client)
node scripts/check-no-service-key.mjs

# 8. Service Worker Privacy Audit
node scripts/check-sw.mjs

# 9. Playwright End-to-End Golden Path Suite
node scripts/test-phase-a7.mjs
```

---

## Lighthouse & Accessibility Benchmark

Tested with mobile device emulation against production build:

| Metric                           | Score         | Target   | Result   |
| :------------------------------- | :------------ | :------- | :------- |
| **Accessibility (/app)**         | **100 / 100** | $\ge 95$ | **PASS** |
| **Performance (/app Mobile)**    | **87 / 100**  | $\ge 85$ | **PASS** |
| **Best Practices (/app)**        | **100 / 100** | —        | **PASS** |
| **Accessibility (/offline)**     | **100 / 100** | $\ge 95$ | **PASS** |
| **Performance (/offline)**       | **100 / 100** | $\ge 85$ | **PASS** |
| **Accessibility (/app/sign-in)** | **100 / 100** | $\ge 95$ | **PASS** |
| **Performance (/app/sign-in)**   | **87 / 100**  | $\ge 85$ | **PASS** |

---

## Medical Disclaimer

MedBuddy is a medication adherence, expiry, and refill tracking tool. It is not a medical device and does not provide medical advice, diagnosis, or clinical recommendations. Always consult your physician or pharmacist for clinical guidance.
