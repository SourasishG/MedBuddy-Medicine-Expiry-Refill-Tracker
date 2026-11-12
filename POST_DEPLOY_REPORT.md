# MedBuddy Post-Deploy Audit & Fixes Report

- **Target production URL:** `https://medbuddy-s7ven.vercel.app/` (currently serving `main` @ `828c25a` until merge approval)
- **Fix branch:** `fix/post-deploy` (HEAD @ `8263d6e`, pushed to `origin/fix/post-deploy`)
- **Vercel Preview URL (from GitHub checks):** `https://med-buddy-medicine-expiry-refill-track-git-ae45e2-herric-s-team.vercel.app` (currently HTTP `302` behind Vercel Authentication SSO)
- **Report date:** 12 November 2026

> **Live vs. Branch Status Summary:** Because branch merges to `main` are held pending your approval, **`https://medbuddy-s7ven.vercel.app/` is still running pre-fix `main` (`828c25a`)** — meaning Issues 1, 2, and the offline `/offline` + `/app` precaching gap in Issue 4 are still observable on production until you approve merging `fix/post-deploy` AND remove/update the stale `NEXT_PUBLIC_SITE_URL` value in Vercel Project Settings. All code fixes on `fix/post-deploy` passed `tsc --noEmit`, `eslint .`, and `next build`, and were verified end-to-end on the local production build plus live runtime checks against `https://medbuddy-s7ven.vercel.app/`.

---

## Issue 1: Canonical and Open Graph URLs point to the wrong domain (High)

### What was found

1. Fetching live `https://medbuddy-s7ven.vercel.app/` HTML showed:
   - `<link rel="canonical" href="https://medbuddy.vercel.app"/>`
   - `<meta property="og:url" content="https://medbuddy.vercel.app"/>`
   - `<meta property="og:image" content="https://medbuddy.vercel.app/opengraph-image?..."/>`
   - `/robots.txt` and `/sitemap.xml` emitted `https://MedBuddy.vercel.app` (mixed case), which indicates **Vercel Project Settings -> Environment Variables** currently has `NEXT_PUBLIC_SITE_URL=https://MedBuddy.vercel.app` configured on the project dashboard.
2. Per-route metadata was incomplete:
   - `/privacy` set `alternates.canonical: '/privacy'` but omitted `openGraph.url`, causing `og:url` to stay `https://medbuddy.vercel.app` (homepage).
   - `/app` and `/offline` inherited `/` for both `canonical` and `og:url`.
   - `Install.tsx` and `useInstallPrompt.ts` still used `'https://medbuddy.app'` as SSR/prop fallbacks, and `SECURITY.md` referenced `https://medbuddy.app`.
3. During verification after our first metadata commit (`a99e1e9`), we caught a Next.js shallow-merge regression: adding page-level `openGraph: { ... }` without explicit `images` caused Next.js to drop `og:image` and `twitter:image` on `/`, `/privacy`, and `/app`. We fixed this explicitly before completing Issue 1.

### What changed

- **Commits on `fix/post-deploy`:**
  - `a99e1e9` — `feat(metadata): enhance metadata for various pages and implement SITE_URL normalization`
  - `3fe341d` — `fix: update SITE_URL references to use the new canonical origin`
  - `a442db8` — `fix(seo): preserve absolute Open Graph and Twitter images on every route`
- Added [`src/lib/site.ts`](file:///d:/MedBuddy/src/lib/site.ts) exporting `SITE_URL` (`process.env.NEXT_PUBLIC_SITE_URL`, defaulting to `https://medbuddy-s7ven.vercel.app`) and `OG_IMAGE` (`/opengraph-image`, `1200x630`).
- Added [`.env.example`](file:///d:/MedBuddy/.env.example) documenting `NEXT_PUBLIC_SITE_URL=https://medbuddy-s7ven.vercel.app` (no `.env` committed).
- Updated [`src/app/layout.tsx`](file:///d:/MedBuddy/src/app/layout.tsx), [`src/app/(site)/page.tsx`](<file:///d:/MedBuddy/src/app/(site)/page.tsx>), [`src/app/privacy/page.tsx`](file:///d:/MedBuddy/src/app/privacy/page.tsx), [`src/app/app/page.tsx`](file:///d:/MedBuddy/src/app/app/page.tsx), and [`src/app/offline/layout.tsx`](file:///d:/MedBuddy/src/app/offline/layout.tsx) to emit per-page `canonical`, `og:url`, `og:image`, and `twitter:image` (`noindex, nofollow` preserved on `/offline`).
- Updated [`src/app/robots.ts`](file:///d:/MedBuddy/src/app/robots.ts), [`src/app/sitemap.ts`](file:///d:/MedBuddy/src/app/sitemap.ts), [`src/components/sections/Install.tsx`](file:///d:/MedBuddy/src/components/sections/Install.tsx), [`src/hooks/useInstallPrompt.ts`](file:///d:/MedBuddy/src/hooks/useInstallPrompt.ts), and [`SECURITY.md`](file:///d:/MedBuddy/SECURITY.md) to use `SITE_URL` / `https://medbuddy-s7ven.vercel.app`. Verified zero `ld+json` blocks exist in the codebase.

### How verified

- `git grep -in "medbuddy\.app\|medbuddy\.vercel"` returns **0 matches** across all tracked files.
- Verified rendered HTML on `http://localhost:3100` (with `NEXT_PUBLIC_SITE_URL` unset -> falls back to `https://medbuddy-s7ven.vercel.app`):
  - `/`: `canonical` and `og:url` -> `https://medbuddy-s7ven.vercel.app`; `og:image` & `twitter:image` -> `https://medbuddy-s7ven.vercel.app/opengraph-image`
  - `/privacy`: `canonical` & `og:url` -> `https://medbuddy-s7ven.vercel.app/privacy`; `og:image` & `twitter:image` -> `https://medbuddy-s7ven.vercel.app/opengraph-image`
  - `/app`: `canonical` & `og:url` -> `https://medbuddy-s7ven.vercel.app/app`; `og:image` & `twitter:image` -> `https://medbuddy-s7ven.vercel.app/opengraph-image`
  - `/offline`: `canonical` & `og:url` -> `https://medbuddy-s7ven.vercel.app/offline`; `og:image` & `twitter:image` -> `https://medbuddy-s7ven.vercel.app/opengraph-image`
- Confirmed `https://medbuddy-s7ven.vercel.app/opengraph-image` loads HTTP `200`, `Content-Type: image/png`.

### Still open

- **Vercel Environment Variable override:** `NEXT_PUBLIC_SITE_URL=https://MedBuddy.vercel.app` is still set in your Vercel Project Environment Variables. Until you update or delete it in Vercel Dashboard, Vercel builds will continue injecting `https://MedBuddy.vercel.app` into `SITE_URL`.
- **Preview verification gated by Vercel SSO:** The Preview deployment (`https://med-buddy-medicine-expiry-refill-track-git-ae45e2-herric-s-team.vercel.app`) returned HTTP `302` to `vercel.com/sso-api` (`Protected by Vercel Authentication`), so once you view it logged in (or after merge), spot-check page source of `/` and `/privacy`.

---

## Issue 2: FAQ answer missing (Medium)

### What was found

- All 7 FAQ items in [`src/components/sections/Faq.tsx`](file:///d:/MedBuddy/src/components/sections/Faq.tsx) — including `"Does it work on iPhone and Android?"` (`id: 'platforms'`) — already have full non-empty answers.
- However, live `https://medbuddy-s7ven.vercel.app/` wraps the panel inside `<AnimatePresence>{isOpen && <m.div>...</m.div>}</AnimatePresence>`, which **unmounts items 2–7 from SSR HTML and the DOM** when collapsed (`faqAnswersInHtml: [true, false, false, false, false, false, false]`, `panelExists: false` on collapsed buttons, leaving `aria-controls` pointing to non-existent IDs).

### What changed

- **Commit on `fix/post-deploy`:** `7996063` — `fix(Faq): simplify animation handling by removing AnimatePresence and using conditional rendering`
- Removed `<AnimatePresence>` and conditional `{isOpen && ...}` unmounting in [`src/components/sections/Faq.tsx`](file:///d:/MedBuddy/src/components/sections/Faq.tsx).
- Kept all 7 `<m.div id={panelId} role="region" aria-labelledby={buttonId}>` answer panels mounted in SSR HTML and DOM at all times, animating `height: 0 <-> 'auto'` and `opacity: 0 <-> 1` (`initial={false}`), with `aria-hidden={!isOpen}` and `inert={!isOpen}` when collapsed. Copy and expand/collapse animation feel are unchanged.

### How verified

- Verified on `http://localhost:3100/` cold DOM & SSR HTML: all 7 FAQ panels exist immediately in HTML/DOM (`panelExists: true`, `panelTextLen` 159–214 chars for every item, including `faq-panel-platforms` `184` chars), with `aria-expanded="true"` on item 1 and `"false"` on items 2–7, each `aria-controls` resolving to a mounted panel.
- Verified interactive opening/closing across all 7 rows via **mouse click** (panels expand cleanly to ~109–110px), **keyboard focus/activation** (`faq-btn-platforms` focused cleanly and toggled `aria-expanded` `"false"` -> `"true"`), and **mobile touch (`390x844`, Chrome CDP `touchStart`/`touchEnd`)** (toggled `"false"` -> `"true"`). Zero console/page errors.

### Still open

- Re-verify interactively on live after merging `fix/post-deploy`.

---

## Issue 3: Empty `next-size-adjust` meta tag (Low)

### What was found

- Live `https://medbuddy-s7ven.vercel.app/` renders `<meta name="next-size-adjust" content=""/>` inside `<head>`.
- Zero references to `next-size-adjust` exist anywhere in `src/` or project config (`git grep` clean). It is generated internally by Next.js App Router (`node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js` & `app-render.js`).

### What changed

- None — left untouched per Next.js runtime ownership.

### How verified

- Checked source with `git grep -n "next-size-adjust"` (0 matches in repo) and inspected rendered `<head>` on `https://medbuddy-s7ven.vercel.app/` (`<meta name="next-size-adjust" content=""/>`).

### Still open

- Nothing.

---

## Issue 4: PWA install setup end-to-end verification (High)

### What was found

1. **Manifest, icons, metadata & `/app` route on live `https://medbuddy-s7ven.vercel.app/`:**
   - `/manifest.webmanifest` returns HTTP `200`, `application/manifest+json; charset=utf-8` with exact fields: `name: "MedBuddy"`, `short_name: "MedBuddy"`, `start_url: "/app"`, `scope: "/"`, `display: "standalone"`, `background_color: "#090C12"`, `theme_color: "#090C12"`, `orientation: "portrait"`, and icons `192x192` (`any`), `512x512` (`any`), and `512x512` (`maskable`).
   - All icons (`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`, `/icons/apple-touch-icon.png`) and `/sw.js` load HTTP `200`.
   - `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, and `<meta name="apple-mobile-web-app-title" content="MedBuddy">` are all set.
   - `/app` returns HTTP `200` with the calm `"EARLY ACCESS SHELL · INSTALLED — Ready on your home screen."` page.
   - Chrome CDP `Page.getAppManifest` reported `0` manifest errors, and `Page.getInstallabilityErrors` returned `[]` (page is installable). DevTools Application -> Manifest shows only optional Richer PWA Install UI tips (wide/narrow screenshots) and optional explicit `id: "/app"` tip.
   - Lighthouse checks passed strongly: live `https://medbuddy-s7ven.vercel.app/` scored **Performance 94, Accessibility 100, Best Practices 100, SEO 100**, HTTPS + viewport audits passed.
2. **Real Offline Bug Found & Fixed (`net::ERR_FAILED` on live `medbuddy-s7ven.vercel.app`):**
   - Inspecting the generated `serwist-precache-v2` cache showed `@serwist/next` only precached static `public/` and `_next/static/` assets — **neither `/offline` nor `/app` HTML documents were precached!**
   - Testing true offline mode on live `https://medbuddy-s7ven.vercel.app` (both page and Service Worker CDP targets set offline after cold load + reload) resulted in `net::ERR_FAILED` when navigating to uncached routes or `/app` (`start_url`) before those routes had been visited online!

### What changed

- **Commit on `fix/post-deploy`:** `8263d6e` — `fix(manifest): enhance manifest transformation to include offline shell revision`
- Updated [`next.config.ts`](file:///d:/MedBuddy/next.config.ts) `manifestTransforms` inside `withSerwistInit` to normalize path separators and append deterministic build-hashed entries for **`/offline`** (offline document fallback) and **`/app`** (installed PWA `start_url`) into `__SW_MANIFEST`.

### How verified

- **Updated offline test (`http://localhost:3100` after `8263d6e`):**
  - `serwist-precache-v2` now contains `/offline?__WB_REVISION__=...` and `/app?__WB_REVISION__=...` alongside static/font/poster assets (0 external/unexpected caches, 0 third-party entries).
  - Setting both page and Service Worker targets offline in fresh tabs:
    - Navigating to an uncached path (`/offline-probe-xyz`) served `/offline` cleanly (`"You appear to be offline."`).
    - Navigating to `/app` (`start_url`) served `"Ready on your home screen."` cleanly offline.
- **DevTools & Install Flow Screenshots Captured (artifacts):**
  - Chrome DevTools Application -> Manifest (`postdeploy-devtools-manifest.png` in artifact directory)
  - Chrome DevTools Application -> Service workers (`postdeploy-devtools-sw.png` — `#3 activated and is running`, controlling client)
  - Offline fallback rendered offline (`postdeploy-offline-fallback.png`)
  - Installed `/app` shell (`postdeploy-app-shell.png`)
  - Desktop QR modal (`postdeploy-install-desktop-qr.png`), iPhone Safari install guide (`postdeploy-install-ios-safari.png`), and Standalone `"Open MedBuddy"` CTA -> `/app` (`postdeploy-install-standalone.png`).

### Still open (Physical phone tests required)

Desktop headless Chrome cannot fire OS-level Android APK/WebAPK install prompts or iOS Safari Share-sheet installation UI. Please verify these two on real hardware after deploy:

1. **Android Chrome native prompt:**
   - Open `https://medbuddy-s7ven.vercel.app/` in Android Chrome (clear site data if previously dismissed).
   - Scroll to `08 / INSTALL EARLY ACCESS` and tap **Install MedBuddy**.
   - Confirm the native Chrome **"Install app / Add MedBuddy"** bottom sheet appears; accept it and verify MedBuddy opens standalone at `/app` from your home screen, and turning Airplane Mode ON opens `/app` (or `/offline` when tapping a non-cached link).
   - Return to `https://medbuddy-s7ven.vercel.app/` in standalone/installed context (`?installPreview=standalone` or launched inside installed scope) and verify the CTA reads **"Open MedBuddy"**.
2. **iPhone Safari Add to Home Screen:**
   - Open `https://medbuddy-s7ven.vercel.app/` in Safari on iPhone/iPad.
   - Tap **Install MedBuddy** and confirm the 3-step **Add MedBuddy to your Home Screen** guide appears.
   - Follow **Share -> Add to Home Screen -> Add**, then launch the MedBuddy icon from the home screen and confirm it opens standalone (`black-translucent` status bar, no Safari URL bar) on `"Ready on your home screen."`.

---

## Issue 5: Privacy notice check & accuracy audit (High)

### What was found

1. Checked live `https://medbuddy-s7ven.vercel.app/privacy` ([`src/app/privacy/page.tsx`](file:///d:/MedBuddy/src/app/privacy/page.tsx)):
   - Zero `[RETENTION]`, `[CONFIRM]`, `[HOSTING PROVIDER]` placeholders or author HTML comments exist.
   - Hosting provider is named as **Vercel**, operator as **Sourasish Ghosh** in **Kolkata, India**, and contact email as `ghoshsourasish1@gmail.com`.
2. Audited every factual claim against live Chrome runtime behavior without silently editing any discrepancies:

| Claim in `/privacy`                                                             | Result                                                                            | How checked                                                                                                                                                                                                                                                 |
| :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sets no cookies                                                                 | **PASS**                                                                          | Inspected all `175` HTTP responses (`setCookieResps: []`), `document.cookie` (`""`), and CDP `Network.getAllCookies` (`[]` on `/`, `/privacy`, `/app`).                                                                                                     |
| Loads no analytics or advertising scripts                                       | **PASS**                                                                          | Captured all `Network.requestWillBeSent` on cold load of `/` and `/privacy`: `0` external scripts, strict `CSP script-src 'self' 'unsafe-inline'` & `connect-src 'self'`.                                                                                   |
| Fonts, graphics, and QR code are served from our own site                       | **PASS**                                                                          | Cold-load Network trace showed `175/175` requests same-origin (`thirdPartyReqs: []`). Self-hosted `.woff2` fonts, SVGs/icons, GPU benchmarks, and client-rendered SVG QR (`qrcode.react`) only.                                                             |
| Browser storage matches notice (intro-seen flag vs Motion choice)               | **PASS (Notice matches code; differs from older pre-removal prompt expectation)** | Inspected live `localStorage` (`[]`, `0` keys) and `sessionStorage` (`[["medbuddy-preloader-seen", "1"]]`). Note: `MotionToggle` / `localStorage['medbuddy-motion']` was removed in commit `274d57c`, and `/privacy` already reflects session storage only. |
| Service worker saves site files _"If you install MedBuddy to your home screen"_ | **DISCREPANCY**                                                                   | `/sw.js` registers automatically (`register: true`) on **every visitor's first page load** on `/` and precaches site shell assets into `serwist-precache-v2` even if they never tap Install. (Left unedited per Issue 5 rule 4.)                            |
| Server log retention at Vercel                                                  | **NEEDS CONFIRMATION (`[VERCEL_LOG_RETENTION]`)**                                 | [`src/app/privacy/page.tsx`](file:///d:/MedBuddy/src/app/privacy/page.tsx#L100-L101) currently says _"for up to 1 hour on Vercel’s Hobby plan (or up to 1 day on Pro)"_. Confirm exact retention in Vercel Settings (`[VERCEL_LOG_RETENTION]`).             |

### What changed

- Metadata canonical/OG fixes only (covered under Issue 1 commit `a442db8`). Notice body copy was **not silently altered**.

---

## Needs my decision

1. **Vercel Environment Variable (`NEXT_PUBLIC_SITE_URL`):**
   - Live `/robots.txt` and `/sitemap.xml` currently output `https://MedBuddy.vercel.app`, proving `NEXT_PUBLIC_SITE_URL` is overridden in **Vercel Project -> Settings -> Environment Variables**. Should you update it to `https://medbuddy-s7ven.vercel.app` (or remove it so `src/lib/site.ts`'s default takes effect)? _(Action required in Vercel Dashboard before/with redeploy.)_
2. **Privacy Notice — Service Worker Trigger Wording ([`src/app/privacy/page.tsx`](file:///d:/MedBuddy/src/app/privacy/page.tsx#L114-L116)):**
   - Currently states `"If you install MedBuddy to your home screen"`, whereas `/sw.js` registers automatically on first page visit for all users so offline fallback & fast loads work right away. Do you want to update that table cell to `"On your first visit (and when you install MedBuddy)"`, or change `register` to only register after clicking Install?
3. **Privacy Notice — Vercel Log Retention (`[VERCEL_LOG_RETENTION]`):**
   - Confirm your actual Vercel plan/log-retention setting in Vercel Project Settings vs the current text (`"for up to 1 hour on Vercel’s Hobby plan (or up to 1 day on Pro)"`).
4. **Privacy Notice — Motion Choice Confirmation:**
   - Confirm you are happy keeping the motion toggle removed (`localStorage` stays completely unused `0` keys, matching the current `"session storage only"` text in `/privacy`).
5. **Merge Approval:**
   - `fix/post-deploy` (`8263d6e`) is pushed and verified locally; `main` (`828c25a`) has not been touched. Let me know if you want to adjust `/privacy` wording first or approve merging `fix/post-deploy` into `main` so `https://medbuddy-s7ven.vercel.app/` updates cleanly.
