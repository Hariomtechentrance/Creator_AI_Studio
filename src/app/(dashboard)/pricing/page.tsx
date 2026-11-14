"use client";

import Header from "@/components/layout/Header";
import { Check, Zap, Crown } from "lucide-react";
import { useState } from "react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    credits: 150,
    description: "Perfect for trying out CreatorAI",
    badge: null,
    color: "#6b7280",
    features: [
      "150 credits daily",
      "All 6 AI tools",
      "Standard generation speed",
      "Max 1024px images",
      "5s videos",
      "Community gallery",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "apprentice",
    name: "Apprentice",
    price: 12,
    period: "month",
    credits: 8500,
    description: "For creators who generate regularly",
    badge: null,
    color: "#06b6d4",
    features: [
      "8,500 credits / month",
      "Priority generation queue",
      "Up to 2K images",
      "10s videos",
      "1 custom model training",
      "API access",
    ],
    cta: "Upgrade to Apprentice",
    disabled: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_APPRENTICE_PRICE_ID,
  },
  {
    id: "artisan",
    name: "Artisan",
    price: 24,
    period: "month",
    credits: 25000,
    description: "For professional creators & studios",
    badge: "Most Popular",
    color: "#7c3aed",
    features: [
      "25,000 credits / month",
      "Fastest generation queue",
      "Up to 4K images",
      "30s videos (Kling)",
      "5 custom model trainings",
      "Commercial license",
      "Priority support",
    ],
    cta: "Upgrade to Artisan",
    disabled: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ARTISAN_PRICE_ID,
  },
  {
    id: "maestro",
    name: "Maestro",
    price: 48,
    period: "month",
    credits: 60000,
    description: "For power users and agencies",
    badge: "Best Value",
    color: "#f59e0b",
    features: [
      "60,000 credits / month",
      "Dedicated generation queue",
      "Up to 8K images",
      "All video providers",
      "Unlimited model training",
      "White-label outputs",
      "API with 10x rate limit",
      "24/7 priority support",
    ],
    cta: "Upgrade to Maestro",
    disabled: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_MAESTRO_PRICE_ID,
  },
];

const CREDIT_PACKS = [
  { id: "pack-1k", credits: 1000, price: 5, bonus: 0 },
  { id: "pack-5k", credits: 5000, price: 20, bonus: 10 },
  { id: "pack-15k", credits: 15000, price: 50, bonus: 20 },
  { id: "pack-50k", credits: 50000, price: 150, bonus: 30 },
  { id: "pack-growth-10k", credits: 20000, price: 120, bonus: 25, label: "₹10,000 Growth Pack" },
  { id: "pack-perf-25k", credits: 60000, price: 300, bonus: 35, label: "₹25,000 Performance Pack" },
];

const CAMPAIGN_PLANS = [
  {
    id: "growth-10k",
    name: "Growth Accelerator (₹10k Plan)",
    priceInr: "₹10,000",
    priceUsd: "$120",
    period: "month",
    color: "#8b5cf6",
    badge: "Recommended for SMBs",
    description: "Complete hands-off social content & Meta ad campaign powered by Claude",
    features: [
      "8 Custom Social Media Posts (Instagram, Facebook, LinkedIn)",
      "8 High-retention Video Reel Scripts & Hook Directions",
      "10-Day Meta Ads Awareness / Lead Campaign Setup (₹500/day)",
      "20,000 AI Platform Tokens included",
      "Direct Claude 3.5 Sonnet access inside CreatorAI Studio",
      "No direct Anthropic subscription or API keys needed",
      "One-click Publish to Facebook & Instagram",
    ],
  },
  {
    id: "traffic-clicks",
    name: "Clickable & Traffic Plan",
    priceInr: "₹15,000",
    priceUsd: "$180",
    period: "month",
    color: "#3b82f6",
    badge: "Traffic & Sales",
    description: "Designed specifically to drive website clicks, visits & ecommerce purchases",
    features: [
      "15 High-converting Social Posts with CTA",
      "10 Video Reel Scripts with Link-in-Bio hooks",
      "High-CTR Meta & Google Search Clickable Ad Setup",
      "Pixel Conversion & Destination Link UTM Tracking",
      "35,000 AI Platform Tokens included",
      "Continuous Ad Copy A/B Variations by Claude",
      "Priority AI Queue",
    ],
  },
  {
    id: "app-downloads",
    name: "App Download & Install Plan",
    priceInr: "₹25,000",
    priceUsd: "$300",
    period: "month",
    color: "#ec4899",
    badge: "Mobile Apps",
    description: "Optimized for iOS & Android app downloads and installs",
    features: [
      "20 App Promotion Posts + 15 Viral Reels",
      "Meta App Install Campaign Setup (App Store / Play Store)",
      "Deep-linking & Install Conversion Optimization",
      "App Feature Spotlight Video Prompts",
      "60,000 AI Platform Tokens included",
      "Automated Cost-Per-Install (CPI) Ad Copy Refinement",
      "Dedicated WhatsApp Support",
    ],
  },
];

const CREDIT_COSTS = [
  { action: "Claude Studio Copilot (Full Plan: 8 Posts + 8 Reels + Ad Setup)", cost: 25 },
  { action: "Generate 1 image (Flux Dev)", cost: 5 },
  { action: "Generate 1 image (Flux Pro)", cost: 8 },
  { action: "Generate 10s video (Runway)", cost: 25 },
  { action: "Generate 30s video (Kling)", cost: 20 },
  { action: "Upscale image 4x", cost: 10 },
  { action: "Canvas AI inpaint", cost: 8 },
  { action: "Train custom model (LoRA)", cost: 500 },
  { action: "3D texture set (6 maps)", cost: 15 },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleUpgrade = async (planId: string, priceId: string | undefined) => {
    if (!priceId) {
      setError("This plan isn't configured yet — add its Stripe price ID to .env.local");
      return;
    }
    setLoadingPlan(planId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start checkout");
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start checkout");
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div>
      <Header title="Plans & Credits" />
      <div className="p-6 max-w-6xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-white">Simple, transparent pricing</h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Pay only for what you create. No hidden fees.
          </p>
        </div>

        {error && (
          <p className="text-sm text-center rounded-lg px-3 py-2 max-w-md mx-auto" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </p>
        )}

        {/* Plans */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="card relative flex flex-col"
              style={plan.badge ? { borderColor: plan.color, boxShadow: `0 0 30px ${plan.color}25` } : {}}
            >
              {plan.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg,${plan.color},${plan.color}cc)` }}
                >
                  {plan.id === "maestro" ? <><Crown size={11} className="inline mr-1" />{plan.badge}</> : plan.badge}
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  {plan.price > 0 && <span className="text-sm pb-1" style={{ color: "var(--text-muted)" }}>/{plan.period}</span>}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{plan.description}</p>
              </div>

              <div className="rounded-xl px-3 py-2 mb-4 flex items-center gap-2" style={{ background: `${plan.color}15`, border: `1px solid ${plan.color}30` }}>
                <Zap size={14} style={{ color: plan.color }} />
                <span className="text-sm font-bold" style={{ color: plan.color }}>
                  {plan.credits.toLocaleString()} credits{plan.price === 0 ? " / day" : " / mo"}
                </span>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={plan.disabled || loadingPlan === plan.id}
                onClick={() => handleUpgrade(plan.id, plan.priceId)}
                className={plan.disabled ? "btn-secondary w-full justify-center py-3 opacity-60 cursor-not-allowed" : "btn-primary w-full justify-center py-3"}
                style={!plan.disabled ? { background: `linear-gradient(135deg,${plan.color},${plan.color}cc)` } : {}}
              >
                {loadingPlan === plan.id ? <span className="spinner" /> : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Full Growth & Campaign Accelerator Packages (Claude Powered) */}
        <div className="space-y-6 pt-4">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400 bg-violet-950/40 px-3 py-1 rounded-full border border-violet-800/40">
              🚀 Claude Copilot Campaign Packages
            </span>
            <h2 className="text-3xl font-black text-white">Full-Service Growth Packages</h2>
            <p className="text-sm max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Includes Claude AI generation (posts + reels), token wallet balance, and ready-to-run Meta ad campaigns. No direct Anthropic fees or setup needed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {CAMPAIGN_PLANS.map((pkg) => (
              <div
                key={pkg.id}
                className="card relative flex flex-col justify-between"
                style={{ borderColor: `${pkg.color}50`, boxShadow: `0 0 25px ${pkg.color}15` }}
              >
                {pkg.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow-md"
                    style={{ background: pkg.color }}
                  >
                    {pkg.badge}
                  </div>
                )}
                <div>
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: pkg.color }}>{pkg.name}</p>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-black text-white">{pkg.priceInr}</span>
                      <span className="text-sm text-gray-400">({pkg.priceUsd}) / month</span>
                    </div>
                    <p className="text-xs text-gray-400">{pkg.description}</p>
                  </div>

                  <ul className="space-y-2.5 mb-6 text-xs text-gray-300">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0" style={{ color: pkg.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="/claude-studio"
                  className="btn-primary w-full justify-center py-2.5 text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${pkg.color}, ${pkg.color}cc)` }}
                >
                  Launch in Claude Studio
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Credit packs */}
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Buy Credit Packs</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>One-time purchases — credits never expire</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map(({ id, credits, price, bonus }) => (
              <div key={id} className="card card-hover text-center space-y-3">
                <div className="text-3xl font-black text-white">{credits.toLocaleString()}</div>
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>credits</div>
                {bonus > 0 && <span className="badge badge-green">+{bonus}% bonus</span>}
                <div className="text-2xl font-black" style={{ color: "#f59e0b" }}>${price}</div>
                <button
                  onClick={() => handleBuyPack(id)}
                  disabled={loadingPack === id}
                  className="btn-secondary w-full justify-center text-sm"
                >
                  {loadingPack === id ? <span className="spinner" /> : "Buy Now"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Credit costs table */}
        <div>
          <h2 className="text-2xl font-black text-white mb-6">Credit Cost Per Action</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Action</th>
                  <th className="text-right px-5 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Credits</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_COSTS.map(({ action, cost }, i) => (
                  <tr key={action} style={{ borderBottom: i < CREDIT_COSTS.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td className="px-5 py-3 text-white">{action}</td>
                    <td className="px-5 py-3 text-right font-bold" style={{ color: "#f59e0b" }}>
                      <span className="flex items-center justify-end gap-1"><Zap size={12} />{cost}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
