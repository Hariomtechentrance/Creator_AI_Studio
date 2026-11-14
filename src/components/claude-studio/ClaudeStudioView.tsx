"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import {
  Sparkles, Bot, Megaphone, Video, Layers, CheckCircle2,
  RefreshCw, Rocket, Calendar, CreditCard, ArrowRight, Check,
  AlertCircle, Copy, ExternalLink,
} from "lucide-react";
import type { ClaudeStudioPlan } from "@/lib/ai/claudeStudioCopilot";

interface ClaudeStudioViewProps {
  orgId: string | null;
  userId?: string | null;
  initialCredits?: number;
}

const TEMPLATE_PROMPTS = [
  {
    title: "Monthly 10k Growth Pack",
    badge: "Most Popular",
    desc: "8 High-converting posts + 8 Viral video reels + 10-day Meta awareness campaign",
    prompt: "Generate our complete 1-month growth plan: 8 engaging social media posts for Instagram and Facebook, 8 high-retention 15-second reel scripts, and a 10-day Meta Ads awareness campaign with ₹500 daily budget targeting Tier-1 Indian cities.",
  },
  {
    title: "Clickable & Website Traffic Campaign",
    badge: "Performance",
    desc: "Drive targeted visitors to your product page or store",
    prompt: "Create a performance ad campaign and 4 social posts designed to maximize website clicks and link clicks. Highlight our special 20% discount offer with strong urgency.",
  },
  {
    title: "App Download & Install Campaign",
    badge: "App Growth",
    desc: "Boost app installs with eye-catching video reels and Meta ads",
    prompt: "Create an app download promotion campaign with 4 high-energy reel video hooks and a Facebook/Instagram ad campaign optimized for App Installs with 'Download Now' call-to-action.",
  },
  {
    title: "High-Ticket Lead Generation",
    badge: "B2B / High CPL",
    desc: "Attract qualified enquiries, booking calls, and consultations",
    prompt: "Design a lead-generation campaign for our business: write 3 authoritative LinkedIn & Facebook posts and a high-converting Meta lead ad campaign with 'Get Quote' CTA.",
  },
];

export default function ClaudeStudioView({ orgId, initialCredits = 150 }: ClaudeStudioViewProps) {
  const [prompt, setPrompt] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ClaudeStudioPlan | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "ad">("posts");
  const [credits, setCredits] = useState(initialCredits);
  const [savingPosts, setSavingPosts] = useState(false);
  const [savedPostsSuccess, setSavedPostsSuccess] = useState(false);
  const [launchingAd, setLaunchingAd] = useState(false);
  const [adLaunchResult, setAdLaunchResult] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleExecutePrompt = async (overridePrompt?: string) => {
    const textToRun = (overridePrompt || prompt).trim();
    if (!textToRun || !orgId) return;

    setLoading(true);
    setError("");
    setSavedPostsSuccess(false);
    setAdLaunchResult(null);

    try {
      const res = await fetch("/api/ai/claude-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          prompt: textToRun,
          destinationUrl: destinationUrl.trim() || undefined,
          action: "generate",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate campaign with Claude Copilot");
        return;
      }

      setPlan(data.plan);
      if (typeof data.creditsRemaining === "number") {
        setCredits(data.creditsRemaining);
      }
      if (data.plan.socialPosts?.length > 0) setActiveTab("posts");
      else if (data.plan.reels?.length > 0) setActiveTab("reels");
      else if (data.plan.adCampaign) setActiveTab("ad");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error contacting server");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePostsToCalendar = async () => {
    if (!plan?.socialPosts?.length || !orgId) return;
    setSavingPosts(true);
    try {
      const res = await fetch("/api/ai/claude-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          action: "save-posts",
          postsToSave: plan.socialPosts,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedPostsSuccess(true);
      } else {
        setError(data.error ?? "Failed to save posts to Content Studio");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving posts");
    } finally {
      setSavingPosts(false);
    }
  };

  const handleLaunchMetaAd = async () => {
    if (!plan?.adCampaign || !orgId) return;
    setLaunchingAd(true);
    setError("");
    setAdLaunchResult(null);

    const campaign = plan.adCampaign;
    const dest = destinationUrl.trim() || campaign.destinationUrl || "https://example.com";

    try {
      const res = await fetch("/api/ads/create-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          prompt: `Create a ${campaign.objective} campaign: ${campaign.headline}. Daily budget ₹${campaign.dailyBudgetInr}. Target: ${campaign.targetCities.join(", ") || "India"}. Primary text: ${campaign.primaryText}`,
          destinationUrl: dest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not launch Meta ad campaign. Ensure your Meta account is connected.");
      } else {
        setAdLaunchResult(data.note ?? "Campaign successfully built on Meta (set to PAUSED for your safety)!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error launching ad");
    } finally {
      setLaunchingAd(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div>
      <Header title="Claude Studio Copilot" />

      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Banner: Claude Managed Access & Wallet Status */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.1) 100%)",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                  <Bot size={14} /> Claude 3.5 Sonnet Engine Active
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/30">
                  Backend API Powered (Zero Direct Claude Fee)
                </span>
              </div>
              <h1 className="text-xl font-black text-white">One-Prompt Social & Ad Copilot</h1>
              <p className="text-xs text-gray-300 max-w-2xl">
                Enter any natural language prompt. Claude orchestrates your entire marketing strategy: generates social posts, writes viral video reel scripts, and configures ready-to-launch ad campaigns on Meta & Google.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-black/40 rounded-xl px-4 py-2 border border-white/10 text-right">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Available Wallet Tokens</p>
                <p className="text-lg font-black text-white">{credits.toLocaleString()} <span className="text-xs font-normal text-violet-400">credits</span></p>
              </div>
              <a
                href="/pricing"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white flex items-center gap-1.5 transition-colors shadow-lg shadow-violet-600/30"
              >
                <CreditCard size={14} /> Recharge Wallet
              </a>
            </div>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={13} className="text-violet-400" /> Recommended Plans & Prompt Templates
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATE_PROMPTS.map((t) => (
              <button
                key={t.title}
                onClick={() => {
                  setPrompt(t.prompt);
                  handleExecutePrompt(t.prompt);
                }}
                disabled={loading}
                className="text-left p-3.5 rounded-xl transition-all duration-200 border hover:border-violet-500/50 bg-black/20 hover:bg-violet-950/20 group flex flex-col justify-between"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">
                      {t.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-2">{t.desc}</p>
                </div>
                <span className="text-[11px] text-violet-400 mt-2 font-medium flex items-center gap-1">
                  Run Template <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input Box */}
        <div
          className="rounded-2xl p-5 space-y-4 shadow-xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Bot size={14} className="text-violet-400" /> Prompt Claude Copilot
            </label>
            <textarea
              className="input w-full resize-none text-sm p-3.5 leading-relaxed"
              rows={4}
              placeholder={'e.g. "Create 8 Instagram posts and 8 reels for our specialty bakery brand this month, then build a 10-day awareness campaign on Meta with ₹500 daily budget"'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                className="input w-full text-xs py-2.5"
                placeholder="Destination Link / Landing Page URL (e.g. https://yourbrand.com)"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              onClick={() => handleExecutePrompt()}
              disabled={loading || !prompt.trim()}
              className="btn-primary px-6 py-2.5 text-sm font-bold justify-center shrink-0 min-w-[200px]"
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin mr-1.5" />
                  Claude is Architecting…
                </>
              ) : (
                <>
                  <Sparkles size={15} className="mr-1.5" />
                  Generate with Claude Copilot
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Deck */}
        {plan && (
          <div className="space-y-6 animate-fadeIn">
            {/* Overview Summary */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.25)",
              }}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Plan Generated & Verified by Claude
                  </span>
                  <p className="text-sm font-semibold text-white">{plan.summary}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    {plan.socialPosts?.length || 0} Social Posts
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                    {plan.reels?.length || 0} Video Reels
                  </span>
                  {plan.adCampaign && (
                    <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                      Meta Ad Campaign Ready
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <button
                onClick={() => setActiveTab("posts")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeTab === "posts"
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white bg-black/20"
                }`}
              >
                <Layers size={14} /> Social Posts ({plan.socialPosts?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("reels")}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeTab === "reels"
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white bg-black/20"
                }`}
              >
                <Video size={14} /> Video Reels ({plan.reels?.length || 0})
              </button>
              {plan.adCampaign && (
                <button
                  onClick={() => setActiveTab("ad")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                    activeTab === "ad"
                      ? "bg-violet-600 text-white"
                      : "text-gray-400 hover:text-white bg-black/20"
                  }`}
                >
                  <Megaphone size={14} /> Ad Campaign ({plan.adCampaign.objective})
                </button>
              )}
            </div>

            {/* Tab 1: Social Posts */}
            {activeTab === "posts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Generated social posts formatted for Instagram, Facebook & LinkedIn.
                  </p>
                  <button
                    onClick={handleSavePostsToCalendar}
                    disabled={savingPosts || savedPostsSuccess}
                    className="btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                  >
                    {savingPosts ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : savedPostsSuccess ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <Calendar size={12} />
                    )}
                    {savedPostsSuccess ? "Saved to Content Studio!" : "Save All to Content Studio"}
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {plan.socialPosts.map((post, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl p-4 space-y-3 flex flex-col justify-between"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-violet-300 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/40">
                            Post #{idx + 1} {post.suggestedDay ? `· Day ${post.suggestedDay}` : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            {post.platforms.map((plat) => (
                              <span key={plat} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300 capitalize">
                                {plat}
                              </span>
                            ))}
                          </div>
                        </div>
                        <h3 className="text-sm font-bold text-white">{post.title}</h3>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap line-clamp-6 leading-relaxed">
                          {post.caption}
                        </p>
                        {post.hashtags?.length > 0 && (
                          <p className="text-[11px] text-violet-400 font-medium">
                            {post.hashtags.map((h) => `#${h}`).join(" ")}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="text-[11px] text-gray-400 bg-black/30 p-2 rounded-lg">
                          <span className="text-gray-300 font-semibold block mb-0.5">🎨 AI Image Prompt:</span>
                          <span className="italic">{post.mediaPrompt}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => copyText(post.caption, `post-${idx}`)}
                            className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedIndex === `post-${idx}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            {copiedIndex === `post-${idx}` ? "Copied" : "Copy Caption"}
                          </button>
                          <a
                            href="/image-generation"
                            className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                          >
                            Generate Image in Studio <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Video Reels */}
            {activeTab === "reels" && (
              <div className="space-y-4">
                <p className="text-xs text-gray-400">
                  Ready-to-record or AI-generatable short-form video reel scripts with viral retention hooks.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {plan.reels.map((reel, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl p-4 space-y-3 flex flex-col justify-between"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-fuchsia-300 bg-fuchsia-950/40 px-2 py-0.5 rounded border border-fuchsia-800/40">
                            Reel #{idx + 1} · {reel.durationSeconds}s
                          </span>
                          <span className="text-[10px] text-gray-400">9:16 Vertical Video</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{reel.title}</h3>

                        <div className="rounded-lg p-2.5 bg-violet-950/20 border border-violet-500/20 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-violet-400">🔥 Viral Hook (0-3s)</span>
                          <p className="text-xs font-semibold text-white">&ldquo;{reel.hook}&rdquo;</p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400">📜 Spoken Script & Action</span>
                          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed line-clamp-6">
                            {reel.script}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="text-[11px] text-gray-400 bg-black/30 p-2 rounded-lg">
                          <span className="text-gray-300 font-semibold block mb-0.5">🎬 Video Generation Prompt:</span>
                          <span className="italic">{reel.visualPrompt}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => copyText(reel.script, `reel-${idx}`)}
                            className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedIndex === `reel-${idx}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            {copiedIndex === `reel-${idx}` ? "Copied" : "Copy Script"}
                          </button>
                          <a
                            href="/video-generation"
                            className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 font-semibold flex items-center gap-1"
                          >
                            Create in Video Studio <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Ad Campaign */}
            {activeTab === "ad" && plan.adCampaign && (
              <div className="space-y-4">
                <div
                  className="rounded-2xl p-6 space-y-5"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                          <Rocket size={13} /> {plan.adCampaign.objective} Campaign
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                          Meta & Instagram Ads
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-white">{plan.adCampaign.campaignName}</h2>
                    </div>

                    <button
                      onClick={handleLaunchMetaAd}
                      disabled={launchingAd}
                      className="btn-primary text-xs px-4 py-2 font-bold flex items-center gap-2"
                    >
                      {launchingAd ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Launching to Meta…
                        </>
                      ) : (
                        <>
                          <Rocket size={13} /> Launch Campaign to Meta
                        </>
                      )}
                    </button>
                  </div>

                  {adLaunchResult && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>{adLaunchResult}</span>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Ad Copy */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Headline</span>
                        <p className="text-base font-bold text-white">{plan.adCampaign.headline}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Primary Text / Body</span>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {plan.adCampaign.primaryText}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">Call to Action Button</span>
                        <p className="text-xs font-bold text-violet-300 inline-block px-3 py-1 rounded bg-violet-950/40 border border-violet-800/40">
                          {plan.adCampaign.cta}
                        </p>
                      </div>
                    </div>

                    {/* Right: Budget & Targeting */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Campaign Parameters</h4>
                      <div className="text-xs space-y-1.5 text-gray-300">
                        <p className="flex justify-between">
                          <span className="text-gray-400">Duration:</span>
                          <span className="font-semibold text-white">{plan.adCampaign.durationDays} Days</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-gray-400">Daily Budget:</span>
                          <span className="font-semibold text-white">₹{plan.adCampaign.dailyBudgetInr} / day</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-gray-400">Total Projected Spend:</span>
                          <span className="font-semibold text-emerald-400">₹{plan.adCampaign.totalBudgetInr.toLocaleString()}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-gray-400">Target Locations:</span>
                          <span className="font-semibold text-white text-right max-w-[200px]">
                            {plan.adCampaign.targetCities.length > 0 ? plan.adCampaign.targetCities.join(", ") : "All of India"}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-gray-400">Target Audience:</span>
                          <span className="font-semibold text-white text-right max-w-[200px]">
                            {plan.adCampaign.targetAudience}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
