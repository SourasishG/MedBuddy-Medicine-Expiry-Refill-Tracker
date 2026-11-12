# MedBuddy

> **Every dose. Every expiry. Every loved one.**

Marketing and early-access PWA website for **MedBuddy** — a medicine expiry, dose schedule, refill, and family adherence tracker. Built with Next.js App Router, TypeScript strict mode, SCSS modules, React Three Fiber, GSAP + ScrollTrigger, Lenis, Framer Motion (`LazyMotion`), and Serwist.

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

`npm run build` runs `next build --webpack` so Serwist compiles `public/sw.js` with precaching and the `/offline` document fallback. Test PWA installability, `/manifest.webmanifest`, `/sw.js`, `/app`, and offline support against `npm run start`.

---

## Deploying to Vercel (Free Tier)

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project in **Vercel** (`Framework Preset: Next.js`).
3. Leave Build Command (`npm run build`) and Output Directory (`.next`) as defaults.
4. Set the optional environment variable so canonical URLs and Open Graph metadata point to your domain:
   - `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app`
5. Deploy. Vercel serves HTTPS automatically, which enables Android/Chrome `beforeinstallprompt`, iPhone Safari _Add to Home Screen_, and the Serwist service worker.

> **PWA preview helpers:** Append `?installPreview=ios-safari`, `?installPreview=ios-non-safari`, `?installPreview=desktop-qr`, or `?installPreview=standalone` to the URL when inspecting platform install UIs on desktop. Append `?tier=high`, `?tier=medium`, or `?tier=low` to inspect 3D quality fallback tiers.

---

## Where to Edit Copy & Design Tokens

All copy lives directly inside each section component under `src/components/sections/` and `src/app/`:

| Section / Area                                                               | File                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
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

- Review [src/app/privacy/page.tsx](file:///d:/MedBuddy/src/app/privacy/page.tsx) and update server log retention if upgrading your Vercel plan or adding any third-party analytics later.
- Retain explicit **Illustrative** tags on sample cabinet/phone data and paired icon + text labels (`In date`, `Use soon`, `Expired`).
- Retain the medical disclaimer verbatim in the footer (`Install.tsx`), `/privacy` (`src/app/privacy/page.tsx`), and `/app` shell (`src/app/app/page.tsx`):
  > _MedBuddy is a reminder and tracking tool. It does not provide medical advice, diagnosis or treatment. Always follow your doctor’s instructions._
