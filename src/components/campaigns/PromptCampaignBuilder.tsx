"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";

interface BuildResult {
  imageUrl: string;
  plan: {
    objective: string;
    headline: string;
    primaryText: string;
    hashtags: string[];
    ctaLabel: string;
    cityNames: string[];
    ageMin: number;
    ageMax: number;
    genders: string;
    dailyBudgetInr: number;
  };
  note: string;
}

export default function PromptCampaignBuilder({ orgId, onBuilt }: { orgId: string | null; onBuilt?: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BuildResult | null>(null);

  const handleBuild = async () => {
    if (!orgId || !prompt.trim() || !destinationUrl.trim()) return;
    setBuilding(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ads/create-from-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, prompt: prompt.trim(), destinationUrl: destinationUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't build the campaign");
        return;
      }
      setResult(data);
      onBuilt?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid rgba(124,58,237,0.3)" }}>
      <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#c4b5fd" }}>
        <Sparkles size={14} /> Describe Your Campaign — AI Builds It
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        One sentence is enough. AI picks the objective, writes the copy and hashtags, builds the creative, and launches it on Meta — always PAUSED for your review, never active automatically.
      </p>
      <textarea
        className="input w-full resize-none text-sm"
        rows={3}
        placeholder={'e.g. "Run a leads campaign for our bakery in Pune and Mumbai, budget ₹400/day, we specialize in eggless cakes"'}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <input
        className="input w-full text-sm"
        placeholder="Destination link (your real website or landing page URL)"
        value={destinationUrl}
        onChange={(e) => setDestinationUrl(e.target.value)}
      />
      {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
      <button onClick={handleBuild} disabled={building || !orgId || !prompt.trim() || !destinationUrl.trim()} className="btn-primary w-full justify-center py-2.5">
        {building ? (<><RefreshCw size={14} className="animate-spin" /> Building on Meta…</>) : (<><Sparkles size={14} /> Build Campaign</>)}
      </button>

      {result && (
        <div className="rounded-xl p-4 space-y-3 mt-2" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: "#34d399" }}><CheckCircle2 size={14} /> {result.note}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.imageUrl} alt="Ad creative" className="w-full max-w-xs mx-auto rounded-lg" />
          <div className="text-sm space-y-1">
            <p className="font-bold text-white">{result.plan.headline}</p>
            <p style={{ color: "var(--text-secondary)" }}>{result.plan.primaryText}</p>
            <p className="text-xs" style={{ color: "#c4b5fd" }}>{result.plan.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </div>
          <div className="text-xs space-y-0.5" style={{ color: "var(--text-muted)" }}>
            <p>Objective: <span className="capitalize">{result.plan.objective}</span> · CTA: {result.plan.ctaLabel}</p>
            <p>Audience: {result.plan.cityNames.length ? result.plan.cityNames.join(", ") : "All of India"}, ages {result.plan.ageMin}-{result.plan.ageMax}, {result.plan.genders}</p>
            <p>Daily budget: ₹{result.plan.dailyBudgetInr}</p>
          </div>
        </div>
      )}
    </div>
  );
}
