"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, ArrowUp, ArrowDown, Trash2, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateLandingPageContent, updateAbTest, parseAbTest } from "@/lib/supabase/landingPages";
import type { LandingPage } from "@/types/database";
import type { LandingPageSection } from "@/lib/ai/landingPage";

export default function LandingPageEditor({ page, onOpenChange, onSaved }: { page: LandingPage | null; onOpenChange: (open: boolean) => void; onSaved: (page: LandingPage) => void }) {
  if (!page) return null;
  return <EditorBody key={page.id} page={page} onOpenChange={onOpenChange} onSaved={onSaved} />;
}

function EditorBody({ page, onOpenChange, onSaved }: { page: LandingPage; onOpenChange: (open: boolean) => void; onSaved: (page: LandingPage) => void }) {
  const [headline, setHeadline] = useState(page.headline);
  const [subheadline, setSubheadline] = useState(page.subheadline ?? "");
  const [ctaText, setCtaText] = useState(page.cta_text);
  const [sections, setSections] = useState<LandingPageSection[]>((page.sections ?? []) as unknown as LandingPageSection[]);

  const abTest = parseAbTest(page);
  const [abEnabled, setAbEnabled] = useState(abTest.enabled);
  const [variantHeadline, setVariantHeadline] = useState(abTest.variantB?.headline ?? "");
  const [variantSubheadline, setVariantSubheadline] = useState(abTest.variantB?.subheadline ?? "");
  const [variantCta, setVariantCta] = useState(abTest.variantB?.ctaText ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stats = abTest.stats ?? { a: { views: 0, conversions: 0 }, b: { views: 0, conversions: 0 } };
  const rate = (v: { views: number; conversions: number }) => (v.views > 0 ? ((v.conversions / v.views) * 100).toFixed(1) : "0.0");

  const moveSection = (i: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const updateSection = (i: number, field: "heading" | "body", value: string) => {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  };

  const removeSection = (i: number) => setSections((prev) => prev.filter((_, idx) => idx !== i));
  const addSection = () => setSections((prev) => [...prev, { heading: "New section", body: "" }]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: contentError } = await updateLandingPageContent(supabase, page.id, {
        headline,
        subheadline: subheadline || null,
        ctaText,
        sections,
      });
      if (contentError) {
        setError(contentError);
        return;
      }

      const nextAbTest = {
        enabled: abEnabled,
        variantB: abEnabled ? { headline: variantHeadline, subheadline: variantSubheadline, ctaText: variantCta } : undefined,
        stats: abTest.stats,
      };
      const { error: abError } = await updateAbTest(supabase, page.id, nextAbTest);
      if (abError) {
        setError(abError);
        return;
      }

      onSaved({
        ...page,
        headline,
        subheadline: subheadline || null,
        cta_text: ctaText,
        sections: sections as unknown as LandingPage["sections"],
        ab_test: nextAbTest as unknown as LandingPage["ab_test"],
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-white">Edit Page</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg hover:bg-white/10"><X size={16} style={{ color: "var(--text-muted)" }} /></Dialog.Close>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Headline</label>
            <input className="input w-full" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Subheadline</label>
            <input className="input w-full" value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>CTA button text</label>
            <input className="input w-full" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Sections</label>
              <button onClick={addSection} className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1"><Plus size={11} /> Add</button>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="rounded-lg p-3 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <input className="input flex-1 text-sm" value={s.heading} onChange={(e) => updateSection(i, "heading", e.target.value)} placeholder="Heading" />
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ArrowUp size={13} /></button>
                  <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"><ArrowDown size={13} /></button>
                  <button onClick={() => removeSection(i)} className="p-1.5 rounded-lg hover:bg-white/10"><Trash2 size={13} style={{ color: "#f87171" }} /></button>
                </div>
                <textarea className="input w-full text-sm resize-none" rows={2} value={s.body} onChange={(e) => updateSection(i, "body", e.target.value)} placeholder="Body" />
              </div>
            ))}
            {sections.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No sections — add one above.</p>}
          </div>

          <div className="rounded-xl p-3.5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAbEnabled(!abEnabled)}
                className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                style={{ background: abEnabled ? "#7c3aed" : "var(--border)" }}
              >
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: abEnabled ? 18 : 2 }} />
              </button>
              <span className="text-sm font-semibold text-white flex items-center gap-1.5"><FlaskConical size={13} /> A/B test this page</span>
            </div>

            {abEnabled && (
              <div className="space-y-2 pl-1">
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Variant B — 50% of visitors see this instead of the headline/subheadline/CTA above</p>
                <input className="input w-full text-sm" placeholder="Variant B headline" value={variantHeadline} onChange={(e) => setVariantHeadline(e.target.value)} />
                <input className="input w-full text-sm" placeholder="Variant B subheadline" value={variantSubheadline} onChange={(e) => setVariantSubheadline(e.target.value)} />
                <input className="input w-full text-sm" placeholder="Variant B CTA text" value={variantCta} onChange={(e) => setVariantCta(e.target.value)} />

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {(["a", "b"] as const).map((v) => (
                    <div key={v} className="rounded-lg p-2.5 text-xs" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <p className="font-bold text-white uppercase mb-1">Variant {v}</p>
                      <p style={{ color: "var(--text-muted)" }}>{stats[v].views} views · {stats[v].conversions} conversions</p>
                      <p className="font-semibold" style={{ color: "#a78bfa" }}>{rate(stats[v])}% conversion</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-2.5">
            {saving ? <span className="spinner" /> : "Save Changes"}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
