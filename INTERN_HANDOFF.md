# CreatorAI Studio — Intern Handoff & Work Plan

_Generated 2026-09-06 · for 4 new interns · repo branch of record: `main` (local), active work on `validate/generation-pipelines`_

---

## 1. Read this first — what "completed" actually means

**Completed = code written, TypeScript compiles, `npm run build` passes, the UI renders, the route responds without crashing.**

**Completed does NOT mean:** tested against live third-party services, tested with a real logged-in user, or verified end-to-end with real data. Almost the entire app was built against **placeholder API keys**. Your job is largely to take each "built" feature and make it **actually work** with real credentials, fixing the bugs that surface.

Two real bugs have already been found this way in the last session (a dead HeyGen status endpoint; a workspace-scoped Anthropic key). Expect more.

---

## 2. What is COMPLETED (built, not yet validated)

### Foundation
- ✅ Supabase auth: signup, login, forgot-password, OAuth callback, **OTP login**, sign-out
- ✅ Multi-tenant orgs, roles (owner/admin/member/viewer), team invites, org switcher
- ✅ Credit system: balances, cost table, `credit_transactions` ledger, RLS lock against self-granting
- ✅ 11 DB migrations (`supabase/migrations/001`–`011`) with RLS policies
- ✅ Rate limiting, `/api/health` probe, Sentry config, proxy auth-guard

### Feature modules (17)
| Module | Built | Needs to be validated with |
|---|---|---|
| Brand onboarding wizard | ✅ | Supabase |
| AI Business Analysis (`/ai-insights`) | ✅ | Anthropic |
| Brand Kit (colours/fonts/logo/keywords) | ✅ | Supabase Storage |
| Campaigns + AI ad copy | ✅ | Anthropic |
| Ads launch (PAUSED shell on Meta/Google) | ✅ | Meta + Google Ads OAuth |
| Content Studio (generate / schedule / calendar / publish) | ✅ | Anthropic + social OAuth |
| Landing Pages (AI gen + section editor + A/B + public render) | ✅ | Anthropic + service key |
| Leads (manual / CSV / web form / WhatsApp + scoring) | ✅ | Supabase |
| AI lead analysis | ✅ | Anthropic |
| Community / Inbox — AI chatbot | ✅ | Anthropic |
| WhatsApp inbound channel (webhook → lead → chatbot → reply) | ✅ | WhatsApp Cloud API |
| AI Agents — Marketing / Business Consultant / Sales | ✅ | Anthropic |
| Automations rule engine | ✅ | Twilio / Resend / WhatsApp for messaging actions |
| Analytics (real metrics from data) | ✅ | Supabase + data |
| Notifications (bell + list + new-lead trigger) | ✅ | service key for cross-user |
| Billing (Stripe checkout + webhook) | ✅ | Stripe |
| White Label (in-app name/logo swap) | ✅ | — |
| Marketplace | ✅ (intentional roadmap page) | — |

### Creative Studio (7 tools)
| Tool | Built | Backend |
|---|---|---|
| AI Image Studio | ✅ **working now** via Pollinations free fallback | Replicate (paid path) |
| AI Video Studio | ✅ | Replicate (Kling/Luma) + Ken-Burns ffmpeg |
| AI Avatar Studio | ✅ **migrated to HeyGen v3** last session | HeyGen v3 + Claude script |
| Textures & 3D | ✅ (diffuse map only; other PBR maps partial) | Replicate |
| Upscaler | ✅ | Replicate |
| Model Training (LoRA) | ✅ | Replicate + Storage |
| Canvas (fabric.js) | ✅ | client-side |

---

## 3. What is REMAINING

### A. Validation (the bulk of the work — do this before any new features)
Every row above marked "needs to be validated" = an end-to-end test with a real key, plus fixing whatever breaks. Grouped into the 4 streams in section 5.

### B. Known deferred / partial work
- **Avatar Studio overlay VFX** — the holographic-overlay compositing (ffmpeg over HeyGen output) was explicitly deferred. Not started.
- **PBR texture maps** — only diffuse/albedo is real; normal/roughness/metallic/AO/height need a dedicated model.
- **LinkedIn Company Page posting** — only personal-profile posting is built (Company Pages need LinkedIn partner approval).
- **Custom domains for White Label** — out of scope (needs DNS/hosting infra).
- **Cross-user notification fan-out** — needs the admin/service client wired through.
- **Marketplace backend** — currently a static roadmap page by design.

### C. Planned new modules (from the product roadmap — start only after validation)
- **Module 22 — Prompt-to-Post:** one prompt → Claude caption + Replicate image → draft in the publish queue with an approve step.
  Order: add `approval_status` + `source` columns to the posts table → build `/api/generate-and-post` → wire a review/approve UI into the existing calendar.
- **Module 23 — shared async video infra:** a `video_jobs` table + status flow (`queued → rendering → compositing → ready → approved → published`). **Open technical risk to resolve first:** where does ffmpeg run in the deploy target? A serverless API route may not be enough — may need a separate worker/queue.
  - **23a:** overlay-template library + timing logic + ffmpeg composite pass over validated HeyGen renders.
  - **23b:** script → visuals → captions → stitch. Decide TTS provider first (HeyGen voice-only vs. adding ElevenLabs).

---

## 4. Current blockers (someone with account access must provide these)

| # | Credential | Unlocks | Owner |
|---|---|---|---|
| 1 | Supabase **service-role key** | credits, public lead capture, cross-user notifications | — |
| 2 | **Anthropic workspace ID** (`wrkspc_…`) — code already wired for it via `ANTHROPIC_WORKSPACE_ID` | ~10 Claude features at once | — |
| 3 | **Replicate token** (`r8_…`) | video / upscale / textures / training | — |
| 4 | **HeyGen balance** ($5 pay-as-you-go, API wallet) | avatar rendering end-to-end | — |
| 5 | **Stripe** test secret + webhook secret | billing | — |
| 6 | **Meta / LinkedIn / Google** OAuth apps | social publishing + ads launch | — |
| 7 | **Twilio / Resend / WhatsApp Cloud** | messaging automation actions | — |

---

## 5. Proposed split — 4 work streams

Each intern owns one stream end-to-end: validate every feature in it, fix the bugs, write a short test note per feature ("tested X with real key, works / found bug Y, fixed in commit Z").

### Intern 1 — Environment & Billing Foundation
**Goal:** a real, fully-wired backend everyone else builds on.
- Stand up the real Supabase project; run migrations `001`–`011` in order; confirm RLS.
- Add the service-role key; verify credit deduction, public `/api/public/lead-capture`, notifications fan-out.
- Full auth smoke: signup → login → onboard → org create → invite a teammate.
- Wire Stripe **test mode**: checkout for each plan, webhook grants plan+credits, `subscription.deleted` reverts to free.
- Deliverable: a one-page "environment is live" note + a seeded test org other interns can log into.

### Intern 2 — AI Text Features (Claude)
**Goal:** every Claude-backed feature produces real, correct output.
- Add `ANTHROPIC_WORKSPACE_ID`; confirm `getAnthropicClient()` sends the header.
- Validate end-to-end, one by one: Business Analysis, Content Studio generation, Chatbot, the 3 AI Agents, Ad Copy, Landing-Page generation, Lead Analysis, Avatar script expansion.
- For each: check the JSON parses, the `output_config.format` schema matches, brand keywords/banned words are actually applied, error paths are graceful.
- Watch for: model-id / API-shape drift, `max_tokens` too low (truncation), prompt cruft.
- Deliverable: per-feature test note; a shared prompt/its-schema reference.

### Intern 3 — Creative & Media Pipelines (Replicate + HeyGen)  ← _work already in flight on `validate/generation-pipelines`_
**Goal:** every generation pipeline renders a real asset and deducts credits correctly.
- Continue the existing branch. Order: Avatar Studio (HeyGen v3 — needs balance) → Video (Replicate + Ken-Burns ffmpeg) → Image (paid Replicate path) → Upscaler → Textures → Model Training.
- For each: real render, credit deduction, `generations` row written, output URL valid, failure path handled.
- Resolve the **ffmpeg-in-deployment** question early (blocks Module 23).
- Then: start Module 23a (avatar overlay compositing) once HeyGen renders are solid.
- Deliverable: per-pipeline test note; a decision doc on the video-jobs / worker architecture.

### Intern 4 — External Integrations (Social + Messaging)
**Goal:** posts actually publish; messages actually send.
- Register OAuth apps: Meta (Instagram+Facebook, incl. `ads_management`), LinkedIn, Google (YouTube + Ads).
- Validate: connect flow → `social_accounts` row → real post to each platform → ads launch creates a PAUSED shell.
- WhatsApp Cloud: inbound webhook → lead + conversation + chatbot reply round-trip.
- Twilio SMS + Resend email: wire keys, test the 3 automation actions (`send_whatsapp_message`, `send_sms`, `send_email`).
- Reuse `src/lib/social/oauthState.ts` for CSRF-safe state — don't re-invent it.
- Deliverable: per-integration test note; a setup guide for each OAuth app (redirect URIs, scopes).

---

## 6. Standing rules for everyone

1. **Branch per stream.** PR into `main`. Never commit secrets — all `.env*` is gitignored; keep it that way.
2. **`AGENTS.md`:** this is a modified Next.js 16 — read `node_modules/next/dist/docs/` before writing routing/proxy/config code; heed deprecation notices (`middleware` → `proxy`, etc.).
3. **Verify ritual:** after each change run `npx tsc --noEmit`, `npx eslint <files>`, and — for anything non-trivial — `npm run build` with the dev server **stopped** (concurrent build + dev corrupts the `.next` cache).
4. **Only one Next.js process** against this `.next` dir at a time.
5. **Don't trust `tsc`/`eslint` for provider correctness** — actually call the real API and read the response. That's how both existing bugs were caught.
6. **Honest gaps, never fake results.** If a provider isn't configured, the UI shows a disabled state with a one-line reason — keep that pattern.
7. Write a short **test note per feature** so we can see coverage at a glance.
