# MedBuddy

> **Every dose. Every expiry. Every loved one.**

Marketing and early-access PWA website for **MedBuddy** — a calm medicine expiry, opened-bottle countdown, dose reminder, refill, and family adherence tracker.

[![Live on Vercel](https://img.shields.io/badge/Live%20Demo-medbuddy--s7ven.vercel.app-090C12?style=for-the-badge&logo=vercel&logoColor=white)](https://medbuddy-s7ven.vercel.app/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Serwist-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://serwist.pages.dev/)

---

## Live App

- **Production URL:** [https://medbuddy-s7ven.vercel.app/](https://medbuddy-s7ven.vercel.app/)
- **Key Routes:**
  - `/` — Landing experience, interactive 3D cabinet hero, expiry demo slider, caregiver flow & FAQ
  - `/app` — Installed PWA early-access launch shell (`start_url`)
  - `/privacy` — Website privacy notice
  - `/offline` — Precached offline fallback screen
  - `/manifest.webmanifest` — Web App Manifest (`standalone`, `192px` / `512px` / `maskable` icons)

---

## Tech Stack

### Core & Styling

| Technology                                                                                                      | Role                                                                                                                 | Version   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)        | App Router, static pre-rendering, metadata, dynamic Open Graph image (`next/og`), `next/font` self-hosted typography | `^16.4.6` |
| ![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)               | UI component architecture & client interactive states                                                                | `^19.3.1` |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | Strict static type checking across UI, hooks, metadata, and 3D scene                                                 | `^5.8.3`  |
| ![Sass](https://img.shields.io/badge/Sass%20%2F%20SCSS-CC6699?style=flat-square&logo=sass&logoColor=white)      | Component-scoped SCSS modules, dark glassmorphism tokens, fluid type ramp & responsive mixins                        | `^1.86.0` |

### 3D, WebGL & Motion

| Technology                                                                                                                                 | Role                                                                                                    | Version              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------- |
| ![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white)                                | 3D capsule geometry, chrome ring halo, procedural textures & WebGL rendering                            | `^0.187.0`           |
| ![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber%20%26%20Drei-0B0F17?style=flat-square&logo=react&logoColor=5CF2C7) | Declarative R3F canvas (`@react-three/fiber` + `@react-three/drei`) synced to scroll progress           | `^9.8.2` / `^10.7.9` |
| ![WebGL](https://img.shields.io/badge/Postprocessing%20%26%20GLSL-990000?style=flat-square&logo=webgl&logoColor=white)                     | Custom chrome/grain/glitch shaders, `@react-three/postprocessing` + `detect-gpu` adaptive quality tiers | `^3.2.2` / `^5.0.70` |
| ![GSAP](https://img.shields.io/badge/GSAP%20%2B%20ScrollTrigger-88CE02?style=flat-square&logo=greensock&logoColor=090C12)                  | Scroll-driven 3D camera choreography and continuous timeline progress                                   | `^3.15.1`            |
| ![Framer Motion](https://img.shields.io/badge/Framer%20Motion-0055FF?style=flat-square&logo=framer&logoColor=white)                        | `LazyMotion` micro-interactions, accordion panels, modals, and card reveals                             | `^14.12.0`           |
| ![Lenis](https://img.shields.io/badge/Lenis-111827?style=flat-square&logo=scrollreveal&logoColor=5CF2C7)                                   | Smooth inertial scrolling synced cleanly with ScrollTrigger                                             | `^1.3.27`            |

### PWA, Hosting & Tooling

| Technology                                                                                                   | Role                                                                                                     | Version   |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------- |
| ![PWA Serwist](https://img.shields.io/badge/Serwist%20PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white) | Service worker (`@serwist/next`), static + `/app` + `/offline` precaching, and offline document fallback | `^9.5.13` |
| ![QR Code](https://img.shields.io/badge/qrcode.react-090C12?style=flat-square&logo=react&logoColor=EAF0F6)   | Client-side SVG QR code generation for desktop-to-phone install flow (zero third-party requests)         | `^4.2.0`  |
| ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)          | Production & preview HTTPS hosting (`medbuddy-s7ven.vercel.app`)                                         | —         |
| ![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=flat-square&logo=eslint&logoColor=white)          | Static code linting (`eslint-config-next` + `eslint-config-prettier`)                                    | `^9.24.0` |
| ![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=flat-square&logo=prettier&logoColor=111827)   | Consistent code and stylesheet formatting                                                                | `^3.5.3`  |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development

```bash
npm run dev
```

Opens at `http://localhost:3000`. Note that the Serwist service worker is disabled in development (`NODE_ENV !== 'production'`) so Next.js fast refresh works without caching stale chunks.

### 3. Verify typecheck, lint & formatting

```bash
npm run typecheck
npm run lint
npm run format:check
```

### 4. Build & run the full production PWA locally

```bash
npm run build
npm run start
```

`npm run build` runs `next build --webpack` so Serwist compiles `public/sw.js` with precaching (`/offline`, `/app`, static assets) and the `/offline` document fallback. Test PWA installability, `/manifest.webmanifest`, `/sw.js`, `/app`, and offline support against `npm run start`.

---

## Deploying to Vercel (Free Tier)

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project in **Vercel** (`Framework Preset: Next.js`).
3. Leave Build Command (`npm run build`) and Output Directory (`.next`) as defaults.
4. Set the optional environment variable (see `.env.example`) so canonical URLs, `robots.txt`, `sitemap.xml`, and Open Graph metadata match your domain:
   - `NEXT_PUBLIC_SITE_URL=https://medbuddy-s7ven.vercel.app`
5. Deploy. Vercel serves HTTPS automatically, which enables Android/Chrome `beforeinstallprompt`, iPhone Safari _Add to Home Screen_, and the Serwist service worker.

> **PWA preview helpers:** Append `?installPreview=ios-safari`, `?installPreview=ios-non-safari`, `?installPreview=desktop-qr`, or `?installPreview=standalone` to the URL when inspecting platform install UIs on desktop. Append `?tier=high`, `?tier=medium`, or `?tier=low` to inspect 3D quality fallback tiers.

---

## Where to Edit Copy & Design Tokens

All copy lives directly inside each section component under `src/components/sections/` and `src/app/`:

| Section / Area                                                               | File                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Canonical site URL & OG image config                                         | `src/lib/site.ts`, `.env.example`                                                   |
| Brand palette, typography, type ramp & layout tokens                         | `src/styles/tokens.scss`, `src/styles/base.scss`                                    |
| SEO metadata, Open Graph & Twitter card text                                 | `src/app/layout.tsx`, `src/app/opengraph-image.tsx`                                 |
| Navigation links & mobile drawer                                             | `src/components/ui/Nav.tsx`                                                         |
| `00` Hero headline, cards, spec sheet & CTAs                                 | `src/components/sections/Hero.tsx`                                                  |
| `01` Problem statements                                                      | `src/components/sections/Problem.tsx`                                               |
| `02` How It Works 4-step walkthrough                                         | `src/components/sections/HowItWorks.tsx`                                            |
| `03` 8 Expandable feature cards (`Illustrative` demo specs)                  | `src/components/sections/Features.tsx`                                              |
| `04` Interactive expiry slider cabinet demo                                  | `src/components/sections/CabinetDemo.tsx`                                           |
| `05` Caregiver missed-dose demo                                              | `src/components/sections/Caregivers.tsx`                                            |
| `06` Privacy spec columns (`WHAT MEDBUDDY DOES` / `NEVER DOES` / `CONTROLS`) | `src/components/sections/Privacy.tsx`                                               |
| `07` FAQ accordion items                                                     | `src/components/sections/Faq.tsx`                                                   |
| `08` Install panel, QR & Footer disclaimer                                   | `src/components/sections/Install.tsx`                                               |
| Privacy Notice page (`/privacy`)                                             | `src/app/privacy/page.tsx`, `src/app/privacy/privacy.module.scss`                   |
| iOS & Desktop install modal instructions                                     | `src/components/ui/InstallModal.tsx`                                                |
| Early-access PWA launch shell (`/app`) & Offline page                        | `src/app/app/page.tsx`, `src/app/offline/page.tsx`                                  |
| PWA manifest icons & metadata                                                | `src/app/manifest.ts`, `public/icons/`                                              |
| Interactive 3D phone screen demo data (`Illustrative`)                       | `src/components/scene/PhoneScreen.tsx`, `src/components/scene/bakedPhoneTexture.ts` |

---

## Content & Safety Reminders

- Review [src/app/privacy/page.tsx](src/app/privacy/page.tsx) and update server log retention if upgrading your Vercel plan or adding any third-party analytics later.
- Retain explicit **Illustrative** tags on sample cabinet/phone data and paired icon + text labels (`In date`, `Use soon`, `Expired`).
- Retain the medical disclaimer verbatim in the footer (`Install.tsx`), `/privacy` (`src/app/privacy/page.tsx`), and `/app` shell (`src/app/app/page.tsx`):
  > _MedBuddy is a reminder and tracking tool. It does not provide medical advice, diagnosis or treatment. Always follow your doctor’s instructions._
