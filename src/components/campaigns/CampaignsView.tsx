"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Megaphone, Wand2, Trash2, TrendingUp, Target, DollarSign, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCampaignFromAdCopy, updateCampaignStatus, deleteCampaign } from "@/lib/supabase/campaigns";
import type { Campaign } from "@/types/database";
import type { AdCopyResult } from "@/lib/ai/adCopy";

const PLATFORMS = ["Meta Ads", "Google Ads", "LinkedIn Ads", "YouTube Ads"];
const GOALS = ["awareness", "leads", "sales", "engagement", "traffic"];

const STATUS_COLOR: Record<string, string> = { draft: "#6b7280", active: "#10b981", paused: "#f59e0b", completed: "#3b82f6" };

// Only these two have a real launch integration (Meta Marketing API,
// Google Ads API) — LinkedIn/YouTube ads need their own separate API access
// this repo doesn't have wired.
const LAUNCHABLE: Record<string, "google_ads" | "facebook"> = { "Google Ads": "google_ads", "Meta Ads": "facebook" };

export default function CampaignsView({ orgId, userId, initialCampaigns }: { orgId: string | null; userId: string | null; initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [goal, setGoal] = useState("leads");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AdCopyResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchNotes, setLaunchNotes] = useState<Record<string, string>>({});

  const handleGenerate = async () => {
    if (!description.trim() || !orgId) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai/generate-ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, platform, goal, productDescription: description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate ad copy");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!result || !orgId || !userId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { campaign } = await createCampaignFromAdCopy(supabase, orgId, userId, {
        name: `${platform} — ${description.slice(0, 40)}`,
        platform,
        goal,
        adCopy: result,
      });
      if (campaign) {
        setCampaigns((prev) => [campaign, ...prev]);
        setResult(null);
        setDescription("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c: Campaign) => {
    const next = c.status === "active" ? "paused" : "active";
    setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    const supabase = createClient();
    await updateCampaignStatus(supabase, c.id, next);
  };

  const handleDelete = async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    const supabase = createClient();
    await deleteCampaign(supabase, id);
  };

  const handleLaunch = async (c: Campaign, launchPlatform: "google_ads" | "facebook") => {
    setLaunchingId(c.id);
    setLaunchNotes((prev) => ({ ...prev, [c.id]: "" }));
    try {
      const res = await fetch("/api/ads/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id, platform: launchPlatform }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLaunchNotes((prev) => ({ ...prev, [c.id]: data.error ?? "Launch failed" }));
        return;
      }
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "paused" } : x)));
      setLaunchNotes((prev) => ({ ...prev, [c.id]: data.note }));
    } catch (err) {
      setLaunchNotes((prev) => ({ ...prev, [c.id]: err instanceof Error ? err.message : "Launch failed" }));
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <div>
      <Header title="Campaigns" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Megaphone size={16} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            AI drafts ad copy, targeting, and budget guidance. Meta Ads and Google Ads campaigns can launch for real (as a PAUSED shell you activate yourself) once connected in Social Accounts — LinkedIn/YouTube ad launching isn&apos;t wired.
          </p>
        </div>

        {/* Generator */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Generate Ad Copy</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => setPlatform(p)} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: platform === p ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: platform === p ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)", color: platform === p ? "#c4b5fd" : "var(--text-secondary)" }}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <button key={g} onClick={() => setGoal(g)} className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{ background: goal === g ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", border: goal === g ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.08)", color: goal === g ? "#34d399" : "var(--text-secondary)" }}>
                {g}
              </button>
            ))}
          </div>
          <textarea className="input w-full resize-none text-sm" rows={3} placeholder="Describe what you're advertising…" value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          <button onClick={handleGenerate} disabled={generating || !description.trim() || !orgId} className="btn-primary w-full justify-center py-2.5">
            {generating ? <span className="spinner" /> : <><Wand2 size={14} /> Generate</>}
          </button>
        </div>

        {result && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Headlines</p>
              {result.headlines.map((h, i) => <p key={i} className="text-sm font-semibold text-white">{h}</p>)}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Body</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{result.primaryText}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>{result.cta}</span>
            </div>
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}><Target size={13} className="shrink-0 mt-0.5" /> {result.audienceSuggestion}</div>
            <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}><DollarSign size={13} className="shrink-0 mt-0.5" /> {result.budgetSuggestion}</div>
            <button onClick={handleSaveCampaign} disabled={saving} className="btn-secondary w-full justify-center py-2">
              {saving ? <span className="spinner" /> : "Save as Draft Campaign"}
            </button>
          </div>
        )}

        {/* Campaign list */}
        {campaigns.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-sm font-bold text-white">Campaigns</p>
            {campaigns.map((c) => {
              const launchPlatform = c.platforms.map((p) => LAUNCHABLE[p]).find(Boolean);
              return (
                <div key={c.id} className="rounded-xl p-3.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: `${STATUS_COLOR[c.status] ?? "#6b7280"}20`, color: STATUS_COLOR[c.status] ?? "#6b7280" }}>{c.status}</span>
                  </div>
                  <p className="text-[11px] capitalize mb-2" style={{ color: "var(--text-muted)" }}>{c.platforms.join(", ")} · {c.goal}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleStatus(c)} className="btn-secondary px-3 py-1 text-xs">{c.status === "active" ? "Pause" : "Activate"}</button>
                    {launchPlatform && c.status === "draft" && (
                      <button
                        onClick={() => handleLaunch(c, launchPlatform)}
                        disabled={launchingId === c.id}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
                      >
                        {launchingId === c.id ? <span className="spinner w-3 h-3" /> : <><Rocket size={11} /> Launch</>}
                      </button>
                    )}
                    <button onClick={() => handleDelete(c.id)} className="ml-auto p-1.5 rounded-lg hover:bg-white/10"><Trash2 size={13} style={{ color: "#f87171" }} /></button>
                  </div>
                  {launchNotes[c.id] && (
                    <p className="text-[11px] mt-2" style={{ color: launchNotes[c.id].startsWith("Campaign created") || launchNotes[c.id].startsWith("PAUSED") ? "#34d399" : "#f87171" }}>{launchNotes[c.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Module 15 — gated */}
        <div className="rounded-2xl p-4 opacity-60" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><TrendingUp size={13} /> AI Ads Optimization</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Budget reallocation, CTR improvement, and audience segmentation need real performance data from a connected ad account — coming once Meta/Google/LinkedIn/YouTube Ads are connected.
          </p>
        </div>
      </div>
    </div>
  );
}
