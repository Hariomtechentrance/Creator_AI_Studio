This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication Setup (Supabase)

This project uses Supabase for auth (email/password, Google OAuth, and SMS OTP).

- Environment variables required in `.env.local`:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY` (server-only — set in your host, never expose to client)
	- `NEXT_PUBLIC_APP_URL` (optional, used by server endpoints when running behind proxies)

- Supabase console steps:
	1. Enable **Google** provider under Authentication → Providers, and set the redirect URI to `http://localhost:3000/auth/callback` (use your production URL for deploy).
	2. Enable **Phone (SMS)** sign-in under Authentication → Settings → External OAuth providers or Phone (SMS). Configure an SMS provider (e.g. Twilio) in Supabase settings so SMS messages can be sent.

- Local dev notes:
	- The app uses `signInWithOtp` / `verifyOtp` for SMS-based flows and posts tokens to the server route `/api/auth/session` to establish server-side cookies for SSR.
	- The app now routes SMS OTP requests through server endpoints which use a simple in-memory rate limiter. For production, configure a Redis or other centralized store and set `SUPABASE_SERVICE_ROLE_KEY` in your server environment.
	- Make sure your Supabase project permits the redirect origin you use.

If you need me to add phone OTP signup variations or to switch server clients to use a Supabase service role key for server-only operations, tell me and I can implement that.

## Production checklist (automated steps I implemented)
- Server-side service-role support: `SUPABASE_SERVICE_ROLE_KEY` is supported by `src/lib/supabase/server.ts`.
- Server session cookie hardening: cookies are enforced `Secure`, `HttpOnly`, and `SameSite` via `COOKIE_SAMESITE`/`COOKIE_DOMAIN` env vars.
- OTP endpoints are proxied through server routes and rate-limited with a Redis fallback (`src/lib/rateLimit.ts`).
- CI: lint + build workflow added; deploy workflow for Vercel added.
- E2E: Playwright skeleton added under `e2e/` with a basic auth test.

Additional automation I added:

 - `package.json` scripts: `start:prod`, `check:security`, and `ci:checks` (composite CI script).
 - `.env.production.example` documenting required production env vars.
 - GitHub Actions workflow: `.github/workflows/production-checks.yml` to run lint, build, and a security audit on `main`, and an optional E2E job gated by the `PLAYWRIGHT_RUN` secret.

Local commands to validate production readiness:

```bash
npm run lint
npm run build
npm run test:e2e
npm run check:security
```

### Security audit note

Running `npm run check:security` may report high-severity issues that require
upgrading transitive dependencies (for example `next`, `postcss`, or `sharp`).
Recommended actions:

 - Run `npm audit fix` and review changes.
 - If required, carefully run `npm audit fix --force` and test the app, or
	 upgrade `next`/`postcss`/`sharp` to patched versions and run the test suite.
 - Consider Dependabot or a similar tool to keep dependencies updated.

## Next steps you must complete locally / in your cloud provider
1. Run `npm install` locally to update `package-lock.json` and install `ioredis`.
2. Provision production secrets in your host (Vercel/GitHub Actions):
	- `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `REDIS_URL` (optional, for production rate-limiting)
	- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (if using the deploy workflow)
3. Configure Supabase console: enable Google OAuth redirect and SMS provider (Twilio).
4. Run E2E tests in CI/staging and verify OTP/email flows.

### Sentry (monitoring)

I added Sentry config files (`sentry.client.config.js`, `sentry.server.config.js`). To enable Sentry, install the SDK and set `SENTRY_DSN` in your environment:

```bash
# Install Sentry when ready (choose a version compatible with your Next.js)
# npm install @sentry/nextjs
```

If `@sentry/nextjs` causes peer-dependency conflicts with your current `next` version, use `@sentry/node` on the server and `@sentry/react` in the browser, or pick a Sentry release compatible with Next 16. Configure `SENTRY_DSN` in your host before deploying.

If you want, I can continue to: wire up CI secrets, add Playwright to devDependencies and run E2E here (requires installing deps), or switch server calls to use the service role key for specific admin-only endpoints. Which one should I do next?

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
