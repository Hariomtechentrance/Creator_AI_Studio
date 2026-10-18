"use client";

import Header from "@/components/layout/Header";
import { useEffect, useState } from "react";
import { UserCircle, Mic, Wand2, Download, Sparkles } from "lucide-react";

interface Avatar {
  id: string;
  name: string;
  previewUrl: string | null;
}

interface Voice {
  id: string;
  name: string;
  language: string | null;
}

const COST = 30;

export default function AvatarStudioView({ orgId }: { orgId: string | null }) {
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [optionsError, setOptionsError] = useState("");

  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [mode, setMode] = useState<"script" | "idea">("idea");
  const [scriptText, setScriptText] = useState("");
  const [ideaText, setIdeaText] = useState("");
  const [previewScript, setPreviewScript] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/avatar-studio/options")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { setOptionsError(data.error); return; }
        setConfigured(!!data.configured);
        setAvatars(data.avatars ?? []);
        setVoices(data.voices ?? []);
        if (data.avatars?.[0]) setAvatarId(data.avatars[0].id);
        if (data.voices?.[0]) setVoiceId(data.voices[0].id);
      })
      .catch(() => setOptionsError("Couldn't reach the server"))
      .finally(() => setLoadingOptions(false));
  }, []);

  const previewFromIdea = async () => {
    if (!ideaText.trim()) return;
    setPreviewing(true);
    setError("");
    try {
      const res = await fetch("/api/generate-avatar-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: ideaText, orgId, previewOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't write a script from that idea"); return; }
      setPreviewScript(data.script);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setPreviewing(false);
    }
  };

  const generate = async () => {
    const finalScript = mode === "script" ? scriptText.trim() : (previewScript ?? "").trim();
    if (!finalScript || !avatarId || !voiceId) return;
    setGenerating(true);
    setVideoUrl("");
    setError("");
    try {
      const res = await fetch("/api/generate-avatar-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId, voiceId, script: finalScript, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate that video"); return; }
      setVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = mode === "script" ? !!scriptText.trim() : !!previewScript?.trim();

  if (!loadingOptions && !configured) {
    return (
      <div>
        <Header title="AI Avatar Studio" />
        <div className="flex flex-col items-center justify-center text-center gap-3 p-12" style={{ minHeight: "calc(100vh - 57px)" }}>
          <UserCircle size={64} className="opacity-20" />
          <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>AI Avatar Studio isn&apos;t connected yet</p>
          <p className="text-sm max-w-md" style={{ color: "var(--text-muted)" }}>
            {optionsError || "Add HEYGEN_API_KEY to .env.local to enable AI avatar video generation — HeyGen's pay-as-you-go API, ~$1/min."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="AI Avatar Studio" />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left — avatar/voice/cost */}
        <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-5" style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Avatar</label>
            <div className="grid grid-cols-3 gap-2">
              {avatars.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatarId(a.id)}
                  title={a.name}
                  className="aspect-square rounded-xl overflow-hidden border transition-all"
                  style={{ borderColor: avatarId === a.id ? "rgba(124,58,237,0.7)" : "var(--border)", borderWidth: avatarId === a.id ? 2 : 1 }}
                >
                  {a.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.previewUrl} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--bg-card)" }}>
                      <UserCircle size={20} style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Voice</label>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input w-full">
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.language ? ` — ${v.language}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Cost</span>
              <span style={{ color: "#fbbf24" }} className="font-bold">{COST} credits</span>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: "var(--text-muted)" }}>Est. time</span>
              <span className="font-bold text-white">~2-4 min</span>
            </div>
          </div>
        </div>

        {/* Right — script/idea + output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {(["idea", "script"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setPreviewScript(null); setError(""); }}
                  className="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style={{ background: mode === m ? "rgba(124,58,237,0.2)" : "transparent", color: mode === m ? "#a78bfa" : "var(--text-muted)" }}
                >
                  {m === "idea" ? "Describe an Idea" : "Write Script"}
                </button>
              ))}
            </div>

            {mode === "idea" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <textarea
                    value={ideaText}
                    onChange={(e) => { setIdeaText(e.target.value); setPreviewScript(null); }}
                    placeholder="Describe what this video should sell or explain… e.g. 'Introduce our HR software that stops teams juggling 5 chaotic tools'"
                    rows={3}
                    className="input flex-1 resize-none"
                  />
                  <button onClick={previewFromIdea} disabled={!ideaText.trim() || previewing} className="btn-secondary px-4 self-stretch" style={{ minWidth: 130 }}>
                    {previewing ? <span className="spinner" /> : <><Sparkles size={15} /> Write Script</>}
                  </button>
                </div>
                {previewScript !== null && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>Script (edit before generating)</label>
                    <textarea value={previewScript} onChange={(e) => setPreviewScript(e.target.value)} rows={4} className="input w-full resize-none" />
                  </div>
                )}
              </div>
            ) : (
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Write exactly what the avatar should say…"
                rows={5}
                className="input w-full resize-none"
              />
            )}

            <button onClick={generate} disabled={!canGenerate || !avatarId || !voiceId || generating} className="btn-primary w-full justify-center py-2.5">
              {generating ? <span className="spinner" /> : <><Wand2 size={15} /> Generate Avatar Video</>}
            </button>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            {generating ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" />
                <div>
                  <p className="font-bold text-white text-lg">Generating your avatar video…</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Using HeyGen · ~2-4 minutes</p>
                </div>
                <div className="progress-bar w-64 mx-auto">
                  <div className="progress-fill" style={{ width: "35%" }} />
                </div>
              </div>
            ) : error ? (
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold" style={{ color: "#f87171" }}>{error}</p>
              </div>
            ) : videoUrl ? (
              <div className="w-full max-w-sm space-y-4">
                <video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl" style={{ border: "1px solid var(--border)" }} />
                <div className="flex gap-3 justify-center">
                  <a href={videoUrl} download className="btn-primary px-6">
                    <Download size={15} /> Download
                  </a>
                  <button className="btn-secondary px-6" onClick={() => setVideoUrl("")}>
                    <Wand2 size={15} /> Generate Another
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center" style={{ color: "var(--text-muted)" }}>
                <Mic size={64} className="opacity-20 mx-auto mb-4" />
                <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Your avatar video appears here</p>
                <p className="text-sm mt-1">Pick an avatar and voice, add a script or idea, and generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
