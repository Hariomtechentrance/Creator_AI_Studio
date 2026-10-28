"use client";

import Header from "@/components/layout/Header";
import { useState } from "react";
import {
  Sparkles, FileText, Camera, Briefcase, ThumbsUp, X as Twitter,
  Copy, RefreshCw, ChevronDown, Wand2, Hash, AtSign, CalendarClock,
} from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { createClient } from "@/lib/supabase/client";
import { saveGeneratedPost, scheduleContentPost } from "@/lib/supabase/content";
import type { PlatformContent } from "@/lib/ai/contentGeneration";

const CONTENT_TYPES = [
  { value: "post", label: "Social Post", icon: "📝" },
  { value: "caption", label: "Photo Caption", icon: "🖼️" },
  { value: "reel", label: "Reel Script", icon: "🎬" },
  { value: "story", label: "Story Ideas", icon: "✨" },
  { value: "ad", label: "Ad Copy", icon: "📣" },
  { value: "email", label: "Email / Newsletter", icon: "📧" },
  { value: "blog", label: "Blog Intro", icon: "📰" },
  { value: "whatsapp", label: "WhatsApp Message", icon: "💬" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: <Camera size={14} />, color: "#e1306c" },
  { id: "linkedin", label: "LinkedIn", icon: <Briefcase size={14} />, color: "#0077b5" },
  { id: "facebook", label: "Facebook", icon: <ThumbsUp size={14} />, color: "#1877f2" },
  { id: "twitter", label: "Twitter/X", icon: <Twitter size={14} />, color: "#1d9bf0" },
];

const EXAMPLE_TOPICS = [
  "Announce our new product launch with excitement",
  "Share a behind-the-scenes look at our process",
  "Educational post about our industry's biggest myth",
  "Customer success story — transformation post",
];

export default function ContentPage() {
  const orgId = useSessionStore((s) => s.org?.id ?? null);
  const userId = useSessionStore((s) => s.profile?.id ?? null);

  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState("post");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram"]);
  const [tone, setTone] = useState("Professional");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [variations, setVariations] = useState<PlatformContent[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const togglePlatform = (id: string) =>
    setSelectedPlatforms((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleGenerate = async () => {
    if (!topic.trim() || !orgId || selectedPlatforms.length === 0) return;
    setGenerating(true);
    setError("");
    setSavedPostId(null);
    setScheduled(false);
    try {
      const res = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, topic, contentType, tone, platforms: selectedPlatforms }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate content");
        return;
      }
      setVariations(data.variations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!variations || !orgId || !userId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { post } = await saveGeneratedPost(supabase, orgId, userId, { topic, contentType, variations });
      if (post) setSavedPostId(post.id);
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!savedPostId || !scheduleDate) return;
    setScheduling(true);
    try {
      const supabase = createClient();
      const { error: schedError } = await scheduleContentPost(supabase, savedPostId, new Date(scheduleDate).toISOString());
      if (!schedError) setScheduled(true);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div>
      <Header title="Content Studio" />

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-5 gap-5">

          {/* Left — Input panel */}
          <div className="lg:col-span-2 space-y-4">

            {/* Content type */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Content Type</p>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setContentType(t.value)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all"
                    style={{
                      background: contentType === t.value ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: contentType === t.value ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: contentType === t.value ? "#c4b5fd" : "var(--text-secondary)",
                    }}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic input */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Topic / Brief</p>
              <textarea
                className="input w-full resize-none text-sm"
                rows={4}
                placeholder="What should this post be about? Be specific for best results…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Quick ideas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_TOPICS.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setTopic(ex)}
                      className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {ex.slice(0, 30)}…
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Platform & Tone */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Platforms</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: selectedPlatforms.includes(p.id) ? `${p.color}20` : "rgba(255,255,255,0.04)",
                      border: selectedPlatforms.includes(p.id) ? `1px solid ${p.color}60` : "1px solid rgba(255,255,255,0.08)",
                      color: selectedPlatforms.includes(p.id) ? p.color : "var(--text-secondary)",
                    }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
              {selectedPlatforms.includes("instagram") && (
                <p className="text-[11px] rounded-lg px-2.5 py-2" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                  Instagram requires an image or video on every post — this generates text only, so Instagram publishing will fail unless you attach media. Use Product Reel or AI Video Pipeline for Instagram-ready posts.
                </p>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Tone</p>
                <div className="relative">
                  <select
                    className="input w-full appearance-none pr-8 text-sm"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    {["Professional", "Casual", "Fun", "Luxury", "Bold", "Friendly", "Authoritative"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || !orgId || selectedPlatforms.length === 0 || generating}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              style={{
                background: generating ? "rgba(124,58,237,0.5)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
                boxShadow: !generating && topic.trim() ? "0 0 25px rgba(124,58,237,0.35)" : "none",
              }}
            >
              {generating ? (
                <><RefreshCw size={15} className="animate-spin" /> Generating content…</>
              ) : (
                <><Wand2 size={15} /> Generate Content</>
              )}
            </button>
          </div>

          {/* Right — Output panel */}
          <div className="lg:col-span-3 space-y-4">
            {!variations ? (
              <div
                className="rounded-2xl flex flex-col items-center justify-center py-24 gap-4"
                style={{ background: "var(--bg-card)", border: "2px dashed var(--border)" }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
                >
                  <Sparkles size={28} className="text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white mb-1">AI Content Generator</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Enter a topic and click Generate — AI will write platform-optimized content in your brand voice
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {variations.map((v) => {
                  const platformMeta = PLATFORMS.find((p) => p.id === v.platform) ?? PLATFORMS[0];
                  return (
                    <div key={v.platform} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ background: `${platformMeta.color}1a`, borderBottom: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-2">
                          {platformMeta.icon}
                          <span className="text-sm font-bold capitalize" style={{ color: platformMeta.color }}>{v.platform}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(v.caption)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
                        >
                          <Copy size={11} /> {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="p-4">
                        <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans" style={{ color: "var(--text-secondary)" }}>
                          {v.caption}
                        </pre>
                      </div>
                      <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center gap-2">
                          <Hash size={12} style={{ color: "var(--text-muted)" }} />
                          <div className="flex flex-wrap gap-1.5">
                            {v.hashtags.map((h) => (
                              <span key={h} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${platformMeta.color}1a`, color: platformMeta.color }}>
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AtSign size={12} style={{ color: "var(--text-muted)" }} />
                          <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>CTA: {v.cta}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Action row */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving || !!savedPostId}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                  >
                    <FileText size={12} /> {saving ? "Saving…" : savedPostId ? "Saved to Drafts" : "Save to Drafts"}
                  </button>

                  {savedPostId && !scheduled && (
                    <>
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="input text-xs py-2"
                      />
                      <button
                        onClick={handleSchedule}
                        disabled={!scheduleDate || scheduling}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
                      >
                        <CalendarClock size={12} /> {scheduling ? "Scheduling…" : "Schedule Post"}
                      </button>
                    </>
                  )}
                  {scheduled && (
                    <span className="text-xs font-semibold" style={{ color: "#34d399" }}>✓ Scheduled — actual posting needs a connected social account (Social Accounts page)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
