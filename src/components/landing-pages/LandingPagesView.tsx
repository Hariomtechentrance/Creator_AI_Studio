"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Wand2, ExternalLink, Trash2, Layout, Pencil, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLandingPage, togglePublish, deleteLandingPage, parseAbTest } from "@/lib/supabase/landingPages";
import LandingPageEditor from "@/components/landing-pages/LandingPageEditor";
import type { LandingPage } from "@/types/database";
import type { GeneratedLandingPage } from "@/lib/ai/landingPage";

export default function LandingPagesView({ orgId, userId, initialPages }: { orgId: string | null; userId: string | null; initialPages: LandingPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingPage = pages.find((p) => p.id === editingId) ?? null;

  const handleGenerate = async () => {
    if (!topic.trim() || !orgId || !userId) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-landing-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, topic }),
      });
      const data: GeneratedLandingPage & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate a page");
        return;
      }
      const supabase = createClient();
      const { page } = await createLandingPage(supabase, orgId, userId, data);
      if (page) {
        setPages((prev) => [page, ...prev]);
        setTopic("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGenerating(false);
    }
  };

  const handleTogglePublish = async (page: LandingPage) => {
    const publish = page.status !== "published";
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, status: publish ? "published" : "draft" } : p)));
    const supabase = createClient();
    await togglePublish(supabase, page.id, publish);
  };

  const handleDelete = async (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    const supabase = createClient();
    await deleteLandingPage(supabase, id);
  };

  return (
    <div>
      <Header title="Landing Pages" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Generate a new page</p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="e.g. Diwali sale landing page for our bakery"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
            />
            <button onClick={handleGenerate} disabled={generating || !topic.trim() || !orgId} className="btn-primary px-4 flex items-center gap-1.5 shrink-0">
              {generating ? <span className="spinner" /> : <><Wand2 size={13} /> Generate</>}
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
        </div>

        {pages.length === 0 ? (
          <div className="text-center py-16">
            <Layout size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No landing pages yet</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pages.map((page) => (
              <div key={page.id} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-white">{page.headline}</p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                    style={{ background: page.status === "published" ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.15)", color: page.status === "published" ? "#34d399" : "#9ca3af" }}
                  >
                    {page.status}
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{page.subheadline}</p>
                {parseAbTest(page).enabled && (
                  <p className="text-[11px] mb-2 flex items-center gap-1" style={{ color: "#a78bfa" }}><FlaskConical size={11} /> A/B test running</p>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => handleTogglePublish(page)} className="btn-secondary px-3 py-1.5 text-xs">
                    {page.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => setEditingId(page.id)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"><Pencil size={11} /> Edit</button>
                  {page.status === "published" && (
                    <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#a78bfa" }}>
                      <ExternalLink size={11} /> View page
                    </a>
                  )}
                  <button onClick={() => handleDelete(page.id)} className="ml-auto p-1.5 rounded-lg hover:bg-white/10"><Trash2 size={13} style={{ color: "#f87171" }} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LandingPageEditor
        page={editingPage}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        onSaved={(updated) => setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
      />
    </div>
  );
}
