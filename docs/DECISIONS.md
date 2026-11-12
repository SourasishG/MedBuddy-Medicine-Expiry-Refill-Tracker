# MedBuddy Architectural & Design Decisions

## Phase 0: Foundation

1. **Next.js 16 + React 19 + TypeScript Strict**
   - Uses App Router (`src/app/(site)/page.tsx` for the landing page, `src/app/app/page.tsx` planned for the PWA placeholder in Phase 5).
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
   - `useMotionPreference` reads `localStorage` (`medbuddy-motion`) inside `try/catch`, falling back to `!(prefers-reduced-motion: reduce)`.
   - `MotionProvider` syncs `data-motion="on" | "off"` on `<html>`.
   - Lenis smooth scroll is wired directly to GSAP `ScrollTrigger` via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add((t) => lenis.raf(t * 1000))` with `gsap.ticker.lagSmoothing(0)`.
   - When Motion is `off`, Lenis is not initialized (or destroyed immediately) so native scrolling and static layout apply cleanly without animation lag.
   - Native browser scrollbar is hidden (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) to preserve the dark gallery canvas without a grey OS scrollbar track while keeping wheel, keyboard, and touch scrolling active.

5. **Linting & Formatting**
   - ESLint 9 flat config using `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier`.
   - Prettier configured with single quotes, trailing commas, and 100-char line width.

## Phase 1: Hero Without 3D

1. **Server-Rendered Landing Page & LCP Poster**
   - `src/app/(site)/page.tsx` stays a Server Component so the hero headline, hairline columns, glass cards, CTAs, and `public/posters/hero-poster.svg` (`next/image` with `priority`) paint immediately without waiting for client hydration.
   - `public/posters/hero-poster.svg` depicts the dark graphite phone (Cabinet UI labelled `Illustrative`), glowing white ring halo, deep `#1F4BFF` ambient glow, and frosted-glass/chrome pill helix as a crisp vector poster.

2. **Preloader (`00`)**
   - Uses `useSyncExternalStore` + `sessionStorage` (`medbuddy-preloader-seen` inside `try/catch`) so repeat visits and Motion-off sessions skip the preloader immediately and SSR never blocks initial paint.
   - Animates 12 pills, a `000`–`100` mono counter, wordmark reveal, and a single `<250ms` scan-line pulse under 1.8s total.

3. **Nav, Cursor & Micro-Interactions**
   - `Nav` renders wordmark left, anchor links centered, `Install` pill (revealing via `IntersectionObserver` once scrolled past `#hero`), `MotionToggle`, and a Framer Motion mobile drawer under 960px.
   - `Cursor` runs GSAP `quickTo` strictly on fine pointers when Motion is enabled.
   - `PillButton` uses GSAP `quickTo` for subtle magnetic hover on desktop; `GlassCard` uses Framer Motion `AnimatePresence` exclusively for expand/collapse (never mixing GSAP and Framer Motion on the same element).

## Phase 2: 3D Scene & Fallback Tiers

1. **Deferred Dynamic Loading (`ssr: false`)**
   - `SceneLoader` uses `next/dynamic` (`ssr: false`) triggered after first `requestAnimationFrame` paint, keeping the Three.js/R3F chunk completely out of the initial JS payload while `hero-poster.svg` renders immediately as the LCP element.

2. **Procedural 3D Objects & Custom GLSL Shaders**
   - **Phone (`Phone.tsx` + `PhoneScreen.tsx` + `bakedPhoneTexture.ts`)**: Dark graphite chrome `RoundedBox` (`metalness: 1, roughness: 0.2, clearcoat: 1`), camera bump, side buttons, and four React UI screens (`cabinet`, `reminder`, `refill`, `family`) rendered via drei `<Html transform occlude="blending">`, with automatic fallback to procedural `CanvasTexture` (`createBakedScreenTexture`) on FPS decline.
   - **RingHalo (`RingHalo.tsx`)**: Emissive white torus (`toneMapped: false`) caught by Bloom, additive `#1F4BFF` halo disc, animated background grain/gradient-mesh shader (`src/shaders/grain.ts`), and `<300ms` scan-line glitch plane (`src/shaders/glitch.ts`).
   - **PillHelix (`PillHelix.tsx`)**: Dual instanced capsule meshes (80 total on High desktop, 40 on High mobile / 44 Medium desktop, 24 Medium mobile) alternating physical iridescent glass and custom GLSL Fresnel-iridescence chrome (`src/shaders/chrome.ts`), reacting to pointer and `DeviceOrientationEvent`.
   - **FloatingTiles (`FloatingTiles.tsx`)**: Orbiting frosted-glass depth tiles + single-frame `<ContactShadows frames={1}>`.
   - **Effects (`Effects.tsx`)**: Procedural `<Environment>` with `<Lightformer>` studio panels (no external HDR download), cool left key / warm right rim lights, `Bloom`, and desktop High-tier `ChromaticAberration`.

3. **Fallback Tiers & Performance Controls**
   - `useGpuTier` runs `detect-gpu` asynchronously (with optional `?tier=high|medium|low` inspection override), checks WebGL support, and respects `useMotionPreference`.
   - **High**: Full scene with transmission, iridescence, bloom, and desktop chromatic aberration.
   - **Medium**: Drops transmission and chromatic aberration, halves capsule count, lighter bloom.
   - **Low / WebGL failure / Motion Off**: Unmounts 3D canvas and displays the static poster with CSS parallax (`Motion On`) or static layout (`Motion Off`).
   - Pauses rendering (`frameloop="never"`) when the tab is hidden or canvas is off-screen, clamps DPR (`[1, 1.75]` desktop / `[1, 1.25]` mobile), and steps down quality via `PerformanceMonitor`.

## Phase 3: Scroll Choreography & Sections 01–03

1. **Master ScrollTrigger Choreography (`src/lib/scrollTimeline.ts`)**
   - Uses a single `gsap.context` timeline mutating `sceneTargets` (`src/lib/sceneState.ts`) so 60fps R3F `useFrame` reads remain decoupled from React state.
   - **Hero → 01 Problem**: Loosens capsule helix (`helixSpread: 0.92`), dims halo ring (`ringOpacity: 0.28`), tilts and offsets the phone right on desktop so the oversized statement list stays unobstructed.
   - **02 How It Works**: Pins `#how-it-works` on desktop when Motion is enabled, scrubs through 4 steps (`cabinet → reminder → refill → family`), updates the DOM step indicator, and locks 1 chrome capsule per step (`lockedPills: 1 → 4`) around the phone. On mobile or with Motion Off, renders as a static vertical story stack with clickable step previews.
   - **03 Features**: Centers and recesses the phone (`tilesLift: 1`) while the 8 expandable `GlassCard` features frame it in depth-layered columns.

2. **Content & Honesty Alignment**
   - Problem statements (`01`–`03`) and all 8 feature cards stay strictly within listed product capabilities without invented metrics or medical claims.
