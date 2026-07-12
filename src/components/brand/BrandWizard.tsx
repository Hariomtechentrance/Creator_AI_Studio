"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import {
  Brain, Globe, Target, Users, MessageSquare, Swords,
  ChevronRight, CheckCircle2, Sparkles, Building2, ArrowRight, Plus, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveBrandProfile } from "@/lib/supabase/brand";
import type { BrandProfile, ToneOfVoice, PrimaryGoal, BudgetRange } from "@/types/database";

const TONE_OPTIONS: ToneOfVoice[] = ["professional", "casual", "fun", "luxury", "bold", "friendly", "authoritative"];
const PLATFORM_OPTIONS = ["Instagram", "Facebook", "LinkedIn", "Twitter/X", "YouTube", "TikTok", "WhatsApp"];
const GOAL_OPTIONS: { value: PrimaryGoal; label: string; icon: string }[] = [
  { value: "leads", label: "Generate Leads", icon: "🎯" },
  { value: "sales", label: "Drive Sales", icon: "💰" },
  { value: "awareness", label: "Brand Awareness", icon: "📢" },
  { value: "followers", label: "Grow Followers", icon: "👥" },
  { value: "traffic", label: "Website Traffic", icon: "🌐" },
  { value: "retention", label: "Customer Retention", icon: "❤️" },
];
const BUDGET_OPTIONS: { value: BudgetRange; label: string }[] = [
  { value: "<10k", label: "Under ₹10,000" },
  { value: "10k-50k", label: "₹10k–₹50k" },
  { value: "50k-2L", label: "₹50k–₹2L" },
  { value: "2L-5L", label: "₹2L–₹5L" },
  { value: "5L+", label: "₹5L+" },
];

const STEPS = ["Business Info", "Audience", "Brand Voice", "Competitors", "Goals", "Platforms"];

interface Competitor {
  name: string;
  website: string;
  strengths: string;
  weaknesses: string;
}

interface BrandWizardProps {
  orgId: string | null;
  orgInitial: { name: string; industry: string; website: string; description: string } | null;
  brandInitial: BrandProfile | null;
}

export default function BrandWizard({ orgId, orgInitial, brandInitial }: BrandWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    businessName: orgInitial?.name ?? "",
    industry: orgInitial?.industry ?? "",
    website: orgInitial?.website ?? "",
    description: orgInitial?.description ?? "",
    ageRange: brandInitial?.target_audience?.age_range ?? "",
    gender: brandInitial?.target_audience?.gender ?? "all",
    location: brandInitial?.target_audience?.location ?? "",
    interests: brandInitial?.target_audience?.interests?.join(", ") ?? "",
    tone: brandInitial?.tone_of_voice ?? ("professional" as ToneOfVoice),
    usp: brandInitial?.unique_selling_points?.join("\n") ?? "",
    competitors: (brandInitial?.competitors ?? []) as Competitor[],
    primaryGoal: brandInitial?.primary_goal ?? ("leads" as PrimaryGoal),
    platforms: brandInitial?.current_platforms ?? ([] as string[]),
    budget: brandInitial?.monthly_budget_range ?? ("" as BudgetRange | ""),
  });
  const [newCompetitor, setNewCompetitor] = useState<Competitor>({ name: "", website: "", strengths: "", weaknesses: "" });

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const toggleArr = (key: "platforms", val: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));
  };

  const addCompetitor = () => {
    if (!newCompetitor.name.trim()) return;
    setForm((f) => ({ ...f, competitors: [...f.competitors, newCompetitor] }));
    setNewCompetitor({ name: "", website: "", strengths: "", weaknesses: "" });
  };

  const removeCompetitor = (i: number) => {
    setForm((f) => ({ ...f, competitors: f.competitors.filter((_, idx) => idx !== i) }));
  };

  const completed = step;

  const handleGenerate = async () => {
    if (!orgId) {
      setError("Sign in and create a business first");
      return;
    }
    if (!form.businessName.trim() || !form.industry.trim() || !form.description.trim()) {
      setError("Business name, industry, and description are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: form.businessName.trim(),
          industry: form.industry.trim(),
          website: form.website.trim() || null,
          description: form.description.trim(),
          onboarding_completed: true,
        })
        .eq("id", orgId);

      if (orgError) {
        setError(orgError.message);
        return;
      }

      const { error: brandError } = await saveBrandProfile(supabase, orgId, {
        business_type: brandInitial?.business_type ?? null,
        target_audience: {
          age_range: form.ageRange || undefined,
          gender: form.gender || undefined,
          location: form.location || undefined,
          interests: form.interests ? form.interests.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        },
        tone_of_voice: form.tone,
        brand_personality: brandInitial?.brand_personality ?? [],
        offerings: brandInitial?.offerings ?? [],
        competitors: form.competitors,
        unique_selling_points: form.usp.split("\n").map((s) => s.trim()).filter(Boolean),
        pain_points_solved: brandInitial?.pain_points_solved ?? [],
        monthly_budget_range: form.budget || null,
        marketing_experience: brandInitial?.marketing_experience ?? "beginner",
        current_platforms: form.platforms,
        past_campaigns: brandInitial?.past_campaigns ?? [],
        brand_colors: brandInitial?.brand_colors ?? [],
        brand_fonts: brandInitial?.brand_fonts ?? [],
        approved_keywords: brandInitial?.approved_keywords ?? [],
        banned_words: brandInitial?.banned_words ?? [],
        ai_brand_summary: brandInitial?.ai_brand_summary ?? null,
        ai_strategy: brandInitial?.ai_strategy ?? {},
        ai_last_analyzed_at: brandInitial?.ai_last_analyzed_at ?? null,
        primary_goal: form.primaryGoal,
        monthly_targets: brandInitial?.monthly_targets ?? {},
      });

      if (brandError) {
        setError(brandError);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Brand Intelligence" />

      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Progress */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => i < step + 1 && setStep(i)}
                className="flex items-center gap-1.5 shrink-0"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: i < completed ? "#7c3aed" : i === step ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.08)",
                    border: i <= step ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,0.15)",
                    color: i <= step ? "white" : "var(--text-muted)",
                  }}
                >
                  {i < completed ? <CheckCircle2 size={13} /> : i + 1}
                </div>
                <span className="hidden sm:block text-xs font-medium" style={{ color: i === step ? "#c4b5fd" : "var(--text-muted)" }}>
                  {s}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px" style={{ background: i < step ? "#7c3aed" : "var(--border)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>

          {/* Step 0 — Business Info */}
          {step === 0 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Building2 size={18} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Tell us about your business</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>The AI will use this to understand your brand context</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Business Name *</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Acme Marketing"
                    value={form.businessName}
                    onChange={(e) => set("businessName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Industry / Niche *</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Real Estate, D2C Fashion"
                    value={form.industry}
                    onChange={(e) => set("industry", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Website</label>
                  <input
                    className="input w-full"
                    placeholder="https://yoursite.com"
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>What does your business do? *</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={3}
                    placeholder="Describe your products/services, who you serve, and what makes you different..."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 1 — Audience */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Users size={18} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Define your target audience</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>The AI will tailor all content for this specific audience</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Age Range</label>
                  <select className="input w-full" value={form.ageRange} onChange={(e) => set("ageRange", e.target.value)}>
                    <option value="">Select range</option>
                    {["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+", "All ages"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Gender</label>
                  <select className="input w-full" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option value="all">All genders</option>
                    <option value="male">Mostly male</option>
                    <option value="female">Mostly female</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Target Location</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. India, Mumbai, Global"
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Interests & Behaviours</label>
                  <input
                    className="input w-full"
                    placeholder="e.g. fitness, travel, luxury, startups"
                    value={form.interests}
                    onChange={(e) => set("interests", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2 — Brand Voice */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <MessageSquare size={18} className="text-pink-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Define your brand voice</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>The AI will match this tone in every piece of content it writes</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Tone of Voice</label>
                  <div className="flex flex-wrap gap-2 capitalize">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => set("tone", t)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
                        style={{
                          background: form.tone === t ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                          border: form.tone === t ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.12)",
                          color: form.tone === t ? "#c4b5fd" : "var(--text-secondary)",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Unique Selling Points / What makes you different?</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={3}
                    placeholder="e.g. Fastest delivery, Handcrafted quality, Certified experts, 10 years experience..."
                    value={form.usp}
                    onChange={(e) => set("usp", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 3 — Competitors */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Swords size={18} className="text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Who are your competitors?</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI will position your content and offers against these</p>
                </div>
              </div>

              <div className="space-y-2">
                {form.competitors.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{c.name}</p>
                      {c.website && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.website}</p>}
                      {(c.strengths || c.weaknesses) && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          {c.strengths && <>Strong: {c.strengths}. </>}
                          {c.weaknesses && <>Weak: {c.weaknesses}.</>}
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeCompetitor(i)} className="p-1 rounded-lg hover:bg-white/10 shrink-0">
                      <X size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)" }}>
                <input
                  className="input w-full"
                  placeholder="Competitor name"
                  value={newCompetitor.name}
                  onChange={(e) => setNewCompetitor((c) => ({ ...c, name: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Website (optional)"
                  value={newCompetitor.website}
                  onChange={(e) => setNewCompetitor((c) => ({ ...c, website: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="What they do well (optional)"
                  value={newCompetitor.strengths}
                  onChange={(e) => setNewCompetitor((c) => ({ ...c, strengths: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Where they fall short (optional)"
                  value={newCompetitor.weaknesses}
                  onChange={(e) => setNewCompetitor((c) => ({ ...c, weaknesses: e.target.value }))}
                />
                <button
                  onClick={addCompetitor}
                  disabled={!newCompetitor.name.trim()}
                  className="sm:col-span-2 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: "#a78bfa" }}
                >
                  <Plus size={14} /> Add competitor
                </button>
              </div>
            </>
          )}

          {/* Step 4 — Goals */}
          {step === 4 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Target size={18} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">What is your primary goal?</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI agents will prioritize this goal in every decision</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => set("primaryGoal", g.value)}
                    className="flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: form.primaryGoal === g.value ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: form.primaryGoal === g.value ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{g.label}</p>
                    </div>
                    {form.primaryGoal === g.value && (
                      <CheckCircle2 size={16} className="text-violet-400 ml-auto shrink-0" />
                    )}
                  </button>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Monthly Marketing Budget (₹)</label>
                  <select className="input w-full" value={form.budget} onChange={(e) => set("budget", e.target.value)}>
                    <option value="">Select range</option>
                    {BUDGET_OPTIONS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 5 — Platforms */}
          {step === 5 && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Globe size={18} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Which platforms do you use?</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI will create platform-optimized content for each</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => toggleArr("platforms", p)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: form.platforms.includes(p) ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.06)",
                      border: form.platforms.includes(p) ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,0.08)",
                      color: form.platforms.includes(p) ? "#c4b5fd" : "var(--text-secondary)",
                    }}
                  >
                    {form.platforms.includes(p) && "✓ "}{p}
                  </button>
                ))}
              </div>
              {form.platforms.length > 0 && (
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}
                >
                  <Sparkles size={16} className="text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    AI will generate optimized content variations for <strong className="text-white">{form.platforms.join(", ")}</strong> — different caption lengths, hashtag counts, and formats for each platform.
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ color: "var(--text-muted)", visibility: step === 0 ? "hidden" : "visible" }}
            >
              ← Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
              >
                {saving ? <span className="spinner" /> : <><Brain size={15} /> Save Brand Profile <ArrowRight size={15} /></>}
              </button>
            )}
          </div>
        </div>

        {/* What AI will do */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.2)" }}
        >
          <Sparkles size={15} className="text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-white mb-1">What AI does with your brand profile</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Generates a complete brand strategy · Writes a custom content calendar · Calibrates the tone of every AI-generated post · Scores leads based on your target audience · Trains the community agent to respond in your voice
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
