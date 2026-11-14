# CreatorAI Studio / GrowthPilot — Feature & Module Inventory

_Generated 2026-09-06 · branch `validate/generation-pipelines` · app boots clean locally on `npm run dev`_

## Stack & scale
- **Next.js 16.2.12**, React 19.2, TypeScript
- **Supabase** (auth + Postgres + Storage), **Stripe** (billing), **Anthropic Claude** (all text AI), **Replicate** (image/video/upscale/training), **HeyGen v3** (talking avatars)
- **27 dashboard pages**, **38 API routes**, **11 DB migrations**, ~50 lib modules
- Multi-tenant (organizations + roles), credit-metered, RLS-locked

## Local environment status right now

| Provider | State | Effect |
|---|---|---|
| Supabase URL + anon key | ✅ set | auth + DB reads/writes work |
| Supabase **service-role key** | ⚠️ placeholder | credit deduction, public lead capture, cross-user notifications won't persist |
| Anthropic API key | ⚠️ set but **workspace-scoped** | every Claude feature 400s until `ANTHROPIC_WORKSPACE_ID` is added |
| HeyGen API key | ⚠️ set but **$0 balance** | avatar render returns 402 |
| Replicate token | ❌ placeholder | image (paid)/video/upscale/textures/training disabled |
| Stripe secret/webhook | ❌ placeholder | checkout disabled |
| Meta / LinkedIn / Google OAuth | ❌ placeholder | social publishing + ads launch disabled |
| Twilio / Resend / WhatsApp | ❌ placeholder | SMS/email/WhatsApp automation actions disabled |
| HuggingFace token | ✅ set | — |

---

## Modules

### 1 · Auth & Foundation _(Phase 1)_
Email/password signup · login · forgot-password · OAuth callback · **OTP login** (new) · sign-out. Server-hydrated session store (zustand). Credit system: per-user balance, shared cost table (`src/lib/models.ts`), `credit_transactions` ledger, RLS column-lock so users can't self-grant credits.
**Routes:** `/auth/*`, `/api/auth/otp/{send,verify}`, `/api/auth/session`
**Status:** code complete — credit writes need the service-role key.

### 2 · Organizations / Teams / Roles _(Module 1)_
Multi-tenant orgs, `org_members` with roles (owner / admin / member / viewer), email invite flow, org switcher, active-org cookie. RLS policies (migrations 004–005) — viewers can't delete the org, only owner/admin mutate settings.
**Routes:** `/settings`, `/api/org/{invite,switch,white-label}`
**Status:** complete.

### 3 · Brand Intelligence _(Modules 2 + 5)_
Brand onboarding wizard (business type, audience, USPs, competitors) — persisted to `brand_profiles`. **AI Business Analysis engine**: Claude produces brand summary, strategy, insights, red flags, opportunities, recommendations → `ai_reports`. Prompt-constrained to only reason from real data, never invent metrics.
**Routes:** `/brand`, `/ai-insights`, `/api/ai/analyze-business`
**Status:** wizard works; AI analysis needs the Anthropic workspace ID.

### 4 · Brand Kit _(Module 13)_
Colour swatches, font tags, logo upload (Supabase Storage), approved-keyword / banned-word tag editors. Banned/approved words are injected into **every** AI generation prompt across the app (content, chatbot, landing pages, ad copy, avatar scripts).
**Routes:** `/brand-kit`
**Status:** complete — logo upload needs the storage bucket + service key.

### 5 · Campaigns & Ads _(Modules 14 / 15)_
AI ad-copy generation (headlines / body / CTA / audience / budget guidance) via Claude → `campaigns`. **Ads launch** creates a **PAUSED** campaign shell on Google Ads or Meta Ads — never auto-enabled, so nothing spends money without the owner activating it on-platform. Budget/CTR optimisation is gated behind live ad-account data that doesn't exist yet.
**Routes:** `/campaigns`, `/api/ai/generate-ad-copy`, `/api/ads/launch`
**Status:** copy gen needs Anthropic; launch needs Meta/Google OAuth.

### 6 · Content Studio _(Module 8)_
AI content generation per platform (Claude) → `content_posts` drafts · schedule (`scheduled_at`) · calendar view · publishing hub. Real posting to Facebook Page / Instagram / LinkedIn / YouTube via the social publish route.
**Routes:** `/content`, `/content/create`, `/content/calendar`, `/publish`, `/api/ai/generate-content`, `/api/social/publish`
**Status:** generation needs Anthropic; publishing needs social OAuth.

### 7 · Landing Pages _(Module 10)_
AI page generation (Claude) · section editor (add / edit / reorder / delete) · **public unauthenticated render** at `/lp/[slug]` · **A/B testing** (Variant B copy, atomic view/conversion counters via `increment_ab_stat()` RPC, sticky per-visitor variant assigned in `proxy.ts`). Public lead-capture form feeds the leads pipeline.
**Routes:** `/landing-pages`, `/lp/[slug]`, `/api/ai/generate-landing-page`, `/api/public/lead-capture`
**Status:** complete — generation needs Anthropic; public capture needs the service key.

### 8 · Leads _(Module 3)_
Manual + CSV import · lead scoring (`src/lib/leads/scoring.ts`) · status tracking · website-form capture (from landing pages) · WhatsApp capture · follow-up tasks (`tasks` table). AI lead analysis via Claude. **No Kanban sales pipeline — deliberate**, this is a marketing OS, not a sales CRM.
**Routes:** `/leads`, `/tasks`, `/api/ai/analyze-lead`
**Status:** capture + scoring work; AI analysis needs Anthropic.

### 9 · Community / Inbox _(Module 9)_
AI chatbot (Claude, brand-context aware, sets `should_escalate`) → `conversations` / `messages`. Website-widget test flow · **WhatsApp inbound webhook** creates the lead + conversation, runs the same chatbot brain, replies back — a real second channel into one pipeline. Social account connections (Meta / LinkedIn / Google) — OAuth code is real, gated on credentials.
**Routes:** `/community`, `/social-accounts`, `/api/ai/chatbot`, `/api/webhooks/whatsapp`, `/api/social/{connect,callback,disconnect}/*`
**Status:** chatbot needs Anthropic; channels need WhatsApp / social creds.

### 10 · AI Agents _(Modules 16–18)_
Three conversational agents injecting real org context (brand, lead stats, campaigns, latest report) into a Claude system prompt:
- **Marketing Agent** — content / campaign advice
- **Business Consultant** — growth / revenue-forecast / competitor analysis (caveated as rough estimate)
- **Sales AI Agent** — per-lead qualify, objection-handling drafts, meeting-time suggestions (can't book — no calendar integration)

**Routes:** `/ai-agents`, `/api/ai/agent-chat`
**Status:** needs Anthropic.

### 11 · Automations _(Module 6)_
Rule engine (`src/lib/automations/engine.ts`): triggers → actions. Actions: `create_follow_up_task`, `notify_assignee`, `send_whatsapp_message`, `send_sms`, `send_email`. Wired into the `lead_created` trigger; an overdue-task checker route.
**Routes:** `/automations`, `/api/automations/check-overdue`
**Status:** task/notify actions work; messaging actions need Twilio / Resend / WhatsApp.

### 12 · Analytics _(Module 4)_
Real metrics computed from `leads` / `conversations` / `campaigns`: conversion rate, average human response time, source performance, campaign performance. Hides a tile (returns `null`) rather than showing a fake `0` when there's no data.
**Routes:** `/analytics`
**Status:** works whenever there's data.

### 13 · Notifications _(Module 7)_
Real bell + list, new-lead trigger. Cross-user fan-out (notify a teammate) needs the admin/service client.
**Routes:** `/notifications`, `/api/notifications/lead-created`
**Status:** own-user notifications work.

### 14 · Creative Studio _(Modules 11 / 12)_ — 7 tools
| Tool | Route | Backend | Status |
|---|---|---|---|
| AI Image Studio | `/image-generation` | Replicate + **Pollinations free fallback** | **works now** via free fallback; paid models need Replicate |
| AI Video Studio | `/video-generation` | Replicate (Kling / Luma) + Ken-Burns ffmpeg pass | needs Replicate token |
| **AI Avatar Studio** | `/avatar-studio` | **HeyGen v3** (just migrated) + Claude script expansion | needs HeyGen balance + Anthropic |
| Textures & 3D | `/textures-3d` | Replicate (diffuse map real; other PBR maps partial) | needs Replicate |
| Upscaler | `/upscaler` | Replicate | needs Replicate |
| Model Training | `/model-training` | Replicate LoRA (`ostris/flux-dev-lora-trainer`), zips images, polls | needs Replicate + storage |
| Canvas | `/canvas` | fabric.js in-browser editor | works client-side |

### 15 · Billing & Plans _(Module 19)_
Stripe Checkout per plan · webhook grants plan + credits on `checkout.session.completed` · reverts to free on `customer.subscription.deleted`. Three price IDs configured.
**Routes:** `/pricing`, `/api/billing/checkout`, `/api/webhooks/stripe`
**Status:** needs the Stripe secret + webhook keys.

### 16 · White Label _(Module 20)_
Toggle in-app name/logo (agency plan + owner/admin only, server-checked); sidebar + footer read it. Custom domains explicitly out of scope (needs DNS/hosting infra).
**Routes:** `/settings`, `/api/org/white-label`
**Status:** complete.

### 17 · Marketplace _(Module 21)_
Honest roadmap page — links to what already functions as templates today (automation templates, landing pages, content presets) instead of faking listings / purchases / a plugin system.
**Routes:** `/marketplace`
**Status:** intentionally a placeholder page.

### Also present
`/gallery` (generation history) · `/dashboard` (KPI overview) · `/api/health` liveness probe · rate limiting (`src/lib/rateLimit.ts`) · Sentry config files.

---

## What works right now with zero further setup
- App boots, all 27 routes resolve, proxy auth-guard active
- **Signup / login** (Supabase anon key is set)
- **AI Image Studio** via the Pollinations free fallback
- Brand wizard, manual + CSV lead capture, org/team management, analytics, notifications — the data-only features (as long as the path doesn't hit a service-role operation)

## Unlock order (highest leverage first)
1. **Supabase service-role key** → credits, public lead capture, cross-user notifications
2. **Anthropic workspace ID** → ~10 AI features light up at once (content, chatbot, 3 agents, insights, ad copy, landing pages, avatar scripts, lead analysis)
3. **Replicate token** → image (paid) / video / upscale / textures / model training
4. **HeyGen balance** ($5) → avatar rendering end-to-end
5. **Stripe keys** (test mode) → billing
6. **Meta / LinkedIn / Google OAuth apps** → social publishing + ads launch
7. **Twilio / Resend / WhatsApp** → messaging automation actions
