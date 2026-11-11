"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import {
  Sparkles, ImagePlus, X, Wand2, RefreshCw, Film, Check, Send, CalendarClock,
} from "lucide-react";
import type { SocialAccount } from "@/types/database";
import { resizeImageFile } from "@/lib/image";
import { CONTENT_CATEGORIES } from "@/lib/ai/contentCategories";
import type { PlatformContent } from "@/lib/ai/contentGeneration";

interface ReelScene {
  sceneNumber: number;
  camera: string;
  visualPrompt: string;
  onScreenText: string;
  durationSeconds: number;
}

type Quality = "kenburns" | "cinematic";

type SceneStatus = { status: "pending" | "running" | "done" | "error"; url?: string; error?: string; usedProvider?: string };
type Step = "setup" | "photos" | "scenes" | "render" | "review";

const STEPS: { key: Step; label: string }[] = [
  { key: "setup", label: "Product" },
  { key: "photos", label: "Photos" },
  { key: "scenes", label: "Script" },
  { key: "render", label: "Render" },
  { key: "review", label: "Caption & Submit" },
];

const PUBLISHABLE_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
const ASPECT_RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const;

export default function ProductReelView({ orgId, connectedPlatforms }: { orgId: string | null; connectedPlatforms: SocialAccount["platform"][] }) {
  const [step, setStep] = useState<Step>("setup");
  const [error, setError] = useState("");

  // Step 1 — product / category
  const [topic, setTopic] = useState("");
  const [categoryId, setCategoryId] = useState("product_showcase");
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("9:16");
  const [quality, setQuality] = useState<Quality>("kenburns");
  const [includeEndCard, setIncludeEndCard] = useState(true);
  const [targetDuration, setTargetDuration] = useState(20);

  // Step 2 — photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 3 — scenes
  const [scenes, setScenes] = useState<ReelScene[]>([]);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Step 4 — render
  const [sceneResults, setSceneResults] = useState<Record<number, SceneStatus>>({});
  const [rendering, setRendering] = useState(false);
  const [stitching, setStitching] = useState(false);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState("");

  // Step 5 — caption & submit
  const [caption, setCaption] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const resized = await Promise.all(Array.from(files).filter((f) => f.type.startsWith("image/")).map((f) => resizeImageFile(f)));
      setPhotos((prev) => [...prev, ...resized]);
    } catch {
      setError("Couldn't read one of those image files");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const generateScript = async () => {
    if (!topic.trim() || !photos.length || !orgId) return;
    setGeneratingScript(true);
    setError("");
    try {
      const res = await fetch("/api/product-reel/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, orgId, categoryId, numPhotos: photos.length, targetDurationSeconds: targetDuration }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate a scene script"); return; }
      setScenes(data.scenes);
      setStep("scenes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGeneratingScript(false);
    }
  };

  const updateSceneText = (sceneNumber: number, onScreenText: string) => {
    setScenes((prev) => prev.map((s) => (s.sceneNumber === sceneNumber ? { ...s, onScreenText } : s)));
  };

  const renderKenBurns = async (scene: ReelScene, photo: string) => {
    const res = await fetch("/api/product-reel/render-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: photo, camera: scene.camera, durationSeconds: scene.durationSeconds, orgId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Scene render failed");
    return data.videoUrl as string;
  };

  const renderCinematic = async (scene: ReelScene, photo: string, provider: "piapi" | "kling" | "luma") => {
    const res = await fetch("/api/generate-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: scene.visualPrompt, duration: scene.durationSeconds, camera: scene.camera, provider, image: photo, orgId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Scene render failed");
    return data.videoUrl as string;
  };

  /**
   * AI video providers run on shared capacity and can throw transient
   * "high demand" / overload errors, or genuinely run out of account
   * credit, with no advance warning. A reel shouldn't fail outright because
   * of that — cinematic mode falls back PiAPI (cheapest real option) ->
   * Replicate Kling -> Replicate Luma -> the always-available local Ken
   * Burns render, rather than surfacing the first provider's hiccup (or
   * empty wallet) as a hard failure.
   */
  const renderOneScene = async (scene: ReelScene, photo: string): Promise<boolean> => {
    setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "running" } }));
    if (quality !== "cinematic") {
      try {
        const url = await renderKenBurns(scene, photo);
        setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "done", url } }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Scene render failed";
        setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "error", error: message } }));
        return false;
      }
    }

    const attempts: { label: string; run: () => Promise<string> }[] = [
      { label: "PiAPI (Kling)", run: () => renderCinematic(scene, photo, "piapi") },
      { label: "Kling (Replicate)", run: () => renderCinematic(scene, photo, "kling") },
      { label: "Luma (Replicate)", run: () => renderCinematic(scene, photo, "luma") },
      { label: "Ken Burns (fallback)", run: () => renderKenBurns(scene, photo) },
    ];
    let lastError = "";
    for (const attempt of attempts) {
      try {
        const url = await attempt.run();
        setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "done", url, usedProvider: attempt.label } }));
        return true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Scene render failed";
      }
    }
    setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "error", error: lastError } }));
    return false;
  };

  const stitchScenes = async (results: Record<number, SceneStatus>) => {
    setStitching(true);
    setError("");
    try {
      const clips: { url: string; type: "broll"; durationSeconds: number; onScreenText: string; transition: "cut" | "crossfade" }[] = scenes.map((s, i) => ({
        url: results[s.sceneNumber]?.url ?? "",
        type: "broll" as const,
        durationSeconds: s.durationSeconds,
        onScreenText: s.onScreenText,
        transition: i === 0 ? ("cut" as const) : ("crossfade" as const),
      }));

      if (includeEndCard && orgId) {
        try {
          const cardRes = await fetch("/api/video/contact-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId, aspectRatio, durationSeconds: 4 }),
          });
          const cardData = await cardRes.json();
          if (cardRes.ok && cardData.videoUrl) {
            clips.push({ url: cardData.videoUrl, type: "broll", durationSeconds: 4, onScreenText: "", transition: "crossfade" });
          }
          // A failed end-card shouldn't block the whole reel — the scenes themselves already rendered fine.
        } catch {
          // Same reasoning — swallow and continue without the card.
        }
      }

      const res = await fetch("/api/video-pipeline/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips, aspectRatio, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't stitch the scenes together"); return; }
      setStitchedVideoUrl(data.videoUrl);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setStitching(false);
    }
  };

  const startRendering = async () => {
    setRendering(true);
    setError("");
    const results: Record<number, SceneStatus> = { ...sceneResults };
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (results[scene.sceneNumber]?.status === "done") continue;
      const ok = await renderOneScene(scene, photos[i]);
      if (!ok) { setRendering(false); return; }
      results[scene.sceneNumber] = { status: "done" };
    }
    setRendering(false);
    setSceneResults((latest) => {
      void stitchScenes(latest);
      return latest;
    });
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const generateCaption = async () => {
    if (!orgId || !topic.trim() || !platforms.length) return;
    setGeneratingCaption(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, topic, contentType: "reel", tone: "Professional", platforms }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't suggest a caption"); return; }
      const variations = data.variations as PlatformContent[];
      const primary = variations[0];
      if (primary) {
        setCaption(primary.caption);
        setHashtagsInput(primary.hashtags.join(" "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const submitForApproval = async () => {
    if (!orgId || !stitchedVideoUrl || !platforms.length) return;
    setSubmitting(true);
    setError("");
    try {
      const hashtags = hashtagsInput.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`));
      const res = await fetch("/api/video-pipeline/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, topic, caption, hashtags, platforms, videoUrl: stitchedVideoUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't submit for approval"); return; }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSubmitting(false);
    }
  };

  const allScenesDone = scenes.length > 0 && scenes.every((s) => sceneResults[s.sceneNumber]?.status === "done");
  const connectablePlatforms = PUBLISHABLE_PLATFORMS.filter((p) => connectedPlatforms.includes(p));
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" } as const;

  return (
    <div>
      <Header title="Product Reel" />
      <div className="p-6 max-w-5xl mx-auto space-y-5">

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5 flex-1">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                style={{
                  background: i === stepIndex ? "rgba(124,58,237,0.2)" : i < stepIndex ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                  color: i === stepIndex ? "#c4b5fd" : i < stepIndex ? "#34d399" : "var(--text-muted)",
                  border: `1px solid ${i === stepIndex ? "rgba(124,58,237,0.4)" : "transparent"}`,
                }}
              >
                {i < stepIndex ? <Check size={12} /> : <span>{i + 1}</span>} {s.label}
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1" style={{ background: "var(--border)" }} />}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </p>
        )}

        {/* Step: setup */}
        {step === "setup" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Product / Brief</p>
              <textarea
                className="input w-full resize-none text-sm"
                rows={3}
                placeholder="What product is this reel for? e.g. 'Our new leather weekender bag, handmade, waterproof lining'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>What kind of reel?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {CONTENT_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    title={c.description}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all"
                    style={{
                      background: categoryId === c.id ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: categoryId === c.id ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: categoryId === c.id ? "#c4b5fd" : "var(--text-secondary)",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>How long should the video be?</p>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 25, 30].map((secs) => (
                  <button
                    key={secs}
                    onClick={() => setTargetDuration(secs)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: targetDuration === secs ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${targetDuration === secs ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                      color: targetDuration === secs ? "#c4b5fd" : "var(--text-secondary)",
                    }}
                  >
                    {secs}s
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>More photos = more scenes needed to fill a longer video — upload enough for the length you pick.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Aspect Ratio</p>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: aspectRatio === ar ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${aspectRatio === ar ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                      color: aspectRatio === ar ? "#c4b5fd" : "var(--text-secondary)",
                    }}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Video Quality</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setQuality("kenburns")}
                  className="px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: quality === "kenburns" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${quality === "kenburns" ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <p className="text-xs font-bold" style={{ color: quality === "kenburns" ? "#c4b5fd" : "var(--text-secondary)" }}>Free — Pan &amp; Zoom</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Local, $0, camera motion only</p>
                </button>
                <button
                  onClick={() => setQuality("cinematic")}
                  className="px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: quality === "cinematic" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${quality === "cinematic" ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <p className="text-xs font-bold" style={{ color: quality === "cinematic" ? "#c4b5fd" : "var(--text-secondary)" }}>Cinematic AI</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Real motion/lighting, paid per clip</p>
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={includeEndCard} onChange={(e) => setIncludeEndCard(e.target.checked)} className="w-4 h-4" />
              End with a branded contact card (logo, website, phone — from your Brand Kit)
            </label>
            <button
              onClick={() => setStep("photos")}
              disabled={!topic.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >
              Next — Upload Photos
            </button>
          </div>
        )}

        {/* Step: photos */}
        {step === "photos" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Product Photos — one scene per photo, 3-6 works best for a 20-30s reel
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.6)" }}
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>
                    Scene {i + 1}
                  </span>
                </div>
              ))}
              <label
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                style={{ border: "2px dashed var(--border)", color: "var(--text-muted)" }}
              >
                <ImagePlus size={20} />
                <span className="text-[10px] font-semibold">{uploadingPhoto ? "Reading…" : "Add photo"}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoSelect(e.target.files)} disabled={uploadingPhoto} />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("setup")}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
              >
                Back
              </button>
              <button
                onClick={generateScript}
                disabled={!photos.length || generatingScript}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: generatingScript ? "rgba(124,58,237,0.5)" : "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                {generatingScript ? (<><RefreshCw size={15} className="animate-spin" /> Writing scene callouts…</>) : (<><Wand2 size={15} /> Generate Scene Script</>)}
              </button>
            </div>
          </div>
        )}

        {/* Step: scenes */}
        {step === "scenes" && (
          <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Review each scene&apos;s on-screen text — edit anything before rendering
            </p>
            {scenes.map((s, i) => (
              <div key={s.sceneNumber} className="flex gap-3 items-center rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[i]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
                    <span>Scene {s.sceneNumber}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>{s.camera}</span>
                    <span>{s.durationSeconds}s</span>
                  </div>
                  <input
                    className="input w-full text-sm py-1.5"
                    value={s.onScreenText}
                    onChange={(e) => updateSceneText(s.sceneNumber, e.target.value)}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setStep("photos")}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
              >
                Back
              </button>
              <button
                onClick={() => { setStep("render"); void startRendering(); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                <Film size={15} /> Render Reel
              </button>
            </div>
          </div>
        )}

        {/* Step: render */}
        {step === "render" && (
          <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Rendering scenes</p>
            {scenes.map((s) => {
              const result = sceneResults[s.sceneNumber];
              return (
                <div key={s.sceneNumber} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Scene {s.sceneNumber} — {s.onScreenText}</span>
                  {result?.status === "running" && <RefreshCw size={14} className="animate-spin" style={{ color: "#a78bfa" }} />}
                  {result?.status === "done" && (
                    <span className="flex items-center gap-1.5">
                      {result.usedProvider && result.usedProvider !== "PiAPI (Kling)" && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>via {result.usedProvider}</span>
                      )}
                      <Check size={14} style={{ color: "#34d399" }} />
                    </span>
                  )}
                  {result?.status === "error" && <span className="text-[10px]" style={{ color: "#f87171" }}>{result.error}</span>}
                  {!result && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Queued</span>}
                </div>
              );
            })}
            {stitching && (
              <div className="flex items-center gap-2 text-xs font-semibold py-2" style={{ color: "#a78bfa" }}>
                <RefreshCw size={14} className="animate-spin" /> Stitching scenes into one reel…
              </div>
            )}
            {!rendering && !stitching && allScenesDone && !stitchedVideoUrl && (
              <button
                onClick={() => void stitchScenes(sceneResults)}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
              >
                Retry Stitching
              </button>
            )}
          </div>
        )}

        {/* Step: review */}
        {step === "review" && (
          <div className="space-y-4">
            {stitchedVideoUrl && (
              <div className="rounded-2xl overflow-hidden" style={cardStyle}>
                <video src={stitchedVideoUrl} controls className="w-full max-h-[420px] bg-black" />
              </div>
            )}

            {!submitted ? (
              <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Platforms</p>
                  <div className="flex flex-wrap gap-2">
                    {PUBLISHABLE_PLATFORMS.map((p) => {
                      const connected = connectedPlatforms.includes(p);
                      return (
                        <button
                          key={p}
                          onClick={() => connected && togglePlatform(p)}
                          disabled={!connected}
                          title={connected ? "" : "Connect this platform on Social Accounts first"}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all disabled:opacity-40"
                          style={{
                            background: platforms.includes(p) ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${platforms.includes(p) ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                            color: platforms.includes(p) ? "#c4b5fd" : "var(--text-secondary)",
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  {!connectablePlatforms.length && (
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>No platforms connected yet — connect one on Social Accounts to publish.</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Caption</p>
                  <button
                    onClick={generateCaption}
                    disabled={!platforms.length || generatingCaption}
                    className="flex items-center gap-1 text-[11px] font-semibold disabled:opacity-40"
                    style={{ color: "#a78bfa" }}
                  >
                    <Sparkles size={11} /> {generatingCaption ? "Suggesting…" : "Suggest caption & hashtags"}
                  </button>
                </div>
                <textarea className="input w-full resize-none text-sm" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption, or click 'Suggest caption & hashtags' above" />
                <input className="input w-full text-sm" value={hashtagsInput} onChange={(e) => setHashtagsInput(e.target.value)} placeholder="#hashtags #go #here" />

                <button
                  onClick={submitForApproval}
                  disabled={submitting || !platforms.length || !caption.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
                >
                  {submitting ? (<><RefreshCw size={15} className="animate-spin" /> Submitting…</>) : (<><Send size={15} /> Submit for Approval</>)}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center space-y-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <CalendarClock size={24} className="mx-auto" style={{ color: "#34d399" }} />
                <p className="text-sm font-bold" style={{ color: "#34d399" }}>Submitted for approval</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Approving it on the Approvals page will auto-publish to the selected platform(s).</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
