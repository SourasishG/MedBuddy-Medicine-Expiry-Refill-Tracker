# MedBuddy Architectural & Design Decisions

## Phase 0: Foundation

1. **Next.js 16 + React 19 + TypeScript Strict**
   - Uses App Router (`src/app/(site)/page.tsx` for the landing page, `src/app/app/page.tsx` for the authenticated PWA).
   - TypeScript `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.

2. **Styling Architecture**
   - SCSS Modules with CSS custom properties defined in `src/styles/tokens.scss`.
   - Zero Tailwind CSS or third-party CSS frameworks.
   - Dark-only palette (`--bg: #090C12`) with explicit `color-scheme: dark`.

3. **Typography (`next/font/google`)**
   - `Instrument_Serif` (400 normal & italic) for display headlines (`--font-serif`).
   - `Manrope` for body and UI (`--font-sans`), minimum 18px body text with `1.6` line height.
   - `JetBrains_Mono` for decorative spec labels and counters (`--font-mono`).

4. **Motion System (`MotionProvider` + Lenis + GSAP)**
   - `useMotionPreference` persists user preference in `localStorage` under `medbuddy-motion` (`'on' | 'off'`), falling back to `!(prefers-reduced-motion: reduce)`.
   - Cross-tab and programmatic updates broadcast via a custom `medbuddy-motion-change` event and `storage` event listener.
   - `MotionProvider` syncs `data-motion="on" | "off"` on `<html>`.
   - `MotionToggle` in `Nav` provides an accessible toggle control (`aria-pressed`).
   - Lenis smooth scroll is wired directly to GSAP `ScrollTrigger` via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add((t) => lenis.raf(t * 1000))` with `gsap.ticker.lagSmoothing(0)`.
   - When Motion is `off`, Lenis is not initialized so native scrolling and static layout apply cleanly without animation lag.

5. **Linting & Formatting**
   - ESLint 9 flat config using `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier`.
   - Prettier configured with single quotes, trailing commas, and 100-char line width.

---

## Phases 1–5: Website, 3D Canvas, Demos & Early-Access PWA Shell

1. **Server-Rendered Landing Page & LCP Poster**
   - `src/app/(site)/page.tsx` stays a Server Component so the hero headline, glass cards, CTAs, and `public/posters/hero-poster.svg` paint immediately without waiting for client hydration.
2. **Procedural 3D Objects & Fallback Tiers**
   - Deferred dynamic loading (`ssr: false`) after first rAF. Three.js / React Three Fiber scene with adaptive quality tiers (`detect-gpu`), pausing frameloop when hidden or scrolled offscreen.
3. **Interactive Demos & Caregiver Timeline**
   - `CabinetDemo` (0–90 days expiry slider) and `Caregivers` (missed dose simulation with glowing thread and alert signal).
4. **PWA Shell & Serwist Service Worker**
   - Web App Manifest (`start_url: '/app'`, `display: 'standalone'`). Precached `/offline` document fallback.

---

## Phase A1: Application Foundation & Scoped Authentication

1. **Strictly Scoped Middleware & Zero Marketing Cookies**
   - The marketing website (`/`, `/privacy`, `/offline`) sets **zero cookies** and runs completely stateless.
   - All session cookie handling is strictly scoped to `/app/*`.
   - Session management uses `@supabase/ssr` with HttpOnly, secure, SameSite=Lax cookies.

2. **Tamper-Resistant App State Cookie (`medbuddy_app_state`)**
   - High-frequency navigation between app screens requires checking user consent and profile creation status.
   - Rather than executing 3 redundant database lookups on every page navigation, middleware sets a short-lived (10-minute), HMAC-SHA256 signed cookie named `medbuddy_app_state`.
   - It caches only the user UUID and two binary flags (`hasConsent`, `hasProfile`).
   - Requires `APP_COOKIE_SECRET` (at least 32 characters). If missing or short, the system securely fails open to direct database lookups.
   - Cleared immediately upon sign-out, consent withdrawal, or account deletion.

3. **Fail-Closed Route Guards**
   - Any database lookup failure or unverified session fails closed, securely redirecting to `/app/sign-in`.
   - Unconsented sessions redirect to `/app/consent`. Users without a profile redirect to `/app/setup`.

---

## Phase A2: Care Profiles & First-Run Setup

1. **First-Run Onboarding Flow**
   - Guided single-step profile creation on `/app/setup` capturing display name and timezone (defaulting to browser IANA timezone).
   - Automatically provisions owner access in `care_access` via `fn_create_care_profile`.

2. **Care Profile Switcher & Settings**
   - Profile switcher bottom sheet accessible from app header.
   - Settings validation for adherence parameters: snooze (5–120 mins, default 10 mins), missed-after (30–720 mins), ensuring missed threshold strictly exceeds re-nudge interval.
   - Row update verification to enforce that only care profile owners can update settings, masking raw database errors with friendly guidance.

---

## Phase A3: Medicine Cabinet & FEFO Inventory Engine

1. **First-Expiry-First-Out (FEFO) Inventory Architecture**
   - Medicines store general metadata (name, strength, form, category, notes, PRN flag).
   - Inventory is tracked in distinct physical boxes (`inventory_items`) with batch numbers, storage locations, initial quantities, and expiry dates.
   - Doses automatically consume stock from the earliest-expiring available box.

2. **Clinical Expiry Bands**
   - 4 standardized visual bands with clear color tokens and WCAG-compliant contrast:
     - `Expired` (<= 0 days left): Crimson alert badge.
     - `Urgent` (1–7 days left): Amber urgency badge.
     - `Soon` (8–30 days left): Soft warning badge.
     - `Fresh` (> 30 days left): Calm green badge.
   - Shelf-life after opening: computed dynamically as `min(expiry_date, opened_on + shelf_life_days)`.

3. **Stock Adjustments & Discard Management**
   - Non-destructive box discards via dedicated `fn_discard_inventory_item` RPC.
   - Audit trail maintained in `stock_movements` with typed reasons (`dose_taken`, `manual_correction`, `discarded_expired`, etc.).

---

## Phase A4: Schedules & Today View

1. **Flexible Schedule Engine**
   - Supports daily schedules, weekday schedules (e.g., Mon/Wed/Fri), interval schedules (every N days), and as-needed (PRN) regimens.
   - Timezone resilience: times stored in local care profile timezone and converted accurately for dose generation.

2. **Today Clinical Sections & Lifecycle**
   - Partitions daily doses into clinical sections:
     - `Due now`: Scheduled doses within current time window or pending adherence.
     - `Later today`: Future scheduled doses for today.
     - `Missed`: Doses unrecorded past the care profile's missed threshold.
     - `Done today`: Logged intakes (taken, skipped).
     - `As needed`: Quick PRN dose logging with remaining supply count and shortfall indicators.
   - Actions: `Taken` (decrements FEFO stock), `Undo` (restores stock), `Snooze` (postpones reminder), `Skip` (records non-intake reason without stock decrement).

---

## Phase A5: Web Push Notifications & Home Screen Install

1. **Privacy-Preserving Web Push (VAPID)**
   - Custom Serwist service worker listeners (`push` and `notificationclick`).
   - Lock-screen privacy toggle (`hide_names_in_notifications`): replaces specific medication names with discreet generic reminders (e.g. "Time for your scheduled medication") on device lock screens.
   - Subscription cool-down and automatic removal of 410/404 expired endpoints.

2. **Platform-Aware Installation Flow**
   - Today install banner dynamically detects iOS Safari vs. installed standalone PWA.
   - Provides step-by-step visual iOS "Add to Home Screen" modal with share-sheet guidance.
   - Android `beforeinstallprompt` hook integration.

---

## Phase A6: Data Rights, Export & Account Deletion

1. **Comprehensive Data Export (`fn_export_my_data`)**
   - Exports complete, machine-readable JSON archive containing profile, consents, care profiles, medicines, inventory items, schedules, dose events, and adherence logs.
   - Zero internal user authentication UUID leakage in export payloads.

2. **Permanent Account Deletion (`fn_delete_my_data`)**
   - Two-step deletion modal requiring explicit uppercase typed confirmation (`DELETE`).
   - Clean database cascade across all 9 relational tables. Shared care profiles transfer ownership to other active owners; sole-owned profiles are erased completely.
   - Verified zero database residuals.

---

## Phase A7: Polish, Verification & Proof

1. **Mandatory Refusal Guard**
   - Automated end-to-end tests refuse to run unless `ALLOW_TEST_USERS=true` is explicitly set, preventing accidental execution against production databases.

2. **Full Golden Path Playwright E2E Suite (`scripts/test-phase-a7.mjs`)**
   - Verified complete user lifecycle: user provisioning -> consent -> profile setup -> add medicine with schedule -> verify initial stock -> log dose taken -> verify stock decrement -> undo dose -> verify stock restored -> delete account -> verify zero residuals.

3. **Lighthouse Audit & Performance Verification**
   - Mobile `/app`:
     - **Accessibility: 100 / 100** (Target: $\ge 95$)
     - **Performance: 87 / 100** (Target: $\ge 85$)
     - **Best Practices: 100 / 100**
   - Mobile `/offline`:
     - **Accessibility: 100 / 100**
     - **Performance: 100 / 100**

4. **Service Worker Cache Privacy Audit**
   - Service worker runtime caching is strictly restricted to same-origin static assets (`/_next/static/`, fonts, images, icons).
   - Verified 0 cached endpoints for Supabase, APIs, auth tokens, or private medical data.
