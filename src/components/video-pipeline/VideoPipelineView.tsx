"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Clapperboard, Wand2, UserCircle, Film, Send, Check, RotateCcw, Sparkles, ImagePlus, X } from "lucide-react";
import type { SocialAccount } from "@/types/database";
import { resizeImageFile } from "@/lib/image";
import { CONTENT_CATEGORIES } from "@/lib/ai/contentCategories";

interface Scene {
  sceneNumber: number;
  type: "presenter" | "broll";
  featuresProduct: boolean;
  cameraMovement: string;
  presenterMovement: string;
  dialogue: string;
  visualPrompt: string;
  onScreenText: string;
  transition: "cut" | "crossfade";
  durationSeconds: number;
}

interface Voice {
  id: string;
  name: string;
  language: string | null;
}

type Step = "topic" | "scenes" | "media" | "render" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "topic", label: "Topic" },
  { key: "scenes", label: "Scenes" },
  { key: "media", label: "Media" },
  { key: "render", label: "Render" },
  { key: "review", label: "Review & Submit" },
];

type SceneStatus = { status: "pending" | "running" | "done" | "error"; url?: string; error?: string };

const PUBLISHABLE_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
const ASPECT_RATIOS = ["9:16", "1:1", "16:9", "4:5", "5:4"] as const;

export default function VideoPipelineView({ orgId, connectedPlatforms }: { orgId: string | null; connectedPlatforms: SocialAccount["platform"][] }) {
  const [step, setStep] = useState<Step>("topic");
  const [error, setError] = useState("");

  // Step 1 — topic
  const [topic, setTopic] = useState("");
  const [categoryId, setCategoryId] = useState("general");
  const [generatingScript, setGeneratingScript] = useState(false);

  // Step 2 — scenes
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>("9:16");

  // Step 3 — media (product photos + presenter face)
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [uploadingProductPhoto, setUploadingProductPhoto] = useState(false);
  const [facePrompt, setFacePrompt] = useState("");
  const [generatingFace, setGeneratingFace] = useState(false);
  const [faceOptions, setFaceOptions] = useState<string[]>([]);
  const [selectedFaceUrl, setSelectedFaceUrl] = useState<string | null>(null);
  const [registeringFace, setRegisteringFace] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Step 4 — render
  const [sceneResults, setSceneResults] = useState<Record<number, SceneStatus>>({});
  const [rendering, setRendering] = useState(false);
  const [stitching, setStitching] = useState(false);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState("");

  // Step 5 — review
  const [caption, setCaption] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadVoicesOnce = async () => {
    if (voicesLoaded) return;
    setLoadingVoices(true);
    try {
      const res = await fetch("/api/avatar-studio/options");
      const data = await res.json();
      setVoices(data.voices ?? []);
      if (data.voices?.[0]) setVoiceId(data.voices[0].id);
    } catch {
      setError("Couldn't load voices");
    } finally {
      setLoadingVoices(false);
      setVoicesLoaded(true);
    }
  };

  const generateScenes = async () => {
    if (!topic.trim()) return;
    setGeneratingScript(true);
    setError("");
    try {
      const res = await fetch("/api/video-pipeline/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, orgId, categoryId }),
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

  const updateScene = (index: number, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const needsFace = scenes.some((s) => s.type === "presenter");
  const needsProductPhoto = scenes.some((s) => s.type === "broll" && s.featuresProduct);

  const goToMediaStep = () => {
    if (needsFace) void loadVoicesOnce();
    setStep("media");
  };

  const handleProductPhotoSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingProductPhoto(true);
    setError("");
    try {
      const resized = await Promise.all(Array.from(files).filter((f) => f.type.startsWith("image/")).map((f) => resizeImageFile(f)));
      setProductPhotos((prev) => [...prev, ...resized]);
    } catch {
      setError("Couldn't read one of those image files");
    } finally {
      setUploadingProductPhoto(false);
    }
  };

  const removeProductPhoto = (index: number) => {
    setProductPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const generateFace = async () => {
    if (!facePrompt.trim()) return;
    setGeneratingFace(true);
    setError("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `professional photo of a presenter speaking to camera, friendly confident expression, studio lighting, shoulders-up portrait, ${facePrompt.trim()}`,
          count: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate a face"); return; }
      setFaceOptions(data.images ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGeneratingFace(false);
    }
  };

  const useSelectedFace = async () => {
    if (!selectedFaceUrl) return;
    setRegisteringFace(true);
    setError("");
    try {
      const res = await fetch("/api/video-pipeline/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrlOrDataUrl: selectedFaceUrl, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't register that face"); return; }
      setAssetId(data.assetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setRegisteringFace(false);
    }
  };

  const renderOneScene = async (scene: Scene) => {
    setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "running" } }));
    try {
      // Cycle through uploaded product photos across however many scenes ask for a real product shot.
      const productSceneIndex = scenes.filter((s) => s.type === "broll" && s.featuresProduct).findIndex((s) => s.sceneNumber === scene.sceneNumber);
      const productPhoto = scene.featuresProduct && productPhotos.length ? productPhotos[productSceneIndex % productPhotos.length] : undefined;

      const res =
        scene.type === "presenter"
          ? await fetch("/api/video-pipeline/render-presenter-scene", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetId, script: scene.dialogue, voiceId, orgId }),
            })
          : await fetch("/api/generate-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: scene.visualPrompt, duration: scene.durationSeconds, camera: scene.cameraMovement, ...(productPhoto ? { image: productPhoto } : {}) }),
            });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scene render failed");
      setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "done", url: data.videoUrl } }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scene render failed";
      setSceneResults((prev) => ({ ...prev, [scene.sceneNumber]: { status: "error", error: message } }));
      return false;
    }
  };

  const stitchScenes = async (results: Record<number, SceneStatus>) => {
    setStitching(true);
    setError("");
    try {
      const clips = scenes.map((s) => ({
        url: results[s.sceneNumber]?.url ?? "",
        type: s.type,
        durationSeconds: s.durationSeconds,
        onScreenText: s.onScreenText,
        transition: s.transition,
      }));
      const res = await fetch("/api/video-pipeline/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips, aspectRatio, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't stitch the scenes together"); return; }
      setStitchedVideoUrl(data.videoUrl);
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
    for (const scene of scenes) {
      if (results[scene.sceneNumber]?.status === "done") continue;
      const ok = await renderOneScene(scene);
      if (!ok) { setRendering(false); return; }
      results[scene.sceneNumber] = { status: "done" };
    }
    setRendering(false);

    // Re-read latest results from state (renderOneScene already set them) before stitching.
    setSceneResults((latest) => {
      void stitchScenes(latest);
      return latest;
    });
  };

  const retryScene = async (scene: Scene) => {
    setError("");
    await renderOneScene(scene);
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
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

  return (
    <div>
      <Header title="AI Video Pipeline" />
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left — aspect ratio, cost reference, step list */}
        <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-5" style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar}
                  onClick={() => setAspectRatio(ar)}
                  disabled={step !== "topic" && step !== "scenes"}
                  className="py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: aspectRatio === ar ? "rgba(124,58,237,0.2)" : "var(--bg-card)",
                    border: `1px solid ${aspectRatio === ar ? "rgba(124,58,237,0.5)" : "var(--border)"}`,
                    color: aspectRatio === ar ? "#a78bfa" : "var(--text-muted)",
                  }}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Steps</label>
            <div className="space-y-1">
              {STEPS.map((s, i) => {
                const currentIndex = STEPS.findIndex((x) => x.key === step);
                const isDone = i < currentIndex;
                const isCurrent = s.key === step;
                return (
                  <div key={s.key} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg" style={{ background: isCurrent ? "rgba(124,58,237,0.12)" : "transparent" }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                      style={{
                        background: isDone ? "#10b981" : isCurrent ? "rgba(124,58,237,0.6)" : "var(--bg-card)",
                        color: isDone || isCurrent ? "white" : "var(--text-muted)",
                      }}
                    >
                      {isDone ? <Check size={11} /> : i + 1}
                    </span>
                    <span style={{ color: isCurrent ? "#c4b5fd" : isDone ? "var(--text-secondary)" : "var(--text-muted)" }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="font-semibold mb-1" style={{ color: "#fbbf24" }}>Credit costs</p>
            <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>Scene script</span><span className="text-white">10</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>Presenter scene</span><span className="text-white">30 each</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>Stitching</span><span className="text-white">5</span></div>
          </div>
        </div>

        {/* Right — current step */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          {step === "topic" && (
            <div className="max-w-3xl space-y-4">
              <div className="text-center" style={{ color: "var(--text-muted)" }}>
                <Clapperboard size={48} className="opacity-30 mx-auto mb-3" />
                <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>What&apos;s this video about?</p>
                <p className="text-sm mt-1">Claude will break it into a scene-by-scene shot list — camera movement, dialogue, on-screen text, and durations.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      title={c.description}
                      className="text-left p-2.5 rounded-xl transition-all"
                      style={{
                        background: categoryId === c.id ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                        border: `1px solid ${categoryId === c.id ? "rgba(124,58,237,0.5)" : "var(--border)"}`,
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color: categoryId === c.id ? "#a78bfa" : "var(--text-secondary)" }}>{c.label}</p>
                      <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{c.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Our bakery's new sourdough subscription, aimed at busy professionals"
                rows={4}
                className="input w-full resize-none"
              />
              <button onClick={generateScenes} disabled={!topic.trim() || generatingScript} className="btn-primary w-full justify-center py-2.5">
                {generatingScript ? <span className="spinner" /> : <><Wand2 size={15} /> Generate Scenes</>}
              </button>
            </div>
          )}

          {step === "scenes" && (
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Review and edit each scene before rendering</p>
              {scenes.map((scene, i) => (
                <div key={scene.sceneNumber} className="rounded-xl p-4 space-y-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "#a78bfa" }}>Scene {scene.sceneNumber}</span>
                    <div className="flex items-center gap-2">
                      <select value={scene.type} onChange={(e) => updateScene(i, { type: e.target.value as Scene["type"] })} className="input text-xs py-1">
                        <option value="presenter">Presenter</option>
                        <option value="broll">B-roll</option>
                      </select>
                      <select value={scene.transition} onChange={(e) => updateScene(i, { transition: e.target.value as Scene["transition"] })} className="input text-xs py-1">
                        <option value="cut">Cut</option>
                        <option value="crossfade">Crossfade</option>
                      </select>
                      <input
                        type="number"
                        min={2}
                        max={15}
                        value={scene.durationSeconds}
                        onChange={(e) => updateScene(i, { durationSeconds: Number(e.target.value) })}
                        className="input text-xs py-1 w-14"
                      />
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>sec</span>
                    </div>
                  </div>
                  <input value={scene.cameraMovement} onChange={(e) => updateScene(i, { cameraMovement: e.target.value })} placeholder="Camera movement" className="input w-full text-xs" />
                  {scene.type === "presenter" && (
                    <>
                      <input value={scene.presenterMovement} onChange={(e) => updateScene(i, { presenterMovement: e.target.value })} placeholder="Presenter movement" className="input w-full text-xs" />
                      <textarea value={scene.dialogue} onChange={(e) => updateScene(i, { dialogue: e.target.value })} placeholder="Exact dialogue" rows={2} className="input w-full text-xs resize-none" />
                    </>
                  )}
                  {scene.type === "broll" && (
                    <>
                      <textarea value={scene.visualPrompt} onChange={(e) => updateScene(i, { visualPrompt: e.target.value })} placeholder="What's on screen" rows={2} className="input w-full text-xs resize-none" />
                      <label className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <input type="checkbox" checked={scene.featuresProduct} onChange={(e) => updateScene(i, { featuresProduct: e.target.checked })} />
                        Use a real uploaded product photo for this shot
                      </label>
                    </>
                  )}
                  <input value={scene.onScreenText} onChange={(e) => updateScene(i, { onScreenText: e.target.value })} placeholder="On-screen caption (optional)" className="input w-full text-xs" />
                </div>
              ))}
              <button onClick={goToMediaStep} className="btn-primary w-full justify-center py-2.5">
                <UserCircle size={15} /> Continue to Media
              </button>
            </div>
          )}

          {step === "media" && (
            <div className="max-w-xl space-y-6">
              {needsProductPhoto && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Product photos</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Used for the scenes you marked to feature the real product</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {productPhotos.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                        <button onClick={() => removeProductPhoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
                          <X size={11} className="text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer" style={{ borderColor: "var(--border)" }}>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleProductPhotoSelect(e.target.files)} />
                      {uploadingProductPhoto ? <span className="spinner" /> : <><ImagePlus size={18} style={{ color: "var(--text-muted)" }} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Add photo</span></>}
                    </label>
                  </div>
                </div>
              )}

              {needsFace && (
                <div className="space-y-3">
                  <div className="text-center" style={{ color: "var(--text-muted)" }}>
                    <UserCircle size={40} className="opacity-30 mx-auto mb-2" />
                    <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Generate your presenter&apos;s face</p>
                  </div>
                  <div className="flex gap-2">
                    <input value={facePrompt} onChange={(e) => setFacePrompt(e.target.value)} placeholder="e.g. young Indian woman, warm smile, business casual" className="input flex-1" />
                    <button onClick={generateFace} disabled={!facePrompt.trim() || generatingFace} className="btn-secondary px-4">
                      {generatingFace ? <span className="spinner" /> : <><Sparkles size={15} /> Generate</>}
                    </button>
                  </div>
                  {faceOptions.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {faceOptions.map((url) => (
                        <button
                          key={url}
                          onClick={() => setSelectedFaceUrl(url)}
                          className="aspect-square rounded-xl overflow-hidden border transition-all"
                          style={{ borderColor: selectedFaceUrl === url ? "rgba(124,58,237,0.7)" : "var(--border)", borderWidth: selectedFaceUrl === url ? 2 : 1 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="Face option" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Voice</label>
                    {loadingVoices ? (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading voices…</p>
                    ) : (
                      <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="input w-full">
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}{v.language ? ` — ${v.language}` : ""}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button onClick={useSelectedFace} disabled={!selectedFaceUrl || !voiceId || registeringFace || !!assetId} className="btn-secondary w-full justify-center py-2.5">
                    {registeringFace ? <span className="spinner" /> : assetId ? <><Check size={15} /> Face Registered</> : <><Check size={15} /> Use This Face</>}
                  </button>
                </div>
              )}

              <button
                onClick={() => setStep("render")}
                disabled={(needsFace && !assetId) || (needsProductPhoto && !productPhotos.length)}
                className="btn-primary w-full justify-center py-2.5"
              >
                <Film size={15} /> Continue to Render
              </button>
            </div>
          )}

          {step === "render" && (
            <div className="max-w-xl space-y-4">
              {!rendering && !stitching && !stitchedVideoUrl && Object.keys(sceneResults).length === 0 && (
                <button onClick={startRendering} className="btn-primary w-full justify-center py-2.5">
                  <Film size={15} /> Start Rendering {scenes.length} Scenes
                </button>
              )}

              <div className="space-y-2">
                {scenes.map((scene) => {
                  const result = sceneResults[scene.sceneNumber];
                  return (
                    <div key={scene.sceneNumber} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                        style={{
                          background: result?.status === "done" ? "#10b981" : result?.status === "error" ? "#ef4444" : result?.status === "running" ? "rgba(124,58,237,0.6)" : "var(--bg-secondary)",
                          color: result ? "white" : "var(--text-muted)",
                        }}
                      >
                        {result?.status === "done" ? <Check size={13} /> : result?.status === "running" ? <span className="spinner" style={{ width: 11, height: 11 }} /> : scene.sceneNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                          Scene {scene.sceneNumber} — {scene.type === "presenter" ? "Presenter" : "B-roll"}
                        </p>
                        {result?.status === "error" && <p className="text-[11px]" style={{ color: "#f87171" }}>{result.error}</p>}
                      </div>
                      {result?.status === "error" && (
                        <button onClick={() => retryScene(scene)} className="btn-secondary px-2 py-1 text-xs shrink-0">
                          <RotateCcw size={12} /> Retry
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {stitching && (
                <div className="text-center py-4">
                  <span className="spinner" />
                  <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>Stitching scenes together…</p>
                </div>
              )}

              {stitchedVideoUrl && (
                <div className="space-y-3">
                  <video src={stitchedVideoUrl} controls className="w-full rounded-2xl" style={{ border: "1px solid var(--border)" }} />
                  <button onClick={() => setStep("review")} className="btn-primary w-full justify-center py-2.5">
                    <Send size={15} /> Continue to Review
                  </button>
                </div>
              )}

              {!stitchedVideoUrl && !stitching && allScenesDone && (
                <button onClick={() => void stitchScenes(sceneResults)} className="btn-primary w-full justify-center py-2.5">
                  <Film size={15} /> Stitch Scenes
                </button>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="max-w-xl space-y-4">
              {submitted ? (
                <div className="text-center space-y-3 py-8">
                  <Check size={48} className="mx-auto" style={{ color: "#34d399" }} />
                  <p className="text-lg font-bold text-white">Submitted for approval</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Once approved it publishes automatically to the platforms you selected.</p>
                  <Link href="/approvals" className="btn-primary inline-flex px-6 mt-2">Go to Approvals</Link>
                </div>
              ) : (
                <>
                  <video src={stitchedVideoUrl} controls className="w-full rounded-2xl" style={{ border: "1px solid var(--border)" }} />
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Caption</label>
                    <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} className="input w-full resize-none" placeholder="Write the post caption…" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Hashtags</label>
                    <input value={hashtagsInput} onChange={(e) => setHashtagsInput(e.target.value)} className="input w-full" placeholder="bakery sourdough mumbai" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Publish to</label>
                    {connectablePlatforms.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No platforms connected yet — <Link href="/social-accounts" className="underline" style={{ color: "#a78bfa" }}>connect one</Link> first.
                      </p>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {connectablePlatforms.map((p) => (
                          <button
                            key={p}
                            onClick={() => togglePlatform(p)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                            style={{
                              background: platforms.includes(p) ? "rgba(124,58,237,0.2)" : "var(--bg-card)",
                              border: `1px solid ${platforms.includes(p) ? "rgba(124,58,237,0.5)" : "var(--border)"}`,
                              color: platforms.includes(p) ? "#a78bfa" : "var(--text-muted)",
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={submitForApproval} disabled={!platforms.length || submitting} className="btn-primary w-full justify-center py-2.5">
                    {submitting ? <span className="spinner" /> : <><Send size={15} /> Submit for Approval</>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
