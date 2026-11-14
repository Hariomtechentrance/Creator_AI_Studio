# CreatorAI Studio / GrowthPilot — Exact Features per Module + Market-Domination Roadmap

_Generated 2026-09-06 · from a full read of the codebase_

**Positioning signal:** every AI prompt in the code is written for **"an Indian SMB."** The domination strategy below leans into that — WhatsApp-first, multilingual (Indian languages), payments, regional platforms — plus the table-stakes features needed to beat HubSpot / Jasper / Hootsuite / Canva / Durable.

---

## MODULE 1 — Auth & Foundation

### Built now
- Email/password signup, login, forgot-password, OAuth callback, **passwordless OTP login** (`/api/auth/otp/{send,verify}`), sign-out
- Server-hydrated session store (zustand) — `org`, user, credits available app-wide
- **Credit system:** per-user balance, shared cost table (`src/lib/models.ts`), `credit_transactions` ledger with `spent`/`granted` types, human-readable descriptions
- **Security:** RLS column-lock (migration 003) — users can only self-update `full_name`/`avatar_url`; credits/plan/stripe-ids move only via the service-role client
- Rate limiter (`src/lib/rateLimit.ts`), `/api/health` liveness probe, Sentry wiring

### Add to dominate
- **Google / WhatsApp / Truecaller social login** (India: phone-first, Truecaller is huge)
- **2FA / TOTP**, session device list, "log out everywhere"
- **Referral credits** — invite a friend, both get credits (viral loop for SMBs)
- **Free-trial credits on signup** + a usage meter with "you're running low" nudges
- **Audit log** per org (who changed what) — required to sell to agencies/teams
- Per-seat vs per-org billing toggle

---

## MODULE 2 — Organizations / Teams / Roles

### Built now
- Multi-tenant orgs; `org_members` with roles **owner / admin / member / viewer**
- Email invite flow (`/api/org/invite`), org switcher UI, active-org cookie (`src/lib/supabase/activeOrg.ts`)
- RLS: viewers can't delete the org; only owner/admin mutate settings (migrations 004–005)

### Add to dominate
- **Granular permissions** (per-module: "can publish", "can spend credits", "can see leads") — not just 4 fixed roles
- **Client workspaces for agencies** — one agency account managing N sub-brands, with a client-portal login that sees only their brand
- **Approval workflows** — member drafts → admin approves before anything publishes/sends
- **Shared asset library** across the org (logos, product shots, approved copy)
- **Activity feed** per workspace ("Priya published 3 posts", "2 new leads")
- SSO / SAML for the enterprise tier

---

## MODULE 3 — Brand Intelligence (onboarding + AI analysis)

### Built now
- **6-step brand wizard:** Business Info → Audience → Brand Voice → Competitors → Goals → Platforms. Persists business type, target audience, tone of voice, offerings, USPs, pain points solved, competitors, primary goal, current platforms, monthly budget range.
- **AI Business Analysis engine** (`businessAnalysis.ts`, Claude `claude-opus-4-8`, structured JSON output): produces `brand_summary`, `content_pillars[]`, `recommended_platforms[]`, and 4 insight lists — `insights`, `red_flags`, `opportunities`, `recommendations` (each = title + detail). Computes real lead stats first (by source, by status, avg score by source, conversion rate) and feeds them in. Prompt hard-constrained: **never invent metrics**; call out sparse data as a red flag.
- Output lands in `brand_profiles.ai_brand_summary` / `ai_strategy` + the `ai_reports` table; surfaced at `/ai-insights`, gated behind onboarding completion.

### Add to dominate
- **Auto-fill onboarding from a URL** — paste your website/Instagram, AI scrapes and pre-fills the whole wizard (kills the #1 drop-off point)
- **Live competitor monitoring** — track competitors' posting cadence, promos, ad creative, pricing changes; weekly digest
- **Brand voice from examples** — upload 3 posts you like, AI extracts and locks the voice
- **Market/keyword sizing** for the niche (search volume, trending topics in the category)
- **Re-run analysis on a schedule** with a "what changed since last month" diff
- **Benchmark vs category** — "your conversion rate is 2.1% vs 3.4% median for D2C skincare"

---

## MODULE 4 — Brand Kit

### Built now
- Colour swatches, font tags, **logo upload** (Supabase Storage `brand-logos` bucket), approved-keyword / banned-word tag editors (shared `TagEditor`)
- **Banned/approved words are injected into every AI prompt** in the app (content, chatbot, landing pages, ad copy, avatar scripts, lead/agent chat) — real brand-safety enforcement, not just storage

### Add to dominate
- **Auto-extract kit from logo/website** — pull palette, fonts, logo variants automatically
- **Logo variations generator** (light/dark/mono/favicon/social avatar) + auto background removal
- **Brand-locked templates** — every generated image/video/post auto-applies palette + fonts + logo watermark
- **Tone slider** (formal ↔ playful) + **reading-level control**
- **Multi-brand kits** per org; **compliance dictionary** (legal disclaimers auto-appended for regulated niches — finance, health, edtech)
- Asset DAM with tags, versions, usage rights, expiry dates

---

## MODULE 5 — Campaigns & Ads

### Built now
- **AI ad-copy generation** (`adCopy.ts`): 3 headlines (<40 chars), primary text, CTA label, one-paragraph audience/targeting suggestion, one-sentence budget guidance — all brand-aware, per platform + goal. Explicitly labels budget as a starting-point estimate (no live ad data).
- Saves as draft `campaigns` rows (name, platforms, goal, status)
- **Ads launch** (`/api/ads/launch`): creates a **PAUSED** campaign shell on **Meta Ads** (`createMetaCampaign`, objective-mapped) or **Google Ads** (`createGoogleSearchCampaign` — creates a daily budget + PAUSED SEARCH campaign). Never auto-enabled — safety property held deliberately. Google Ads API pinned to v17.
- Optimisation (budget reallocation, CTR, audience segmentation) — gated behind live ad-account data that doesn't exist yet.

### Add to dominate
- **Full campaign build, not just a shell** — ad sets, targeting, creative, keywords, then one-click activate
- **Creative generation in-loop** — AI writes copy *and* generates the image/video for the ad, in-brand
- **Live performance sync** — pull spend/CTR/CPL/ROAS back in; unified dashboard across Meta + Google
- **AI optimisation that acts** — auto-pause losers, shift budget to winners, refresh fatigued creative (with an approval gate)
- **A/B/n creative testing** with auto-scaling of the winner
- **WhatsApp Click-to-Chat ads** (huge in India) as a first-class campaign type
- **UTM builder + attribution** tying ad spend → leads → revenue
- Budget pacing alerts, dayparting, negative-keyword mining

---

## MODULE 6 — Content Studio

### Built now
- **AI content generation** (`contentGeneration.ts`): one variation per selected platform, each with caption + hashtags + CTA. Platform-aware rules (IG/FB long + 8–15 hashtags; LinkedIn professional + 2–4; Twitter/X ≤280 + 1–3). Brand-aware, banned-word enforced.
- Save drafts to `content_posts`; **schedule** via `scheduled_at`
- `/content/calendar` (draft + scheduled view), `/publish` (publishing hub), `/content/create` (quick-create entry)
- Real publishing to **Facebook Page, Instagram (2-step container/publish), LinkedIn (text-only), YouTube (resumable video upload)** via `/api/social/publish`

### Add to dominate
- **Multi-language generation** — Hindi, Tamil, Telugu, Marathi, Bengali, Hinglish (this alone is a wedge in India)
- **Content calendar autopilot** — AI fills a month of posts from your content pillars + festivals/holidays calendar (Diwali, Holi, regional festivals, sale days)
- **Image/video attached at generation time** — full post, not just caption
- **Repurpose engine** — 1 blog → 10 posts → 5 reels scripts → 1 newsletter → 1 carousel
- **Trend/hook library** refreshed daily per niche; **hashtag research** with reach estimates
- **First-comment scheduling, carousels, Reels/Shorts, Stories, threads**
- **Best-time-to-post** learned from the account's own history
- **Bulk CSV import + AI polish**; **Chrome extension** to draft from any page
- Regional platforms: **ShareChat, Moj, Josh, Koo**
- Approval + client-review links; post-performance → "make more like this"

---

## MODULE 7 — Landing Pages

### Built now
- **AI page generation** (`landingPage.ts`): internal title, hero headline (<12 words) + subheadline, 3–4 sections (heading + body), CTA label — brand-aware, banned-word enforced
- **Section editor:** add / edit / reorder / delete
- **Public unauthenticated render** at `/lp/[slug]` (service-role read)
- **A/B testing:** Variant B (headline/subheadline/CTA), atomic view/conversion counters via `increment_ab_stat()` RPC, sticky per-visitor variant assigned in `proxy.ts` via `x-lp-variant` header
- **Public lead-capture form** → `leads` pipeline (source = website)

### Add to dominate
- **Real visual/section templates + drag-drop builder** (not just heading/body blocks) — images, testimonials, pricing tables, FAQ accordions, countdown timers, logos strip, video embed
- **AI hero image / background generation** in-brand
- **Custom domains + SSL** (this is the current explicit gap; big conversion driver)
- **Forms builder** (multi-field, file upload, conditional logic) + **native payments** (Razorpay/UPI/Stripe) → sell a product from the page
- **WhatsApp CTA** button + auto-open chat with prefilled message
- **Pop-ups / exit-intent / sticky bars**, **PageSpeed-optimised output**, SEO meta + schema, **pixel + GA4** injection
- **Multi-variant AI testing that auto-promotes the winner**; heatmaps / session replay
- **Blog/CMS** + programmatic SEO pages ("best X in {city}")

---

## MODULE 8 — Leads

### Built now
- Capture: **manual, CSV import** (custom RFC-ish CSV parser handling quotes/escapes), **website form, WhatsApp**
- **Heuristic lead scoring** (`scoring.ts`): base 20 + email/phone/company/high-intent-source bonuses, capped 100, with a human-readable reason. `ai_score`/`ai_score_reason` columns already exist for an AI upgrade.
- Status model: new / contacted / converted / lost (extended set — qualified/interested/warm/hot/negotiation — exists in types but UI trimmed to 4; **no Kanban sales pipeline, deliberate**)
- **Tasks / follow-ups** (`tasks` table, types incl. `follow_up`), overdue-task checker route
- **AI lead analysis** (`leadAnalysis.ts`): 2–3-sentence summary, one concrete next action, risk flag (e.g. "no contact in 5+ days despite high score") — reasons only from notes, never invents contact history

### Add to dominate
- **AI scoring that actually uses the AI** (behaviour, engagement, firmographics, source quality) replacing the heuristic
- **Lead enrichment** — company size, industry, socials, email/phone validation from just a name/email
- **Auto-assignment + round-robin + SLA timers** with escalation
- **Deduplication + merge**, **activity timeline** (every email/call/WhatsApp/page-view in one view)
- **Web tracking pixel** — see which leads visited which pages, trigger alerts on high-intent behaviour
- **Bulk actions + saved segments + smart lists**
- **2-way WhatsApp/email inbox on the lead record**; click-to-call
- **Revenue attribution** back to the campaign/post/page that created the lead

---

## MODULE 9 — Community / Inbox (AI chatbot + channels)

### Built now
- **AI chatbot** (`chatbot.ts`): short conversational replies (2–4 sentences), brand-context only, honest "I don't know" + offer human handoff, sets `should_escalate` + reason on frustration/human-request/unknowns, acknowledges buying intent (lead created separately). Persists to `conversations` / `messages`.
- Website-widget test flow at `/community`
- **WhatsApp inbound webhook** (`/api/webhooks/whatsapp`): parses the nested payload, finds/creates the lead (source = whatsapp) + conversation, runs the same chatbot brain, sends the reply back — **one real second channel into the same pipeline**
- **Social account connections** (Meta IG+FB, LinkedIn, Google/YouTube/Ads) — real OAuth2 auth-code flow, CSRF-safe state (`oauthState.ts`), long-lived token exchange, `social_accounts` upsert

### Add to dominate
- **Embeddable website chat widget** (script tag) — currently only a test flow, needs the real deployable widget
- **Unified inbox** — WhatsApp + Instagram DM + Messenger + email + web chat in one thread view, with the AI drafting and a human approving
- **RAG knowledge base** — upload FAQs/PDFs/catalogue; chatbot answers from real docs with citations
- **WhatsApp template messages + broadcast campaigns** (opt-in lists, 24-hour window handling) — this is the killer India feature
- **Product catalogue + cart + checkout inside WhatsApp**
- **Appointment booking** in-chat (calendar integration)
- **Instagram comment → DM automation**, story-mention replies, keyword auto-responders
- Sentiment tagging, CSAT after resolution, canned responses, working-hours + away messages
- Voice notes (STT), multilingual auto-detect + reply

---

## MODULE 10 — AI Agents

### Built now
- **Marketing Agent** — content/social/campaign advice; refuses to invent metrics; falls back to best-practice when no platform data
- **Business Consultant** — growth strategy, revenue projection *only* from actual converted-lead value trend (explicitly caveated), competitor analysis *only* from owner-entered competitors
- **Sales AI Agent** — per-lead: qualify, objection-handling drafts, 2–3 meeting-time suggestions (can't book), ready-to-send follow-up drafts in brand tone
- All inject real org context (brand, lead stats, campaigns, latest AI report) into the Claude system prompt; chat history session-only (not persisted)

### Add to dominate
- **Persistent agent memory** — remembers past sessions, decisions, your preferences
- **Agents that take actions** (with approval): "draft next week's calendar" → actually creates the drafts; "follow up with all warm leads" → queues the messages
- **Scheduled/proactive agents** — a daily "here's what needs your attention" brief; anomaly alerts ("leads down 40% this week")
- **Voice mode** (talk to your marketing agent on the commute)
- **Agent marketplace** — niche-tuned agents (D2C, real estate, edtech, clinics, restaurants)
- **Analyst agent** — ask questions of your data in plain language, get charts back
- **Multi-agent workflows** — Consultant sets strategy → Marketing agent executes → Sales agent works the leads

---

## MODULE 11 — Automations

### Built now
- Rule engine (`engine.ts`): triggers **`lead_created`**, **`lead_status_changed`** → ordered actions, logged to `automation_logs` with success/fail + which actions ran, `run_count`/`last_run_at` tracked
- Actions: **`create_follow_up_task`** (delay_hours), **`notify_assignee`**, **`send_whatsapp_message`** (uses connected WhatsApp number), **`send_sms`** (Twilio), **`send_email`** (Resend) — all with `{name}`/`{company}` template vars
- Wired into the lead-created path + overdue-task checker

### Add to dominate
- **Visual flow builder** (drag nodes, branch on conditions, wait steps, A/B splits)
- **Many more triggers** — form submit, page visit, email opened/clicked, tag added, date/anniversary, WhatsApp reply, cart abandoned, payment received, no-activity-for-N-days
- **Multi-step drip sequences** across channels with smart send-time
- **Goal tracking per automation** ("12 → 4 converted, ₹80k influenced")
- **Templates gallery** — "Welcome new lead", "Re-engage cold", "Post-purchase upsell", "Review request", "Festival offer blast"
- **Webhook / Zapier / Make / n8n** action + trigger; internal Slack/Teams notifications
- Rate limits + quiet hours + frequency capping so you don't spam contacts

---

## MODULE 12 — Analytics

### Built now
- Real metrics computed from `leads` / `conversations` / `campaigns`: conversion rate, **average human response time** (lead message → first `human_agent` reply gap), source performance, campaign performance
- **Honest**: returns `null` and hides the tile rather than showing a fake `0` when there's no data

### Add to dominate
- **Unified cross-channel dashboard** — social reach/engagement + ad spend/ROAS + web traffic + leads + revenue in one place
- **Attribution & funnel** — impression → click → lead → customer → repeat, with first/last/multi-touch models
- **Custom report builder + scheduled email/PDF/WhatsApp reports** (agencies live on this)
- **Cohort & retention**, LTV, CAC, payback period
- **AI narrative** — "Revenue up 18%; driven by the Diwali landing page; Instagram CPL rose, shift budget"
- **Goal setting + pacing** ("₹5L this quarter — you're 12% behind")
- Benchmarks vs category; anomaly detection with alerts
- **White-label client dashboards** with shareable links

---

## MODULE 13 — Notifications

### Built now
- Real bell + list UI, new-lead trigger, `/api/notifications/lead-created`
- Cross-user fan-out needs the admin/service client wired through (currently own-user)

### Add to dominate
- **Channel preferences** per user — in-app / email / **WhatsApp** / push / Slack
- **Digest mode** (hourly/daily rollup) vs real-time, per notification type
- **Smart priority** — surface only what needs action; snooze; assign-from-notification
- Mobile push (PWA / app); @mentions in comments; billing/credit alerts

---

## MODULE 14 — Creative Studio (7 tools)

### 14a · AI Image Studio — built now
- **4 providers with graceful fallback:** Replicate (Flux Pro/Dev/Schnell, SDXL, Ideogram v2, Stable Cascade), OpenAI DALL·E 3 (HD, natural/vivid), Stability Stable Image Ultra + SD3 img2img, **Pollinations free fallback** (works with no key)
- **Human-subject auto-detection** → swaps in a photojournalistic prompt + camera/lens boost + a long negative-prompt for anatomy/skin realism
- 12 style presets (Portrait, Cinematic, Anime, Oil Painting, Cyberpunk…), negative prompts, batch count, steps/guidance, **img2img** with strength, aspect-ratio mapping per provider
- Per-model credit cost (1–8), credit gating, `generations` row written

### 14b · AI Video Studio — built now
- **Replicate:** Kling v1.6, Luma Ray (text-to-video + image-to-video, camera-motion param)
- **Free fallbacks:** Lightricks **LTX-2** on a public HF Space (no key), and a **fully-local ffmpeg Ken Burns** pan/zoom on an uploaded photo (zero cost, no GPU)
- `maxDuration=300`, downloads output, runs local ffmpeg post-processing

### 14c · AI Avatar Studio — built now
- **HeyGen v3** (just migrated): `POST /v3/videos`, poll `GET /v3/videos/{id}`, `/v3/avatars/looks` + `/v3/voices` for the picker
- **Idea → script** via Claude (`avatarScript.ts`) — hook / agitation / solution / CTA structure, 40–90 words, brand-voice aware; `previewOnly` mode to edit the script before spending credits
- Script mode (write your own) or Idea mode; 30-credit cost

### 14d · Textures & 3D — built now
- Replicate Flux-dev generates the diffuse map; **`derivePbrMaps()`** deterministically derives height (luminance), normal (Sobel), roughness (high-freq detail), AO (local cavity) — real reproducible derivations, not placeholders. Metallic can't be derived from one image (flat dark map).

### 14e · Upscaler — built now
- Replicate Real-ESRGAN (2×/4×, face-enhance toggle); model options for clarity/SUPIR fall back to Real-ESRGAN; 10–20 credits

### 14f · Model Training (LoRA) — built now
- Uploads training images to a private bucket → zips (`jszip`) → signed URL → **`ostris/flux-dev-lora-trainer`** on Replicate, `latest_version` resolved dynamically, 1000 steps, trigger word, private destination model; status polled on demand

### 14g · Canvas — built now
- fabric.js in-browser editor (`/canvas`)

### Add to dominate (Creative Studio overall)
- **One unified "Studio"** — generate image → animate it → add captions/voiceover → post, without leaving the screen
- **Brand-locked output** — palette/fonts/logo auto-applied to everything
- **Templated social-graphic editor** (Canva-style) with 1000s of resizable templates, magic resize, one-design-all-sizes
- **Background remove / replace, magic eraser, inpaint/outpaint, generative fill, product-photo backgrounds** (huge for D2C sellers)
- **Batch product-catalogue generation** — upload a CSV of products → get a post/ad/graphic each
- **Avatar overlay VFX** (the deferred holographic-compositing feature) + B-roll/stock library + auto-captions + music
- **Talking-avatar in 20+ Indian languages** (HeyGen supports many)
- **Reels/Shorts auto-editor** — script → stock/broll → captions → voiceover → music → export vertical
- **Real 3D** (image-to-3D via a proper model), proper full-PBR via a dedicated model
- **Video upscaling + frame interpolation**, image-to-video expansion
- Stock integration (Unsplash/Pexels), icon/illustration libraries, meme generator

---

## MODULE 15 — Billing & Plans

### Built now
- Stripe Checkout per plan (`/api/billing/checkout`), webhook (`checkout.session.completed` → grant plan + credits; `customer.subscription.deleted` → revert to free), 3 configured price IDs (Apprentice / Artisan / Maestro)
- Per-user/creator billing model (not per-org)

### Add to dominate
- **Razorpay / UPI / Paytm** (Stripe is painful for Indian customers) + INR pricing, GST invoices
- **Usage-based / credit top-ups** + auto-recharge; **annual plans** with discount
- **Free tier with watermark** → conversion funnel; in-app upgrade prompts at the moment of need
- **Agency/reseller billing** — bill your own clients through the platform, take a margin
- Proration, dunning, failed-payment recovery, coupons, referral credits, affiliate program
- Plan-based feature gating that's actually enforced server-side per feature

---

## MODULE 16 — White Label

### Built now
- Toggle in-app **name + logo** (agency plan + owner/admin only, server-checked); sidebar + footer read `white_label_enabled` / `white_label_name`
- Custom domains explicitly out of scope (needs DNS/hosting infra)

### Add to dominate
- **Full white-label** — custom domain (`app.youragency.com`), custom email sender, custom login page, remove all "GrowthPilot" traces, custom favicon/colours
- **Client portal** — your clients log into *your* brand, see only their workspace + dashboards
- **Reseller console** — provision client accounts, set their plan/limits, see MRR across all clients
- White-labelled PDF reports and shareable dashboards
- API + embeddable widgets under the agency's brand

---

## MODULE 17 — Marketplace

### Built now
- Honest roadmap page linking to what already works as templates (automation templates, landing pages, content presets)

### Add to dominate
- **Template marketplace** — creators sell automation flows, landing-page designs, content calendars, ad-copy packs, prompt packs; revenue share
- **Service marketplace** — connect SMBs with vetted freelancers/agencies for setup, design, ad management
- **Integrations directory** — one-click connect to Shopify, WooCommerce, Razorpay, Tally, Zoho, Google Business Profile, Justdial, IndiaMART
- **Niche starter kits** — "Restaurant in a box", "Real-estate agent kit", "Coaching-institute kit" (pre-built brand kit + automations + templates + landing pages)

---

## Cross-cutting: what turns this into a category leader

1. **WhatsApp Business Platform, done properly** — broadcasts, templates, catalogue, cart, checkout, chatbot, click-to-WhatsApp ads. In India this is *the* channel; owning it is the moat.
2. **True multilingual** — generate, chat, and caption in 10+ Indian languages + Hinglish, everywhere.
3. **Payments-native** — Razorpay/UPI in landing pages, WhatsApp, and invoices; sell, don't just market.
4. **Closed loop: ad/post → lead → conversation → sale → repeat**, with revenue attribution visible end-to-end. Nobody in the SMB tier does the whole loop well.
5. **Ecommerce connectors** — Shopify/WooCommerce/IndiaMART sync products → auto-generate catalogues, ads, and posts.
6. **Google Business Profile + review management** — post offers, reply to reviews with AI, track local rankings (critical for local SMBs).
7. **Mobile app / PWA** — SMB owners run their business from a phone.
8. **Agency layer** — full white-label + client portal + reseller billing is a separate, higher-ACV market on the same codebase.
9. **Templated visual editor** (Canva-parity) so users never leave for design.
10. **Onboarding in 5 minutes** — paste a URL, get a filled brand kit + a month of content + 3 automations + a landing page, ready to review.
