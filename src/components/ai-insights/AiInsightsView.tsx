"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Sparkles, Brain, TrendingUp, AlertTriangle, Target, Lightbulb } from "lucide-react";
import type { AIReport } from "@/types/database";
import type { BusinessAnalysisResult, InsightItem } from "@/lib/ai/businessAnalysis";

interface AiInsightsViewProps {
  orgId: string | null;
  brandOnboarded: boolean;
  leadsCount: number;
  brandSummary: string | null;
  initialReport: AIReport | null;
}

function toItems(json: unknown): InsightItem[] {
  return Array.isArray(json) ? (json as InsightItem[]) : [];
}

function ItemList({ title, icon, color, items }: { title: string; icon: React.ReactNode; color: string; items: InsightItem[] }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color }}>{icon}</span>
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing to report yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{item.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AiInsightsView({ orgId, brandOnboarded, leadsCount, brandSummary, initialReport }: AiInsightsViewProps) {
  const [result, setResult] = useState<BusinessAnalysisResult | null>(
    initialReport
      ? {
          brandSummary: brandSummary ?? "",
          contentPillars: [],
          recommendedPlatforms: [],
          insights: toItems(initialReport.insights),
          redFlags: toItems(initialReport.red_flags),
          opportunities: toItems(initialReport.opportunities),
          recommendations: toItems(initialReport.recommendations),
        }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!orgId) {
      setError("Sign in and create a business first");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/analyze-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate insights");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="AI Insights" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {!brandOnboarded ? (
          <div className="rounded-2xl p-8 text-center space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <Brain size={40} className="mx-auto opacity-40" style={{ color: "var(--text-muted)" }} />
            <p className="text-lg font-bold text-white">Complete Brand Intelligence first</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>AI insights need your brand profile to generate anything useful.</p>
            <Link href="/brand" className="btn-primary inline-flex px-5 py-2.5">Set up your brand</Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">AI Business Analysis</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {leadsCount > 0
                    ? `Based on ${leadsCount} lead${leadsCount === 1 ? "" : "s"} and your brand profile`
                    : "Based on your brand profile — add leads for deeper insights"}
                </p>
              </div>
              <button onClick={handleGenerate} disabled={loading} className="btn-primary px-4 py-2.5">
                {loading ? <span className="spinner" /> : <><Sparkles size={14} /> Generate AI Insights</>}
              </button>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            {!result ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "var(--bg-card)", border: "2px dashed var(--border)" }}>
                <Sparkles size={32} className="mx-auto opacity-30 mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No AI insights generated yet. Click Generate above.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {result.brandSummary && (
                  <div className="rounded-2xl p-5" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a78bfa" }}>Brand Summary</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{result.brandSummary}</p>
                    {result.contentPillars.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {result.contentPillars.map((p) => (
                          <span key={p} className="badge badge-purple text-xs">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <ItemList title="Insights" icon={<TrendingUp size={14} />} color="#06b6d4" items={result.insights} />
                  <ItemList title="Red Flags" icon={<AlertTriangle size={14} />} color="#ef4444" items={result.redFlags} />
                  <ItemList title="Opportunities" icon={<Lightbulb size={14} />} color="#10b981" items={result.opportunities} />
                  <ItemList title="Recommendations" icon={<Target size={14} />} color="#f59e0b" items={result.recommendations} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
