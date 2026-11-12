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
