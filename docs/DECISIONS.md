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

5. **Linting & Formatting**
   - ESLint 9 flat config using `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier`.
   - Prettier configured with single quotes, trailing commas, and 100-char line width.
