# Research: Auto-Dialer / AI Calling Agent for CreatorAI Studio

_2026-09-06 · research complete_

**Goal:** an outbound calling capability where the platform, given a list of leads,
automatically places calls — either connecting a human agent (dialer) or running a
fully autonomous **AI voice agent** that talks to the lead in natural language —
and writes the call outcome (answered / voicemail / interested / callback / DNC /
transcript / recording) back onto the lead record so automations can react.

The user's reference point, **"Tata dialer"**, is **Tata Tele Business Services
Smartflo** (Tata's cloud contact-centre; also sold under the **Servetel** brand).



## 1. What "Tata dialer" (Smartflo) actually is

Smartflo is a **cloud contact-centre / cloud-telephony** product. Its outbound side
is an **auto-dialer** with campaign management:

- **Dialer modes:** Preview, Progressive, Power, Ratio, **Predictive**.
- Upload a contact list → segment → queue → the system dials automatically and
  connects **answered** calls to **free human agents**.
- **Answering-machine / voicemail detection (AMD)** filters dead calls before an
  agent is used.
- **API Dialplan** — Smartflo calls *your* REST endpoint on each call so you can
  route based on CRM data, and there are REST APIs for click-to-call, call logs,
  recordings, and campaign control.
- CRM connectors (Zoho, Bitrix24, LeadSquared, etc.), call recording, live
  dashboards, ACD for inbound.

So "just give it data and it calls" = **an auto-dialer feeding human agents**.
Smartflo by itself is *not* an AI that talks to the lead — that is a second,
newer product category (below).



## 2. Two different things people mean by "calling agent"

| | **A · Auto-dialer + human agents** | **B · Autonomous AI voice agent** |
|---|---|---|
| What happens on the call | Software dials, a **person** talks | An **AI** (speech-to-text → LLM → text-to-speech) holds the conversation |
| Needs a call-centre team? | Yes | No |
| Good for | High-value sales, complex qualification | First-touch qualification, reminders, confirmations, surveys, "are you still interested?", payment nudges, lead re-activation at scale |
| Example products | Tata Smartflo, Exotel Auto Dialer, Ozonetel, Knowlarity | Bolna, Vapi, Retell AI, Bland AI, ElevenLabs Agents, Gnani, Squadstack |
| Cost shape | Telephony/min + agent salaries + seat licences | Telephony/min + AI/min (STT+LLM+TTS), no salaries |
| Fit for CreatorAI Studio (self-serve SMB SaaS) | Weak — our users mostly don't have call-centre staff | **Strong** — "press a button, the AI calls your 200 new leads and tells you who's interested" |

**Recommendation up front:** build **B (AI voice agent)** as the headline feature,
with a **"transfer to a human / assign a callback task"** path that also serves the
minority of users who do have staff. Section 8 has the architecture.



## 3. How an auto-dialer works (mechanics — applies to both A and B)

1. **Campaign** = a filtered list of leads + a script/assistant + a schedule +
   retry rules (max attempts, gap between attempts, per-outcome retry).
2. **Pacing** — how aggressively to dial:
   - *Preview*: agent sees the lead, clicks to call. 1:1.
   - *Progressive*: dials the next number the moment an agent frees up. 1:1, no abandoned calls.
   - *Predictive*: dials **ahead** of agent availability using pickup-rate math; maximises talk time but can **abandon** calls (illegal/penalised past a threshold in many regimes). Only makes sense with a pool of agents.
   - For an **AI agent** there is effectively an unlimited "agent pool", so you dial
     as fast as your provider concurrency + telephony rate limits allow.
3. **Answer detection / AMD** — decide human-picked-up vs voicemail vs ring-no-answer
   vs busy vs invalid. Route: human → connect to agent/AI; voicemail → optional
   drop a pre-recorded message; no-answer → schedule retry.
4. **Disposition** — every call ends with an outcome code (interested, not
   interested, callback, wrong number, DNC, no answer, failed). This is the data
   that flows back to the lead.
5. **Compliance gates** before every dial — DND/DNC scrub, consent check, allowed
   calling window, frequency cap. (Section 7.)



## 4. AI voice-agent architecture (product category B)

**The real-time loop, per call:**

```
caller audio ──▶ STT (streaming) ──▶ LLM (your prompt + tools) ──▶ TTS ──▶ caller
                     ▲                        │
                 barge-in / VAD          function calls ──▶ your backend
                 (user interrupts)        (check availability, book slot,
                                           mark interested, fetch price…)
```

- **Latency target:** < 800 ms round-trip so it feels human. Good platforms hit
  300–500 ms.
- **Barge-in:** the agent must stop talking the instant the human speaks.
- **Function calling / webhooks:** the agent can call your API mid-call
  (e.g. `mark_lead_interested`, `schedule_callback`, `send_whatsapp_brochure`) and
  you get lifecycle webhooks (call started / ended / transcript ready / recording ready).
- **Script = a system prompt.** We already run **Claude** in this codebase and
  already build brand-aware prompts (`src/lib/ai/*`) — the call script is the same
  pattern: brand profile + offerings + banned words + objective → a spoken-style
  prompt. The `avatarScript.ts` hook/agitation/solution/CTA structure is a close
  template.

**Three integration philosophies among providers:**

- **Managed pipeline (Retell AI, Bolna, ElevenLabs Agents):** they own STT+LLM+TTS+telephony. You configure a prompt + tools. Fastest to ship, least control.
- **Orchestration layer (Vapi):** bring-your-own LLM (Anthropic ✅), TTS, STT, and telephony (Twilio/Telnyx/Plivo); Vapi orchestrates real-time. Good middle ground — lets us keep Claude and pick an Indian-language TTS.
- **Raw stream (Bland AI, or DIY on Twilio Media Streams / Twilio ConversationRelay):** you stream audio frames yourself. Max control, most work.

**Outbound call API shape is uniform-ish.** e.g. Vapi:
`POST /call` with `phoneNumberId` (your caller ID), `customer.number` (E.164),
and `assistantId` (or an inline assistant). Pass an array of `customers` to batch.
The saved assistant carries its own server-webhook + tool config. Retell and Bland
are equivalent.



## 5. Provider landscape (India-relevant, 2026)

### 5a. Telephony / CPaaS (the actual phone line)

| Provider | Notes |
|---|---|
| **Exotel** | India market leader. Has its own **Auto Dialer** product + Programmable Voice APIs (Voice v1/v3, ExoML, "Connect Two Numbers", progressive-dialer recipe, AMD). Strong DLT handling. |
| **Ozonetel (CloudAgent)** | Full contact-centre + dialer, KooKoo API, popular for predictive dialing. |
| **Knowlarity (now part of Gupshup)** | Cloud telephony + SmartIVR + dialer. |
| **Tata Smartflo / Servetel** | The user's reference. Solid, enterprise-leaning, API Dialplan. |
| **MyOperator / Acefone** | SMB-friendly cloud telephony, has a voicebot pricing page. |
| **Kaleyra (Tata)** | CPaaS, more enterprise/messaging-led. |
| **Plivo** | Clean REST API, good SDKs, competitive India in/out rates, India DID in 24–48h. Good if we orchestrate ourselves. |
| **Twilio** | Global heavyweight. India outbound ≈ **$0.0075/min**. Needs Voice Geographic Permissions enabled for India. Expensive relative to local, unbeatable if multi-country. Has **Media Streams** + **ConversationRelay** for DIY voice AI. |
| **Telnyx / Vonage** | Alternatives to Twilio, similar model. |

### 5b. AI voice-agent platforms

| Platform | Positioning | Indicative price |
|---|---|---|
| **Bolna** (YC, India) | **Built for Indian languages** — Hindi, Tamil, Telugu, Bengali, Marathi, Hinglish + more; <300 ms latency; 20+ ASR/LLM/TTS models; bulk outbound campaigns; human-in-the-loop escalation; India data residency; no-code + API. | ~$0.02/min platform + model costs ≈ **~$0.06/min all-in**; Starter $100 / 1,000 min |
| **Vapi** | Orchestration layer, BYO-LLM (Anthropic), BYO-TTS/telephony, deep webhooks/function-calling. | ~₹3/min + ~₹4,000/mo base (India resellers); ~$0.05–0.09/min + component costs direct |
| **Retell AI** | Managed pipeline, best tool-definition ergonomics, reliable at scale. | ~$0.07–0.10/min all-in |
| **Bland AI** | Outbound-focused, raw WebSocket, BYO-LLM, edge inference. | ~$0.09/min |
| **ElevenLabs Agents** | Best-in-class TTS voices, growing agent product. | TTS-led pricing |
| **Synthflow / Play.ai / Vocode (OSS)** | No-code builders / open-source toolkits. | varies |
| **Gnani.ai, Squadstack, Caller Digital, Ringg AI, Kommunicate** | India-native voice-AI / calling stacks, some do telephony + agent + compliance in one. | Ringg ~$0.08/min bundled; others enterprise-quote |

### 5c. Rough all-in cost (India, domestic mobile, outbound)

- **Telephony:** ₹0.35–0.75 /min (local CPaaS) — Twilio ≈ ₹0.65/min.
- **AI agent (STT+LLM+TTS):** ₹1–3 /min self-serve; premium/enterprise higher.
- **Blended:** **≈ ₹1.5–4 /min** of connected call.
- **Setup / integration:** ₹1–5 lakh if bought as a managed enterprise project;
  far less if we self-integrate a self-serve API (Bolna/Vapi).
- **Minimum viable pilot:** ~₹15–20k (₹15k setup + ₹4–5k first month of calls).
- Only **connected** minutes cost the AI meter; ring-no-answer is telephony-cheap.



## 6. Indian language quality — why this matters for us

Our users' leads mostly want to be called in **Hindi / regional languages /
Hinglish**, not English. This is exactly where generic US platforms (Bland, early
Vapi voices) are weakest and where **Bolna** (and Gnani, Ringg) are purpose-built.
Language coverage + accent + code-switching (Hinglish) should be a **primary
selection criterion**, ahead of price.



## 7. India regulation — MUST design around this (not optional)

Outbound commercial calling in India is heavily regulated (TRAI + DPDP Act). Key
rules as of 2026:

1. **DLT registration.** The business (Principal Entity), its telemarketer, caller
   identities, and **call scripts/templates** must be registered on the TRAI
   **DLT** platform before any calls go out.
2. **Number series.** Promotional calls must originate from **140-series**;
   BFSI/service calls from **1600-series** (mandate effective 1 Jan 2026). You
   cannot cold-dial from a random mobile number.
3. **Calling window:** **09:00–21:00** local time only. Outside that = violation.
4. **DND / DNC scrubbing** in real time against the TRAI registry + your own
   suppression list. Respect frequency caps.
5. **Consent (DPDP + TRAI):** you need **documented, timestamped consent** to call
   — best captured at lead creation (web form / landing page / WhatsApp opt-in).
   Verbal consent on the call is **not** sufficient on its own.
6. **Mandatory AI disclosure (Feb-2025 TRAI amendment):** an AI call **must open**
   by stating it is an automated AI system, not a human, **and** that the call may
   be recorded and data processed.
7. **Recording consent** must be captured and auditable.
8. **Penalties:** up to **₹10 lakh** per violation, number blocking, telemarketer-ID
   blacklisting, DLT suspension.

**Design implications for the product:**
- Consent field + timestamp + source on every lead; calls **blocked** without it.
- A **suppression list** table + automatic DNC on "do not call" disposition
  (the `do_not_contact` flag already exists on `leads`).
- A **calling-hours guard** per lead timezone (default IST 9–21).
- The AI assistant's **first utterance is a fixed compliance preamble** (AI +
  recording disclosure), not model-generated.
- Store recording URL + transcript + consent reference per call for audit.
- Ship it as **"call your consenting leads"**, never "cold-call scraped lists".
- Onboarding step to help the user complete DLT registration / bring a 140-series
  number, or partner with a CPaaS that handles DLT for them (Exotel, Ozonetel).



## 8. Proposed architecture to embed in CreatorAI Studio

### Build vs buy
- **Buy** the voice-agent layer (STT+LLM+TTS+telephony-orchestration). Do **not**
  build real-time audio pipelines.
- **Recommended primary:** **Bolna** (Indian-language strength, self-serve API,
  bulk campaigns, HITL escalation, India data residency).
- **Recommended alt / fallback:** **Vapi** (keeps Claude as the LLM — consistent
  with the rest of our AI stack — plus BYO Indian-language TTS) on **Plivo** or
  **Exotel** telephony.
- Keep the provider behind an interface (`src/lib/calling/provider.ts`) exactly
  like `src/lib/social/*` and `src/lib/ai/heygen.ts` — gate on missing creds,
  disabled UI state when unconfigured.

### New module: `/calling` (sidebar → under "Leads" or its own "Voice" section)

**Data model (new migration):**
- `call_campaigns` — org_id, name, lead filter (saved segment), assistant config
  (objective, opening line, brand-aware script params), schedule window, retry
  policy, pacing/concurrency, status, stats.
- `calls` — campaign_id, lead_id, provider, provider_call_id, direction,
  from_number, to_number, status (queued/ringing/in_progress/completed/failed/
  no_answer/voicemail), started_at, ended_at, duration_sec, recording_url,
  transcript (jsonb), disposition, ai_summary, cost, consent_ref.
- `call_suppression` — org_id, phone, reason, created_at (DNC list).
- extend `generations`-style credit cost, or a dedicated `call_credits` meter
  (calls are per-minute, not per-unit — needs its own metering).

**Flow:**
1. User picks a lead segment → creates a `call_campaign` with an objective
   ("qualify these leads", "confirm the demo", "re-engage cold leads") and edits
   the AI's opening line + talking points (Claude drafts these from the brand
   profile — reuse `avatarScript.ts` pattern).
2. **Pre-flight gate** per lead: has documented consent? not on DND/suppression?
   within calling hours for their timezone? under frequency cap? → else skip with
   a logged reason.
3. Our **dialer worker** (a queue + worker — see risk below) calls the provider's
   outbound API (`POST /call` with our 140-series `phoneNumberId`, the lead's
   E.164 number, the saved assistant) at the allowed concurrency.
4. Provider runs the call. First utterance = **fixed compliance preamble**. Then
   the AI follows the script, can call our tools mid-call:
   `mark_interested`, `schedule_callback(datetime)`, `mark_do_not_contact`,
   `send_whatsapp_followup`, `answer_from_knowledge_base(q)`.
5. Provider webhooks (`call.ended`, `transcript.ready`, `recording.ready`) hit
   `POST /api/calling/webhook` → we write the `calls` row, generate an
   `ai_summary` (Claude), set the lead's status/priority, append a lead note,
   deduct call credits.
6. **Automations trigger** — add `call_completed` and `call_disposition_changed`
   trigger types to `src/lib/automations/engine.ts`, so a "interested"
   disposition can auto-create a follow-up task, notify the assignee, or send a
   WhatsApp brochure — all of which already exist as actions.
7. Dashboard: connect rate, talk time, disposition breakdown, cost, transcripts,
   "leads the AI marked hot".

### Reuses what already exists
- Leads pipeline, lead notes, `do_not_contact`, `preferred_channel` fields.
- Claude client + brand-aware prompt pattern (`src/lib/ai/*`).
- Automations engine (just add triggers).
- Credit system + `credit_transactions` (add a per-minute meter).
- Provider-gating pattern (`isXConfigured()` + disabled UI).
- Notifications for "call needs a human" escalations.

### The one real technical risk
Same as the Module 23 video-jobs question: **an outbound calling campaign is a
long-running, stateful, rate-limited background job.** A Next.js serverless API
route cannot host it. Need **a queue + worker** (e.g. a small Node worker on a
persistent host, or Supabase queue / Upstash QStash / a cron that drains a
`calls` table with `status='queued'`). Decide the deployment target for this and
for ffmpeg (Module 23) together.



## 9. Suggested phasing

- **Phase 0 — spike (1 week):** one provider (Bolna trial), hardcode one assistant,
  call a single test number end-to-end, confirm webhook → lead update. Validate
  Hindi/Hinglish quality with real recordings.
- **Phase 1 — MVP:** `call_campaigns` + `calls` tables, segment → campaign → queue
  → worker → provider → webhook → lead disposition + transcript + summary +
  credit deduction. Compliance gates (consent, DND, hours). Fixed AI-disclosure
  preamble. Basic results dashboard.
- **Phase 2:** Claude-drafted editable scripts from brand profile; in-call tools
  (callback booking, WhatsApp follow-up); automation triggers; retry policies;
  voicemail drop.
- **Phase 3:** human transfer / warm handoff; A/B test scripts; multi-language
  auto-select by lead; per-agent-voice options; call QA scoring; DLT-registration
  onboarding helper.



## 10. Decisions needed from you

1. **AI agent or human dialer first?** (Recommendation: AI agent, with a
   human-callback-task fallback.)
2. **Provider:** Bolna (Indian-language, fastest) vs Vapi+Plivo/Exotel (keeps
   Claude, more control). Recommendation: start Bolna for the spike.
3. **Telephony / DLT:** do we get our own 140-series number + DLT registration, or
   use a CPaaS that fronts DLT for customers? (Affects onboarding a lot.)
4. **Metering:** per-minute call credits vs a separate "calling" add-on plan.
5. **Deployment target for background workers** (shared decision with Module 23
   ffmpeg).
6. **Scope of first release:** just "qualify new leads", or also reminders /
   confirmations / re-engagement templates?



## 11. Sources

- Tata Smartflo — [Outbound Calling / Dialer](https://www.tatatelebusiness.com/features/smartflo-outbound-calling/), [Dialer Campaign docs](https://docs.smartflo.tatatelebusiness.com/docs/dialer-campaigns), [API Dialplan](https://docs.smartflo.tatatelebusiness.com/docs/api-dialplan-1)
- Exotel — [Auto Dialer](https://exotel.com/apac/products/auto-dialer/), [Programmable Voice APIs](https://docs.exotel.com/voice-apis), [Progressive Dialer using APIs](https://developer.exotel.com/usecase/progressive-dialer-using-apis)
- Voice-AI platform comparisons — [Retell vs Vapi vs Bland (TECHSY)](https://techsy.io/en/blog/retell-ai-vs-vapi-vs-bland), [ElevenLabs vs Vapi vs Retell vs Bland (DigitalApplied)](https://www.digitalapplied.com/blog/voice-ai-agents-business-elevenlabs-vapi-retell-bland), [5 Best Voice AI APIs beyond Vapi/ElevenLabs](https://blog.dataengineerthings.org/5-best-voice-ai-apis-for-developers-beyond-vapi-elevenlabs-60947ecc1a82)
- Vapi — [Outbound Calling](https://docs.vapi.ai/calls/outbound-calling), [Create Call API](https://docs.vapi.ai/api-reference/calls/create)
- Bolna — [bolna.ai](https://www.bolna.ai/), [YC profile](https://www.ycombinator.com/companies/bolna-ai), [pricing breakdown](https://blog.dograh.com/bolna-ai-pricing-breakdown-and-how-open-source-saves-70/)
- India pricing — [MyOperator: Top 10 Voice AI Agents India 2026](https://myoperator.com/blog/top-10-voice-ai-agents-india-2026), [Caller Digital: Voice AI India pricing](https://caller.digital/blog/voice-ai-india-pricing-cost-breakdown), [Scalify Labs: AI Calling Pricing India 2026](https://scalifylabs.com/blog/ai-calling-pricing-india-2026), [Edesy Vapi vs Retell vs Bland](https://edesy.in/tools/voice-agent-pricing-comparison)
- Telephony India — [Caller Digital: Plivo vs Exotel vs Ozonetel vs Twilio 2026](https://caller.digital/blog/telephony-partner-voice-ai-india-plivo-exotel-ozonetel-knowlarity-twilio-2026), [Twilio Voice pricing 2026](https://www.vbwebsol.com/twilio-voice-pricing-2026/)
- Regulation — [FreJun: TRAI Compliance for Call Centers 2026](https://frejun.com/trai-compliance-call-centers/), [ClearTouch: TRAI outbound calling timings](https://www.cleartouch.in/blog/trai-guidelines-for-outbound-calling-timings-in-india/), [Caller Digital: TRAI DLT Compliance for AI Outbound Calling 2026](https://caller.digital/blog/trai-dlt-compliance-ai-outbound-calling-india-2026), [Vyora: Is AI Calling Legal in India](https://www.vyora.ai/blog/ai-calling-legal-india-trai-compliance), [Auto Interview AI: AI Calling India DPDP/TRAI/RBI guide](https://www.autointerviewai.com/blog/ai-calling-india-dpdp-trai-dlt-compliance-complete-guide-2026)
