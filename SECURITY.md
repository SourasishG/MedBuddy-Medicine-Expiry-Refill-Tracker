# Security Policy — MedBuddy

This document describes the security controls, HTTP headers, client data boundaries, build-time dependency posture, and vulnerability reporting process for the **MedBuddy** marketing website and early-access PWA shell (`d:\MedBuddy`).

---

## 1. Security Posture & Architecture

- **Zero accounts or server-side user data:** The website has no authentication, databases, user forms, server actions, or API routes. All pages (`/`, `/app`, `/privacy`, `/offline`) are pre-rendered static documents.
- **Zero third-party origins or trackers:** All typography (`Instrument Serif`, `Manrope`, `JetBrains Mono` via `next/font`), GPU benchmark metadata (`public/benchmarks/`), QR SVGs (`qrcode.react`), and WebGL/shader assets are self-hosted or generated strictly client-side.
- **Zero cookies:** The website sets `0` HTTP or JS cookies. Only optional session intro state (`sessionStorage['medbuddy-preloader-seen']`) is stored locally in the visitor's browser, wrapped in defensive `try/catch` blocks.
- **No unsafe DOM execution:** Zero uses of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function`. Query-string preview parameters (`?tier=...`, `?installPreview=...`) are strictly validated against allowlisted enum literals.
- **Zero production source maps:** `.next/static` emits `0` `.map` files in production builds.

---

## 2. HTTP Security Headers (`next.config.ts`)

Every route (`/:path*`) serves the following headers configured in [next.config.ts](file:///d:/MedBuddy/next.config.ts):

| Header                      | Value & Purpose                                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` — enforces HTTPS with HSTS preloading on deployed origins.                                                                                                                                                                                |
| `X-Frame-Options`           | `DENY` — blocks all cross-origin and same-origin framing (`frame-ancestors 'none'` mirrors this in CSP).                                                                                                                                                                                 |
| `X-Content-Type-Options`    | `nosniff` — prevents MIME-type sniffing.                                                                                                                                                                                                                                                 |
| `Referrer-Policy`           | `strict-origin-when-cross-origin` — strips full path/query strings when navigating cross-origin.                                                                                                                                                                                         |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), browsing-topics=()` — explicitly disables unused device sensors and Google Topics API.                                                                                                                                                        |
| `X-Powered-By`              | Disabled (`poweredByHeader: false`).                                                                                                                                                                                                                                                     |

### What Is Allowed vs. Blocked by CSP

- **Allowed:** Same-origin scripts and styles (`'self'`), Next.js App Router hydration & inline style attributes (`'unsafe-inline'`), self-hosted images plus `data:`/`blob:` URIs (used by Canvas/WebGL textures), same-origin fonts and connections (`'self'`), and same-origin + `blob:` Web Workers / Serwist service worker (`/sw.js`).
- **Blocked:** External scripts, external fonts, external fetch/XHR/WebSocket endpoints, framing (`<iframe>`), Flash/plugin `<object>` embeds (`object-src 'none'`), `<base>` tag hijacking (`base-uri 'self'`), external `<form>` submissions (`form-action 'self'`), and arbitrary `eval()` / string-to-code execution.

> **Future upgrade note:** Replacing `'unsafe-inline'` in `script-src` with cryptographic per-request CSP nonces requires server-side Next.js middleware (`proxy.ts`), which converts static `○` pages to dynamic SSR `ƒ` responses on Vercel. If the MedBuddy app later introduces user authentication or sensitive health inputs on the same origin, migrate dynamic authenticated routes to nonce-based CSP + server-enforced session cookies.

---

## 3. Environment & Repository Hygiene

- [.gitignore](file:///d:/MedBuddy/.gitignore) excludes all `.env*` files while explicitly allowing an untracked template `!.env.example`.
- The only environment variable referenced in application code is `NEXT_PUBLIC_SITE_URL`, which is a non-sensitive public canonical origin (`https://medbuddy.app` fallback). Never place private API keys or secrets inside `NEXT_PUBLIC_*` variables.

---

## 4. Build-Time & Dev Dependency Audit Scope

`npm audit` flags `12` transitive advisories (`4` High in `zod < 4.6.6`, `8` Moderate in `glob` and `minimatch`), originating exclusively inside build-time and lint tooling:

- `@serwist/next@9.5.13` / `@serwist/build` / `@serwist/webpack-plugin` (service-worker bundler run only during `npm run build` / CI)
- `@typescript-eslint/*` via `eslint-config-next` (static linter run only during `npm run lint` / development)

**Runtime impact:** `0` of these flagged packages ship in client-side browser bundles or execute against untrusted user input at runtime. Because downgrading `@serwist/next` (`npm audit fix --force`) introduces a breaking jump to `8.4.4`, `@serwist/next@9.5.13` is retained and tracked for upstream patch releases.

---

## 5. Reporting a Vulnerability

If you discover a security or privacy issue in the MedBuddy website or build pipeline:

- **Contact:** [ghoshsourasish1@gmail.com](mailto:ghoshsourasish1@gmail.com)
- **What to include:** Affected URL or file path, reproduction steps or PoC, and potential impact.
- **Response target:** We acknowledge reports and reply promptly (typically within 24–48 hours; see also our [Privacy Notice](file:///d:/MedBuddy/src/app/privacy/page.tsx)). Please do not publicly disclose an issue before we have had a chance to verify and remediate it.
