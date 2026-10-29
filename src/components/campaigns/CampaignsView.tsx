"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Megaphone, Wand2, Trash2, TrendingUp, Target, DollarSign, Rocket, Eye, MousePointerClick, IndianRupee, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCampaignFromAdCopy, deleteCampaign } from "@/lib/supabase/campaigns";
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
  const [insights, setInsights] = useState<Record<string, { impressions: number; clicks: number; spend: number; ctr: number; reach: number; hasData: boolean }>>({});
  const [loadingInsights, setLoadingInsights] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<Record<string, string>>({});
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<Record<string, string>>({});

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
    setTogglingId(c.id);
    setToggleError((prev) => ({ ...prev, [c.id]: "" }));
    try {
      const res = await fetch("/api/ads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToggleError((prev) => ({ ...prev, [c.id]: data.error ?? "Couldn't update status" }));
        return;
      }
      // Only reflect the new state locally once Meta has actually confirmed
      // it (or, for a draft that never reached Meta, once the local update
      // itself succeeded) — never flip the label optimistically before that.
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    } catch (err) {
      setToggleError((prev) => ({ ...prev, [c.id]: err instanceof Error ? err.message : "Couldn't reach the server" }));
    } finally {
      setTogglingId(null);
    }
  };

  const handleStartEditBudget = (c: Campaign) => {
    setEditingBudgetId(c.id);
    setBudgetInput(String(c.budget || ""));
  };

  const handleSaveBudget = async (campaignId: string) => {
    const dailyBudget = Number(budgetInput);
    if (!dailyBudget || dailyBudget < 100) {
      setBudgetError((prev) => ({ ...prev, [campaignId]: "Minimum ₹100/day" }));
      return;
    }
    setSavingBudget(true);
    setBudgetError((prev) => ({ ...prev, [campaignId]: "" }));
    try {
      const res = await fetch("/api/ads/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, dailyBudget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBudgetError((prev) => ({ ...prev, [campaignId]: data.error ?? "Couldn't update budget" }));
        return;
      }
      setCampaigns((prev) => prev.map((x) => (x.id === campaignId ? { ...x, budget: dailyBudget } : x)));
      setEditingBudgetId(null);
    } catch (err) {
      setBudgetError((prev) => ({ ...prev, [campaignId]: err instanceof Error ? err.message : "Couldn't reach the server" }));
    } finally {
      setSavingBudget(false);
    }
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

  const handleViewInsights = async (campaignId: string) => {
    setLoadingInsights(campaignId);
    setInsightsError((prev) => ({ ...prev, [campaignId]: "" }));
    try {
      const res = await fetch(`/api/ads/insights?campaignId=${campaignId}`);
      const data = await res.json();
      if (!res.ok) {
        setInsightsError((prev) => ({ ...prev, [campaignId]: data.error ?? "Couldn't load insights" }));
        return;
      }
      setInsights((prev) => ({ ...prev, [campaignId]: data.insights }));
    } catch (err) {
      setInsightsError((prev) => ({ ...prev, [campaignId]: err instanceof Error ? err.message : "Couldn't reach the server" }));
    } finally {
      setLoadingInsights(null);
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
              const performance = c.performance as unknown as { campaign_id?: string; launched_platform?: string } | null;
              const isLaunchedOnMeta = performance?.launched_platform === "facebook" && !!performance?.campaign_id;
              const campaignInsights = insights[c.id];
              return (
                <div key={c.id} className="rounded-xl p-3.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-white">{c.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: `${STATUS_COLOR[c.status] ?? "#6b7280"}20`, color: STATUS_COLOR[c.status] ?? "#6b7280" }}>{c.status}</span>
                  </div>
                  <p className="text-[11px] capitalize mb-2" style={{ color: "var(--text-muted)" }}>
                    {c.platforms.join(", ")} · {c.goal}
                    {isLaunchedOnMeta && c.budget > 0 && ` · ₹${c.budget}/day`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleToggleStatus(c)} disabled={togglingId === c.id} className="btn-secondary px-3 py-1 text-xs disabled:opacity-50">
                      {togglingId === c.id ? "…" : c.status === "active" ? "Pause" : "Activate"}
                    </button>
                    {isLaunchedOnMeta && editingBudgetId !== c.id && (
                      <button onClick={() => handleStartEditBudget(c)} className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                        Edit Budget
                      </button>
                    )}
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
                    {isLaunchedOnMeta && (
                      <button
                        onClick={() => handleViewInsights(c.id)}
                        disabled={loadingInsights === c.id}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}
                      >
                        {loadingInsights === c.id ? <span className="spinner w-3 h-3" /> : <><TrendingUp size={11} /> Performance</>}
                      </button>
                    )}
                    <button onClick={() => handleDelete(c.id)} className={isLaunchedOnMeta ? "p-1.5 rounded-lg hover:bg-white/10" : "ml-auto p-1.5 rounded-lg hover:bg-white/10"}><Trash2 size={13} style={{ color: "#f87171" }} /></button>
                  </div>
                  {editingBudgetId === c.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>₹</span>
                      <input
                        type="number"
                        min={100}
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-24 px-2 py-1 rounded-lg text-xs"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "white" }}
                        placeholder="Daily budget"
                      />
                      <button
                        onClick={() => handleSaveBudget(c.id)}
                        disabled={savingBudget}
                        className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
                      >
                        {savingBudget ? "…" : "Save"}
                      </button>
                      <button onClick={() => setEditingBudgetId(null)} className="px-2 py-1 rounded-lg text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                    </div>
                  )}
                  {toggleError[c.id] && <p className="text-[11px] mt-2" style={{ color: "#f87171" }}>{toggleError[c.id]}</p>}
                  {budgetError[c.id] && <p className="text-[11px] mt-2" style={{ color: "#f87171" }}>{budgetError[c.id]}</p>}
                  {launchNotes[c.id] && (
                    <p className="text-[11px] mt-2" style={{ color: launchNotes[c.id].startsWith("Campaign created") || launchNotes[c.id].startsWith("PAUSED") ? "#34d399" : "#f87171" }}>{launchNotes[c.id]}</p>
                  )}
                  {insightsError[c.id] && <p className="text-[11px] mt-2" style={{ color: "#f87171" }}>{insightsError[c.id]}</p>}
                  {campaignInsights && (
                    campaignInsights.hasData ? (
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                        <div className="text-center">
                          <Eye size={13} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                          <p className="text-sm font-bold text-white">{campaignInsights.impressions.toLocaleString()}</p>
                          <p className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Impressions</p>
                        </div>
                        <div className="text-center">
                          <MousePointerClick size={13} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                          <p className="text-sm font-bold text-white">{campaignInsights.clicks.toLocaleString()}</p>
                          <p className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Clicks</p>
                        </div>
                        <div className="text-center">
                          <Percent size={13} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                          <p className="text-sm font-bold text-white">{campaignInsights.ctr.toFixed(2)}%</p>
                          <p className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>CTR</p>
                        </div>
                        <div className="text-center">
                          <IndianRupee size={13} className="mx-auto mb-1" style={{ color: "var(--text-muted)" }} />
                          <p className="text-sm font-bold text-white">₹{campaignInsights.spend.toFixed(2)}</p>
                          <p className="text-[9px] uppercase" style={{ color: "var(--text-muted)" }}>Spend</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] mt-3 pt-3" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                        No data yet — this campaign hasn&apos;t been activated in Meta Ads Manager, so nothing has run.
                      </p>
                    )
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
