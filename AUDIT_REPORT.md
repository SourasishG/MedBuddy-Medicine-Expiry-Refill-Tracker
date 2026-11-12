# MedBuddy — Codebase Audit Report (Phase 0–3)

**Branch:** `audit/cleanup`  
**Audit Date:** 12 November 2026  
**Scope:** Full audit, targeted hardening & cleanup, and before/after verification across `src/`, `public/`, root configuration files, compiled `.next` production build, and live production runtime at `http://localhost:3000`. All visual styling, copy, smooth scrolling (`Lenis`), animations (`Preloader`, `GSAP`, `Framer Motion` `layout`), and 3D shaders/scene interactions remain intact.

---

## Before vs. After Summary (Phase 0 vs. Phase 3)

| Metric / Check                               | Before (Phase 0)                                                        | After (Phase 3)                                                                                      | Change                       |
| -------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Lighthouse Mobile Performance**            | `74` (FCP `2.6 s`, LCP `2.6 s`, TBT `810 ms`, TTI `5.0 s`, CLS `0.004`) | **`79`** (FCP `2.4 s`, LCP `2.4 s`, TBT `590 ms`, TTI `4.6 s`, CLS `0.004`)                          | **`+5` pts** (`-220 ms` TBT) |
| **Lighthouse Accessibility / BP / SEO**      | `100` / `100` / `100`                                                   | **`100` / `100` / `100`**                                                                            | Preserved                    |
| **HTTP Security Headers (`next.config.ts`)** | `0` custom headers (only `X-Powered-By` off)                            | **6 headers** (`CSP`, `HSTS`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) | Hardened (Verified live)     |
| **Console Errors / Exceptions / Failed Req** | `0` / `0` / `0`                                                         | **`0` / `0` / `0`**                                                                                  | Clean                        |
| **Console Warnings**                         | `1` on `/` (`THREE.Clock`), `0` elsewhere                               | `1` on `/` (`THREE.Clock` upstream R3F), `0` elsewhere                                               | Unchanged upstream           |
| **Route JS Gzipped — `/` (full loaded)**     | `669.7 KB` (`27` chunks)                                                | `669.5 KB` (`25` chunks)                                                                             | `-0.2 KB` (`-2` chunks)      |
| **Route JS Gzipped — `/` (pre-3D initial)**  | `177.0 KB`                                                              | `179.9 KB` (`noModule` excluded)                                                                     | `+2.9 KB` (Under `200 KB`)   |
| **Route JS Gzipped — `/app`**                | `272.1 KB` (`15` chunks)                                                | **`162.6 KB`** (`9` chunks)                                                                          | **`-109.5 KB` (`-40.2%`)**   |
| **Route JS Gzipped — `/privacy`**            | `298.8 KB` (`17` chunks)                                                | **`180.3 KB`** (`9` chunks)                                                                          | **`-118.5 KB` (`-39.7%`)**   |
| **Route JS Gzipped — `/offline`**            | `272.4 KB` (`15` chunks)                                                | **`162.8 KB`** (`9` chunks)                                                                          | **`-109.6 KB` (`-40.2%`)**   |
| **TypeScript / ESLint / Prettier / Build**   | `0` errors / `1` `eslint-disable`                                       | **`0` errors / `0` `eslint-disable`**                                                                | Clean                        |
| **Viewport Overflow (`360`–`1920`)**         | `false` across 5 breakpoints                                            | **`false` across 5 breakpoints** (`360×800` to `1920×1080`)                                          | Verified                     |
| **Interactive & Keyboard Verification**      | Missing modal/drawer Tab traps & backdrop click                         | **Tab traps, first-link focus, backdrop close, Escape, slider, alerts verified**                     | Fixed & verified             |

### Phase 2 Remediations Applied

- **`B-01` Security Headers ([next.config.ts](file:///d:/MedBuddy/next.config.ts)) & [SECURITY.md](file:///d:/MedBuddy/SECURITY.md):** Added strict CSP (`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`), HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Verified live across `/`, `/app`, `/privacy`, and `/offline` with `0` CSP violations and active Three.js WebGL + `/sw.js`.
- **`B-03` Environment Hygiene ([.gitignore](file:///d:/MedBuddy/.gitignore)):** Updated `.env*.local` to `.env*` with `!.env.example` exception.
- **`A-01` WebGL Resilience ([SceneLoader.tsx](file:///d:/MedBuddy/src/components/scene/SceneLoader.tsx), [useGpuTier.ts](file:///d:/MedBuddy/src/hooks/useGpuTier.ts)):** Added React `SceneErrorBoundary` around `<DynamicScene>` invoking fallback on runtime canvas errors, added real WebGL context creation probe on `.catch()` failures, and attached a `matchMedia('(max-width: 959px)')` listener.
- **`A-02` `SplitText` Lifecycle ([Hero.tsx](file:///d:/MedBuddy/src/components/sections/Hero.tsx), [Problem.tsx](file:///d:/MedBuddy/src/components/sections/Problem.tsx)):** Awaited `document.fonts.ready` before splitting lines and invoked `split.revert()` on animation completion (`0` leftover `overflow: hidden` DOM wrappers verified live).
- **`A-03` Render Loop Allocation ([PillHelix.tsx](file:///d:/MedBuddy/src/components/scene/PillHelix.tsx)):** Hoisted `LOCK_SLOTS` outside `useFrame` to eliminate 60fps per-frame array allocations.
- **`A-04` Responsive Scroll Choreography ([scrollTimeline.ts](file:///d:/MedBuddy/src/lib/scrollTimeline.ts)):** Migrated static `isDesktop` check to `gsap.matchMedia()` rules (`(min-width: 960px)` / `(max-width: 959px)`).
- **`A-05` Focus Management & Traps ([InstallModal.tsx](file:///d:/MedBuddy/src/components/ui/InstallModal.tsx), [Nav.tsx](file:///d:/MedBuddy/src/components/ui/Nav.tsx)):** Added `Tab`/`Shift+Tab` focus wrapping in both `InstallModal` and the mobile navigation drawer, automatic first-link focus when opening the mobile drawer, backdrop click-outside dismissal, and `inert` on the hidden desktop header install slot.
- **`A-06` iOS Safe Areas & Anchor Scroll Alignment ([layout.tsx](file:///d:/MedBuddy/src/app/layout.tsx), [Nav.module.scss](file:///d:/MedBuddy/src/components/ui/Nav.module.scss), [Preloader.module.scss](file:///d:/MedBuddy/src/components/ui/Preloader.module.scss), [InstallModal.module.scss](file:///d:/MedBuddy/src/components/ui/InstallModal.module.scss), [app.module.scss](file:///d:/MedBuddy/src/app/app/app.module.scss), [base.scss](file:///d:/MedBuddy/src/styles/base.scss)):** Enabled `viewportFit: 'cover'`, added `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` offsets, and set `scroll-margin-top` on `section[id]` anchors.
- **`A-08`–`A-11` Type Narrowing & Lifecycle Cleanup ([Caregivers.tsx](file:///d:/MedBuddy/src/components/sections/Caregivers.tsx), [Install.tsx](file:///d:/MedBuddy/src/components/sections/Install.tsx), [RingHalo.tsx](file:///d:/MedBuddy/src/components/scene/RingHalo.tsx), [SafeHtmlTransform.tsx](file:///d:/MedBuddy/src/components/scene/SafeHtmlTransform.tsx), [Cursor.tsx](file:///d:/MedBuddy/src/components/ui/Cursor.tsx), [useInstallPrompt.ts](file:///d:/MedBuddy/src/hooks/useInstallPrompt.ts)):** Replaced `!` and unsafe `as` casts with `instanceof` / runtime type guards, cleaned up modal clipboard timeout, removed the only `eslint-disable` suppression via `useCallback` + `mountedRef`, switched `/app` link to `<Link>`, and added `suppressHydrationWarning` on the copyright year.
- **`C-01`, `C-03`–`C-05`, `C-07` Bundle Isolation & Dead Code Removal ([LandingStage.tsx](file:///d:/MedBuddy/src/components/sections/LandingStage.tsx), [layout.tsx](file:///d:/MedBuddy/src/app/layout.tsx), [useIsHydrated.ts](file:///d:/MedBuddy/src/hooks/useIsHydrated.ts)):** Scoped `<SmoothScrollProvider>` to `LandingStage` (`-40%` JS gzipped across `/app`, `/privacy`, and `/offline`), deleted dead `src/app/(site)/page.module.scss`, removed unused `@mixin hairline-border` and `--duration-reveal`, dropped unused `export` keywords on internal symbols, and consolidated hydration detection in `useIsHydrated`.

### Intentionally Retained / Deferred Items

- **`B-02` `npm audit` build/dev advisories (`12` alerts):** Retained `@serwist/next@9.5.13` because `npm audit fix --force` downgrades to breaking `8.4.4`; documented as build/dev-only with zero browser exposure in [SECURITY.md](file:///d:/MedBuddy/SECURITY.md).
- **`A-07` `THREE.Clock` warning:** Comes from upstream `@react-three/fiber` + `three@0.187.0`; left untouched to preserve verified 3D compatibility until `@react-three/fiber` adopts `THREE.Timer`.
- **`C-02` `Preloader` cold-load visual sequence:** Intentionally kept intact so first-visit choreography, smoothness, and visual impact match design (`Performance` improved from `74` to `79` cleanly via dead-weight & TBT reductions without altering `Preloader` timing).
- **`B-04` Privacy Notice row copy & `C-06` PNG icon binaries:** Copy kept verbatim per project rules; PWA PNG assets kept unmodified visually.

---

## Phase 0: Baseline Measurements ("Before")

### 1. Static Checks & Build

- `npm ci`: Exit `0` (`444` packages audited; `12` vulnerabilities: `8 moderate`, `4 high`, all in build/lint dependencies — see Section B).
- `npm run typecheck` (`tsc --noEmit`): `0` errors, `0` warnings.
- `npm run lint` (`eslint .`): `0` errors, `0` warnings (`1` `eslint-disable-next-line react-hooks/exhaustive-deps` suppression in [src/components/sections/Caregivers.tsx#L50](file:///d:/MedBuddy/src/components/sections/Caregivers.tsx#L50)).
- `npm run format:check` (`prettier --check .`): Passed (`0` formatting issues).
- `npm run build` (`next build --webpack`): Exit `0`, compiled in `3.6s`, Serwist generated `/sw.js` (`47,137 B`), `11/11` static routes generated (`/`, `/_not-found`, `/app`, `/icon.svg`, `/manifest.webmanifest`, `/offline`, `/opengraph-image`, `/privacy`, `/robots.txt`, `/sitemap.xml`).

### 2. Live Production Runtime (`next start -p 3000`)

| Route / Viewport              | Console Errors | Console Warnings               | Failed Requests | External Requests | Horizontal Overflow |
| ----------------------------- | -------------- | ------------------------------ | --------------- | ----------------- | ------------------- |
| `/` (`390×844`)               | `0`            | `1` (`THREE.Clock` deprecated) | `0`             | `0`               | `false` (`390px`)   |
| `/` (`1440×900`)              | `0`            | `1` (`THREE.Clock` deprecated) | `0`             | `0`               | `false` (`1440px`)  |
| `/` (`360×800`)               | `0`            | `1` (`THREE.Clock` deprecated) | `0`             | `0`               | `false` (`360px`)   |
| `/` (`768×1024`, `1920×1080`) | `0`            | `—`                            | `0`             | `0`               | `false`             |
| `/app` (`1440×900`)           | `0`            | `0`                            | `0`             | `0`               | `false`             |
| `/privacy` (`1440×900`)       | `0`            | `0`                            | `0`             | `0`               | `false`             |
| `/offline` (`1440×900`)       | `0`            | `0`                            | `0`             | `0`               | `false`             |

### 3. Production JS Transfer & Top 10 Largest Chunks

Measured via live Chrome network capture mapped against `.next/static/chunks` (full loaded JS including post-paint dynamic imports):

| Route                                           | Loaded JS Chunks | Raw JS       | Gzipped JS |
| ----------------------------------------------- | ---------------- | ------------ | ---------- |
| `/` (full scene + GSAP + Lenis + Framer)        | `27`             | `2,105.6 KB` | `669.7 KB` |
| `/` (initial before 3D chunk, Phase 6 baseline) | `—`              | `—`          | `177.0 KB` |
| `/app`                                          | `15`             | `825.5 KB`   | `272.1 KB` |
| `/privacy`                                      | `17`             | `909.2 KB`   | `298.8 KB` |
| `/offline`                                      | `15`             | `826.2 KB`   | `272.4 KB` |

Top 10 largest client chunks on disk (`.next/static/chunks`):

1. `bd904a5c.9bd4e9c1bb00749f.js` — `376.8 KB` raw / `99.9 KB` gzip (`three`)
2. `b536a0f1.cd1d680a4282bcdc.js` — `359.5 KB` raw / `86.3 KB` gzip (`three`)
3. `f6211eb1.ca6bedb2bca579eb.js` — `94.5 KB` raw / `69.2 KB` gzip (`gsap` + `ScrollTrigger` + `SplitText`)
4. `framework-7db505987826b98f.js` — `213.8 KB` raw / `67.3 KB` gzip (`react` / `react-dom`)
5. `5254-51bed4fa5a685b5c.js` — `240.7 KB` raw / `67.0 KB` gzip (`next` shared + `serwist` / `framer-motion` core)
6. `4131.3f75d202ac3e8be8.js` — `185.4 KB` raw / `64.9 KB` gzip (`framer-motion` `domMax`)
7. `4bd1b696-e199e788e58acf79.js` — `198.9 KB` raw / `62.6 KB` gzip (`next` React client runtime)
8. `e49654ac.14b29e115e7e932a.js` — `161.9 KB` raw / `51.1 KB` gzip (`@react-three/fiber` / `drei` / `postprocessing`)
9. `main-9b51de167073d14e.js` — `133.4 KB` raw / `39.3 KB` gzip (`next` router runtime)
10. `polyfills-42372ed130431b0a.js` — `110.0 KB` raw / `38.7 KB` gzip (`nomodule` / browser polyfills)

### 4. Lighthouse Mobile (4× CPU Throttle / Slow 4G) & PWA Check

- **Performance:** `74` (FCP `2.6 s`, LCP `2.6 s`, CLS `0.004`, TBT `810 ms`, Speed Index `2.7 s`, TTI `5.0 s`)
- **Accessibility:** `100`
- **Best Practices:** `100`
- **SEO:** `100`
- **PWA Installability:** `/manifest.webmanifest` HTTP `200` (`start_url: "/app"`, `scope: "/"`, `display: "standalone"`, `192`/`512`/`maskable` PNG icons present); `/sw.js` HTTP `200` and `activated` on scope `/`; `/offline` fallback route pre-rendered.

### 5. Dev-only Audit Tools Used

- `npx knip` (ephemeral check; not added to `package.json`)
- `npx depcheck` (ephemeral check; not added to `package.json`)
- `npx lighthouse` (ephemeral check; not added to `package.json`)

---

## Phase 1: Summary of Findings by Severity

| Severity     | Count |
| ------------ | ----- |
| **Critical** | `0`   |
| **High**     | `3`   |
| **Medium**   | `11`  |
| **Low**      | `11`  |
| **Total**    | `25`  |

---

## Section A — Bugs and Correctness

### [High] `A-01`: Missing React ErrorBoundary and true WebGL context probe for `<Canvas>` initialization failure

- **File & Line:** `src/components/scene/SceneLoader.tsx:45-57` and `src/hooks/useGpuTier.ts:15-18, 104-112`
- **What is wrong:** `hasWebGLInterface()` only checks `'WebGLRenderingContext' in window || 'WebGL2RenderingContext' in window`, and `useGpuTier`'s `.catch()` branch sets `tier: isMobile ? 'medium' : 'high'` with `isWebGLAvailable: true`. Meanwhile `SceneLoader.tsx` renders `<DynamicScene>` without a React ErrorBoundary. If a browser exposes `WebGLRenderingContext` but blocks or fails context creation (disabled hardware acceleration, GPU blocklist, exhausted contexts), R3F `<Canvas>` throws synchronously before `onCreated` runs, never triggering `onFallbackToPoster` (`webglcontextlost`).
- **Why it matters:** A WebGL initialization failure crashes the landing stage instead of cleanly showing the static poster fallback required by the fallback-tier spec.
- **Proposed fix:** Wrap `<DynamicScene>` in a small React ErrorBoundary inside `SceneLoader.tsx` that calls `setContextFailed(true)` and `onSceneReadyChange?.(false)` on error; also test actual context creation once or downgrade `.catch()` safely when WebGL context probe returns `null`.

### [Medium] `A-02`: `SplitText` never reverts DOM wrappers after reveal and splits before `document.fonts.ready`

- **File & Line:** `src/components/sections/Hero.tsx:40-58` and `src/components/sections/Problem.tsx:46-61`
- **What is wrong:** `Hero.tsx` and `Problem.tsx` create `SplitText.create(..., { type: 'lines', mask: 'lines' })` and only call `split.revert()` on component unmount (in `Hero.tsx` cleanup or `ctx.revert()` in `Problem.tsx`), rather than reverting once the reveal finishes (`onComplete`), and do not await `document.fonts.ready`.
- **Why it matters:** Line wrapper divs with `overflow: hidden` stay in the DOM permanently; if `Instrument Serif` swaps in late or the user resizes the browser window, line wrapping can misalign or clip descenders.
- **Proposed fix:** Guard with `await document.fonts.ready` before `SplitText.create` (with `cancelled` check) and call `split.revert()` in `onComplete`.

### [Medium] `A-03`: Per-frame heap allocations inside `PillHelix` render loop (`useFrame`)

- **File & Line:** `src/components/scene/PillHelix.tsx:174-179`
- **What is wrong:** `const lockSlots: Array<[number, number, number]> = [...]` allocates five fresh arrays inside `useFrame` on every rendered frame (`60fps`).
- **Why it matters:** Unnecessary garbage-collection churn during scroll and pointer movement.
- **Proposed fix:** Hoist `LOCK_SLOTS` to a module-level constant outside the component.

### [Medium] `A-04`: `scrollTimeline.ts` captures desktop/mobile breakpoint once instead of responding to resizes

- **File & Line:** `src/lib/scrollTimeline.ts:36, 110-162`
- **What is wrong:** `const isDesktop = window.matchMedia('(min-width: 960px)').matches;` is evaluated once on mount inside `gsap.context(...)`. Resizing across `960px` (e.g., tablet orientation change) keeps stale desktop pins (`+=2200`) or mobile offsets.
- **Why it matters:** Resizing between mobile and desktop widths misaligns the `#how-it-works` pin and `sceneTargets` coordinates.
- **Proposed fix:** Replace `gsap.context` + static `isDesktop` with `gsap.matchMedia()` rules (`(min-width: 960px)` vs `(max-width: 959px)`).

### [Medium] `A-05`: Missing Tab focus trap in `InstallModal` and mobile drawer in `Nav`

- **File & Line:** `src/components/ui/InstallModal.tsx:137-153` and `src/components/ui/Nav.tsx:53-63, 134-190`
- **What is wrong:** `InstallModal` sets `aria-modal="true"` and handles `Escape`, and `Nav` handles `Escape` on its mobile drawer, but neither traps `Tab`/`Shift+Tab` inside the active dialog/drawer, and `Nav`'s `.drawerBackdrop` lacks an outside-click handler (`onClick` on backdrop). Also opening the mobile drawer in `Nav.tsx` does not move focus into the drawer.
- **Why it matters:** Keyboard-only users can Tab out behind the modal/drawer overlay.
- **Proposed fix:** Trap `Tab`/`Shift+Tab` within `InstallModal` and the open mobile `Nav` drawer, focus the first link/control on mobile drawer open, and close the mobile drawer on backdrop click.

### [Medium] `A-06`: Missing iOS Safari `viewport-fit=cover` and `env(safe-area-inset-*)` padding

- **File & Line:** `src/app/layout.tsx:82-87`, `src/components/ui/Nav.module.scss:12-27`, `src/components/ui/Preloader.module.scss:94-112`, `src/components/ui/InstallModal.module.scss:3-14`, `src/app/app/app.module.scss:3-9`
- **What is wrong:** `layout.tsx` configures `appleWebApp: { statusBarStyle: 'black-translucent' }`, which renders content behind the iOS status bar in standalone PWA mode, yet `viewport` omits `viewportFit: 'cover'` and fixed UI containers omit `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`.
- **Why it matters:** On notched iPhones installed to Home Screen, the top nav bar and bottom modal/skip controls can sit too close to the Dynamic Island or home-indicator bar.
- **Proposed fix:** Add `viewportFit: 'cover'` to `viewport` in `layout.tsx` and add `env(safe-area-inset-*)` additions to fixed header, modal, preloader, and shell padding.

### [Medium] `A-07`: `THREE.Clock` deprecation warning in production console

- **File & Line:** `src/components/scene/Scene.tsx:99` (`@react-three/fiber` internal `Clock` with `three@0.187.0`)
- **What is wrong:** Mounting `<Canvas>` logs `[Warning] THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` in the browser console.
- **Why it matters:** Produces a recurring runtime console warning on `/` whenever WebGL mounts (comes from upstream `@react-three/fiber` v9 using `new THREE.Clock()` against `three@0.187`). Listed under **Needs my decision** because downgrading `three` or patching R3F requires dependency approval.

### [Low] `A-08`: Uncleaned `setTimeout` in `InstallModal` clipboard feedback and missing live breakpoint update in `useInstallPrompt` / `useGpuTier`

- **File & Line:** `src/components/ui/InstallModal.tsx:163-171`, `src/hooks/useInstallPrompt.ts:70`, `src/hooks/useGpuTier.ts:49`
- **What is wrong:** `InstallModal` calls `window.setTimeout(() => setCopied(false), 2000)` without clearing the timer on unmount/close (`setCopied` on unmounted component risk). Meanwhile `useInstallPrompt` and `useGpuTier` read `matchMedia('(min-width: 960px)')` / `'(max-width: 959px)'` without subscribing to `change` events.
- **Why it matters:** Minor edge-case stale timer / unreactive viewport resize.
- **Proposed fix:** Track and clear `copyTimerRef` in `useEffect` cleanup in `InstallModal.tsx`; subscribe to media query `change` if responsive tier/platform switching on live resize is desired.

### [Low] `A-09`: Missing `cancelled` guard on async GSAP import in `Caregivers.tsx` and suppressed `react-hooks/exhaustive-deps`

- **File & Line:** `src/components/sections/Caregivers.tsx:16-51`
- **What is wrong:** `triggerMissedEvent()` triggers `void import('@/lib/gsap').then(...)` without checking an unmount/motion guard before mutating `sceneTargets`, and the `useEffect` suppresses `react-hooks/exhaustive-deps` on line 50.
- **Why it matters:** Cleanliness and strict React Hooks safety.
- **Proposed fix:** Inline or wrap `triggerMissedEvent` in `useCallback` with a `mountedRef` check and remove the `eslint-disable-next-line` comment.

### [Low] `A-10`: TypeScript non-null assertions (`!`) and `as` type casts in 3D/UI files

- **File & Line:**
  - `src/components/scene/RingHalo.tsx:76-81, 85, 89-90` (`uniforms.uTime!`, `as THREE.Vector2`)
  - `src/components/scene/PillHelix.tsx:153, 184, 213` (`uniforms.uTime!`, `items[idx]!`, `lockSlots[idx]!`)
  - `src/components/scene/SafeHtmlTransform.tsx:109, 253` (`events.connected as HTMLElement | null`, `as HTMLElement | undefined`)
  - `src/components/ui/Cursor.tsx:37` (`event.target as HTMLElement | null` — `event.target` can be `SVGElement`)
  - `src/hooks/useInstallPrompt.ts:25, 100` (`navigator as ...`, `event as BeforeInstallPromptEvent`)
  - `src/components/ui/InstallModal.tsx:139` (`document.activeElement as HTMLElement | null`)
- **What is wrong:** Non-null assertions and `as` casts bypass strict TypeScript narrowing.
- **Why it matters:** Potential runtime null dereference if uniform keys or array bounds change; `event.target instanceof Element` and `'standalone' in navigator` are runtime-checked.
- **Proposed fix:** Replace `!` and unsafe `as` casts with runtime `if` / `instanceof` type guards.

### [Low] `A-11`: Year hydration edge case & raw `<a>` link for `/app` in `Install.tsx`

- **File & Line:** `src/components/sections/Install.tsx:76, 147`
- **What is wrong:** Line 76 uses `<a href="/app">` instead of Next `<Link href="/app">`; line 147 renders `new Date().getFullYear()` without `suppressHydrationWarning` (edge-case UTC vs local timezone mismatch across New Year's Eve midnight).
- **Why it matters:** Client navigation consistency and avoiding a hydration warning during timezone rollover.
- **Proposed fix:** Use `<Link href="/app">` on line 76 and add `suppressHydrationWarning` on the year span (or static `'2026'`).

---

## Section B — Security & Compliance

### [High] `B-01`: Zero HTTP security headers configured (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)

- **File & Line:** `next.config.ts:11-15` (verified live on response headers from `/`, `/app`, `/privacy`, `/offline`)
- **What is wrong:** `poweredByHeader: false` is set, and `0` third-party requests exist, but no `headers()` configuration exists in `next.config.ts`. Responses omit `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `X-Frame-Options` / `frame-ancestors`.
- **Why it matters:** Without CSP and clickjacking/MIME protections, the site has no browser-enforced defense-in-depth against framing, MIME-sniffing, or injected inline scripts. Note: Next.js App Router inline hydration scripts and R3F/Serwist require carefully tested CSP directives (`script-src` / `style-src` / `worker-src 'self'` / `connect-src 'self'` / `img-src 'self' data: blob:`). See **Needs my decision**.
- **Proposed fix:** Add a `headers()` rule in `next.config.ts` (and verify CSP cleanly with live `/`, `/app`, `/privacy`, and `/sw.js`).

### [High] `B-02`: `npm audit` reports 4 High and 8 Moderate transitive build-time vulnerabilities

- **File & Line:** `package.json:18, 29, 38` and `package-lock.json`
- **What is wrong:** `npm audit` flags:
  - **4 High:** `zod < 4.6.6` (GHSA-mrhx-c7xc-m3w5, memory exhaustion on constrained collections) inside `@serwist/next` / `@serwist/build` / `@serwist/webpack-plugin`.
  - **8 Moderate:** `glob 9.0.0–14.0.1` (GHSA-3g3m-2fjr-6pw4) inside `@serwist/build`, and `minimatch 7.0.0–11.0.0` (GHSA-g3hv-75wg-m249) inside `glob` and `@typescript-eslint/*` (`eslint-config-next`).
- **Why it matters:** Note that **none** of these vulnerable packages ship to the browser runtime (`next`, `react`, `three`, `gsap`, `lenis`, `framer-motion`, `detect-gpu`, `qrcode.react`, and `serwist` worker have **0** vulnerabilities). However, `npm audit fix --force` recommends downgrading `@serwist/next` to breaking `8.4.4`. See **Needs my decision**.
- **Proposed fix:** Either accept as build/dev-only with documentation or test npm `overrides` (`zod`, `glob`, `minimatch`) cleanly against `npm run build` and `npm run lint`.

### [Medium] `B-03`: `.gitignore` ignores `.env*.local` only, leaving `.env`, `.env.production`, `.env.development` unignored

- **File & Line:** `.gitignore:16`
- **What is wrong:** Line 16 reads `.env*.local`, so `.env`, `.env.development`, `.env.production` are NOT ignored if created locally. (Note: git history and working tree currently contain **zero** `.env*` files or secrets, and the only env var `NEXT_PUBLIC_SITE_URL` is non-sensitive.)
- **Why it matters:** Risk of accidentally committing local/environment `.env` files later.
- **Proposed fix:** Replace `.env*.local` with `.env*` and `!.env.example` (if ever added) in `.gitignore`.

### [Medium] `B-04`: Privacy Notice wording slightly narrower than Serwist's default auto-registration behaviour

- **File & Line:** `src/app/privacy/page.tsx:105-109` (`PRIVACY_NOTICE.md:31`)
- **What is wrong:** All three `[CONFIRM]` claims in `PRIVACY_NOTICE.md` are **TRUE** against the build (`0` cookies, `0` analytics/ad scripts, `0` third-party requests — fonts, QR SVGs, and `detect-gpu` `/benchmarks` JSONs are all self-hosted). However, row 3 in the table states service worker files are saved _"If you install MedBuddy to your home screen"_, whereas `@serwist/next` registers `/sw.js` automatically in production for **all** visitors (precaching static shell assets locally on the visitor's device). Note also `localStorage['medbuddy-motion']`, `sessionStorage['medbuddy-preloader-seen']`, and local `detect-gpu` benchmark reads are accurately reflected.
- **Why it matters:** Legal/privacy accuracy: first-time browser visitors also receive cached service worker files locally, even without installing to the home screen.
- **Proposed fix:** Clarify copy in `src/app/privacy/page.tsx:106` (e.g., _"When you visit the site or install MedBuddy to your home screen"_) — flagged in **Needs my decision** because hard rules forbid altering copy without approval.

### Passed Security & Content Checks (Verified Clean)

- **Secrets:** `0` API keys, tokens, credentials, or `.env*` files found in workspace or git history. `NEXT_PUBLIC_SITE_URL` is purely a public canonical domain.
- **XSS / Injection:** `0` uses of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or unsanitized query injection (`tier` & `installPreview` query params are allowlisted to exact enum string literals).
- **External Links & `mailto:`:** `0` `target="_blank"` links; `mailto:ghoshsourasish1@gmail.com` contains no user-controlled data.
- **Third Parties:** `0` external requests on cold load across all routes.
- **Production Build:** `0` `.map` source-map files in `.next/static`; `0` `console.log` statements; `0` debug routes (`installPreview` & `tier` query flags are documented below under Needs my decision).
- **Content & Honesty Rules:** Medical disclaimer appears verbatim on `/`, `/app`, and `/privacy`. `0` fake stats, testimonials, badges, or medical advice claims.

---

## Section C — Unnecessary Code and Weight

### [Medium] `C-01`: `SmoothScrollProvider` wraps global `RootLayout`, forcing Lenis + GSAP + Framer Motion onto `/app`, `/privacy`, and `/offline`

- **File & Line:** `src/app/layout.tsx:5, 102` and `src/components/ui/SmoothScrollProvider.tsx:7-54`
- **What is wrong:** `RootLayout` wraps every route in `<SmoothScrollProvider>`, which eagerly dynamically imports `@/lib/lenis`, `@/lib/gsap` (`ScrollTrigger` + `SplitText`), and `framer-motion` (`domMax` `LazyMotion`) on routes that use **none** of them (`/app` `272.1 KB` gz, `/offline` `272.4 KB` gz, `/privacy` `298.8 KB` gz).
- **Why it matters:** Wastes ~`150–180 KB` gzipped JS download/parse on `/app` (installed PWA splash), `/offline`, and `/privacy`, and runs Lenis wheel hijacking on the `/privacy` reading page.
- **Proposed fix:** Move `<SmoothScrollProvider>` (and its `<LazyMotion>`) into `src/app/(site)/page.tsx` or `LandingStage.tsx` so `/app`, `/offline`, and `/privacy` load pure lightweight React + CSS. Note: check if smooth scrolling on `/privacy` should remain native (recommended for reading long text) before moving.

### [Medium] `C-02`: Lighthouse Mobile Performance (`74`) below `80` target due to early GSAP / `SplitText` / `Preloader` main-thread work

- **File & Line:** `src/components/ui/Preloader.tsx:48`, `src/components/sections/Hero.tsx:37`, `src/components/ui/PillButton.tsx:47`, `src/lib/gsap.ts:17-28`
- **What is wrong:** `Preloader` covers the LCP image on first visit (`z-index: 120`, `1.75s`) while waiting for dynamic `gsap` import + 1.75s timeline, pushing cold-load mobile FCP/LCP to `2.6s` and TBT to `810ms` under 4× CPU throttling. Also `PillButton` loads `@/lib/gsap` on mobile layout mounts before `matchMedia('(hover: hover) and (pointer: fine)')`? (Wait: `PillButton.tsx:41` guards with `finePointer.matches` so desktop only; on mobile, `Preloader`, `Hero`, `Problem`, and `SmoothScrollProvider` load `gsap` + `SplitText` + `ScrollTrigger` eagerly right after hydration.)
- **Why it matters:** Lighthouse mobile Performance measured `74` vs the `>= 80` target in the baseline run (`84` earlier when warm/cached, `74` on cold trace).
- **Proposed fix:** See **Needs my decision** (adjusting Preloader backdrop/delay or deferring `ScrollTrigger` init slightly until after LCP paint would raise mobile Performance above `80` without removing Preloader aesthetics, if subtle timing/layering tweak is allowed).

### [Low] `C-03`: Dead file `src/app/(site)/page.module.scss`

- **File & Line:** `src/app/(site)/page.module.scss:1-28`
- **What is wrong:** Leftover Phase 0 placeholder styles (`.placeholderSection`, `.placeholderInner`), imported nowhere (`knip` confirmed unused).
- **Proposed fix:** Delete `src/app/(site)/page.module.scss`.

### [Low] `C-04`: Unused SCSS mixin `hairline-border` and unused CSS custom property `--duration-reveal`

- **File & Line:** `src/styles/mixins.scss:13-25` and `src/styles/tokens.scss:37`
- **What is wrong:** `@mixin hairline-border` and `--duration-reveal: 1s` are declared and referenced `0` times across the codebase.
- **Proposed fix:** Remove unused `@mixin hairline-border` and `--duration-reveal`.

### [Low] `C-05`: Unused exports (`HOW_IT_WORKS_STEPS`, `HowItWorksStep`, `resetSceneTargets`)

- **File & Line:** `src/components/sections/HowItWorks.tsx:7, 15` and `src/lib/scrollTimeline.ts:19`
- **What is wrong:** Exported externally but only imported/referenced inside their own files.
- **Proposed fix:** Drop `export` keyword on those three internal symbols.

### [Low] `C-06`: Oversized PWA icon PNGs (`icon-512.png`, `icon-maskable-512.png`)

- **File & Line:** `public/icons/icon-512.png` (`87.4 KB`), `public/icons/icon-maskable-512.png` (`85.0 KB`), `public/icons/icon-192.png` (`19.7 KB`)
- **What is wrong:** Simple vector pill/ring icon PNGs are `~85–87 KB` each uncompressed compared to typical ~10–20 KB lossless PNGs.
- **Proposed fix:** Losslessly optimize the PNGs (or re-export quantized lossless) without altering visual pixels. (Font weights `Instrument Serif 400/italic`, `Manrope 400/500/600/700`, `JetBrains Mono 400/500` are all verified in active use.)

### [Low] `C-07`: Duplicated `Install` CTA conditional pattern across `Hero`, `Nav`, and `Install` & repeated `emptySubscribe` helper

- **File & Line:** `src/components/sections/Hero.tsx:198-210`, `src/components/ui/Nav.tsx:83-113, 165-187`, `src/components/sections/Install.tsx:58-66`; plus `emptySubscribe` duplicated in `useMotionPreference.tsx:78`, `useInstallPrompt.ts:20`, `Preloader.tsx:10`
- **What is wrong:** Identical 3-way `installHref` / `onInstallClick` / `#install` branching repeats in 4 JSX spots, and `emptySubscribe` repeats in 3 files.
- **Proposed fix:** Extract a small `InstallCtaButton` helper component or shared `useIsHydrated()` hook cleanly.

---

## Section D — Needs My Decision

These items involve policy choices, breaking upgrades, copy changes, or trade-offs where I will not guess without your approval:

1. **CSP & Security Headers (`B-01`):**
   Adding strict `Content-Security-Policy` requires deciding whether to allow `'unsafe-inline'` for Next.js inline hydration/font styles (or adopt middleware nonces/strict-dynamic, which turns static `○` pages into dynamic SSR `ƒ` pages on Vercel!) and `Permissions-Policy` restrictions. _Recommended for static Next.js on Vercel:_ static security headers in `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP using `'self' 'unsafe-inline' 'wasm-unsafe-eval'`? Note `'unsafe-eval'`/`blob:`/`data:` testing for Three.js shaders/textures — let's test the tightest CSP without `'unsafe-eval'` first!). Confirm you want headers added via `next.config.ts` (`headers()`).
2. **`npm audit` transitive vulnerabilities (`B-02`):**
   All 12 alerts (`zod`, `glob`, `minimatch`) are inside build-time `@serwist/next` (`>=9.0.0`) and `@typescript-eslint`. Should I:
   - _(a)_ Leave `@serwist/next@9.5.13` as-is (do NOT downgrade to `8.4.4`) and try npm `overrides` for `glob`/`minimatch`/`zod` if clean; OR
   - _(b)_ Document them in `SECURITY.md` / `AUDIT_REPORT.md` as build-time-only?
3. **Lighthouse Mobile Performance `74` vs `80` (`C-02`) & Global `SmoothScrollProvider` (`C-01`):**
   - Moving `<SmoothScrollProvider>` from `RootLayout` to `LandingStage` drops `/app`, `/privacy`, and `/offline` JS by ~`170+ KB` gzipped cleanly with zero visual change on `/` (only `/privacy` switches from Lenis to native scrolling). Approve moving `SmoothScrollProvider` to `LandingStage`?
   - To lift cold-load Lighthouse Mobile Performance from `74` back above `80`, do you approve deferring `ScrollTrigger` / `PillHelix` non-critical init slightly after first hero paint OR slightly shortening/making the Preloader non-LCP-blocking, or keeping the current `Preloader` timing untouched?
4. **Query-string preview overrides (`?tier=...` and `?installPreview=...`):**
   `useGpuTier.ts:23` (`?tier=high|medium|low`) and `useInstallPrompt.ts:32` (`?installPreview=...`) expose harmless client-side UI preview modes used during testing. Keep them for QA/showcase convenience or remove `?installPreview` / `?tier` before launch?
5. **`THREE.Clock` deprecation warning from `@react-three/fiber` (`A-07`):**
   Updating or patching `@react-three/fiber` to silence Three.js `0.187`'s `THREE.Clock` warning may require either pinning `three` down or leaving until upstream `@react-three/fiber` migrates to `THREE.Timer`. Keep as-is?
6. **Privacy Notice row wording (`B-04`):**
   In `src/app/privacy/page.tsx:106` (`PRIVACY_NOTICE.md`), should `"If you install MedBuddy to your home screen"` stay exact as pasted, or change to `"When you visit the site or install MedBuddy to your home screen"` to reflect Serwist precaching on first visit?

---

## Top 10 Issues Summary

1. **[High | `B-01`]** Zero HTTP security headers (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) in [next.config.ts](file:///d:/MedBuddy/next.config.ts).
2. **[High | `A-01`]** Missing React ErrorBoundary around `<DynamicScene>` in [SceneLoader.tsx](file:///d:/MedBuddy/src/components/scene/SceneLoader.tsx#L45-L57) and WebGL context probe fallback bug in [useGpuTier.ts](file:///d:/MedBuddy/src/hooks/useGpuTier.ts#L15-L18).
3. **[High | `B-02`]** 12 transitive build/dev vulnerabilities (`4` High `zod`, `8` Moderate `glob`/`minimatch`) reported by `npm audit` via `@serwist/next` & `typescript-eslint`.
4. **[Medium | `C-01`]** Global `<SmoothScrollProvider>` in [layout.tsx](file:///d:/MedBuddy/src/app/layout.tsx#L102) loads Lenis + GSAP + Framer Motion `domMax` onto `/app`, `/offline`, and `/privacy` (`272–299 KB` gzipped JS on static utility routes).
5. **[Medium | `C-02`]** Cold-load Lighthouse Mobile Performance is `74` (below `>= 80` target; FCP/LCP `2.6 s`, TBT `810 ms` due to Preloader + early GSAP bootup).
6. **[Medium | `A-02`]** `SplitText` never awaits `document.fonts.ready` or calls `split.revert()` on animation complete in [Hero.tsx](file:///d:/MedBuddy/src/components/sections/Hero.tsx#L40-L58) and [Problem.tsx](file:///d:/MedBuddy/src/components/sections/Problem.tsx#L46-L61).
7. **[Medium | `A-03`]** `PillHelix` allocates `lockSlots` arrays every frame inside `useFrame` ([PillHelix.tsx](file:///d:/MedBuddy/src/components/scene/PillHelix.tsx#L174-L179)).
8. **[Medium | `A-04`]** `scrollTimeline.ts` captures desktop breakpoint once instead of using `gsap.matchMedia()` for resizes across `960px` ([scrollTimeline.ts](file:///d:/MedBuddy/src/lib/scrollTimeline.ts#L36)).
9. **[Medium | `A-05`]** Missing Tab focus trap in [InstallModal.tsx](file:///d:/MedBuddy/src/components/ui/InstallModal.tsx#L137-L153) and mobile drawer in [Nav.tsx](file:///d:/MedBuddy/src/components/ui/Nav.tsx#L134-L190) (plus missing backdrop-click close).
10. **[Medium | `A-06` & `B-03`]** Missing iOS `viewport-fit=cover` + `env(safe-area-inset-*)` in [layout.tsx](file:///d:/MedBuddy/src/app/layout.tsx#L82-L87), and `.gitignore` ignoring `.env*.local` instead of `.env*` ([.gitignore](file:///d:/MedBuddy/.gitignore#L16)).
