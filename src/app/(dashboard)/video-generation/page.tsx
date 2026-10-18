"use client";

import Header from "@/components/layout/Header";
import { useRef, useState } from "react";
import { Video, Upload, Download, Wand2, X } from "lucide-react";
import { resizeImageFile } from "@/lib/image";

const PROVIDERS = [
  { id: "kling", name: "Kling 1.6", badge: "30s Ready", cost: 20, maxDuration: 10, desc: "High-fidelity, up to 30s clips", color: "#f59e0b", requiresImage: false },
  { id: "luma", name: "Luma Dream Machine", badge: "Popular", cost: 20, maxDuration: 9, desc: "Smooth photorealistic motion", color: "#06b6d4", requiresImage: false },
  { id: "ltx", name: "LTX 2.3", badge: "Free", cost: 0, maxDuration: 10, desc: "Free community GPU — slower, can be queued or unavailable", color: "#84cc16", requiresImage: false },
  { id: "wan", name: "Wan 2.1 (Colab)", badge: "Free · Real AI", cost: 0, maxDuration: 6, desc: "Real AI video on your own free Colab GPU — needs the notebook running, see colab/", color: "#38bdf8", requiresImage: false },
  { id: "kenburns", name: "Ken Burns", badge: "Free · Local", cost: 0, maxDuration: 10, desc: "Pan/zoom effect on your photo — instant, runs on this machine, no AI motion", color: "#f472b6", requiresImage: true },
];

const CAMERAS = ["None", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Orbit Left", "Orbit Right", "Tilt Up", "Tilt Down", "Crane Up"];

export default function VideoGenerationPage() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("kling");
  const [duration, setDuration] = useState(5);
  const [camera, setCamera] = useState("None");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"text" | "image">("text");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sel = PROVIDERS.find((p) => p.id === provider)!;

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please upload an image file"); return; }
    try {
      const resized = await resizeImageFile(file);
      setImage(resized);
      setImageName(file.name);
      setError("");
    } catch {
      setError("Couldn't read that image file");
    }
  };

  const clearImage = () => {
    setImage(null);
    setImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    if (mode === "image" && !image) { setError("Upload an image to animate first"); return; }
    setLoading(true);
    setVideoUrl("");
    setError("");
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider,
          duration,
          camera,
          ...(mode === "image" && image ? { image } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't generate that video");
        return;
      }
      setVideoUrl(data.videoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="AI Video Generation" />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left — controls */}
        <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-5" style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>

          {/* Mode tabs */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {(["text", "image"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-2.5 text-sm font-semibold transition-all capitalize"
                style={{
                  background: mode === m ? "rgba(124,58,237,0.2)" : "transparent",
                  color: mode === m ? "#a78bfa" : "var(--text-muted)",
                }}
              >
                {m === "text" ? "Text to Video" : "Image to Video"}
              </button>
            ))}
          </div>

          {/* Providers */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>AI Provider</label>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); setDuration(Math.min(duration, p.maxDuration)); if (p.requiresImage) setMode("image"); }}
                  className="w-full text-left p-3 rounded-xl border transition-all"
                  style={{
                    background: provider === p.id ? "rgba(124,58,237,0.12)" : "var(--bg-card)",
                    borderColor: provider === p.id ? "rgba(124,58,237,0.5)" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    <span className="badge text-xs" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>{p.badge}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.desc}</span>
                    <span className="text-xs font-medium" style={{ color: "#fbbf24" }}>{p.cost}cr</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Duration</label>
              <span className="text-sm font-bold text-white">{duration}s</span>
            </div>
            <input
              type="range"
              min={5}
              max={sel.maxDuration}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              <span>5s</span><span>{sel.maxDuration}s max</span>
            </div>
          </div>

          {/* Camera motion */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Camera Motion</label>
            <div className="flex flex-wrap gap-1.5">
              {CAMERAS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCamera(c)}
                  className="px-2.5 py-1 rounded-lg text-xs border transition-all"
                  style={{
                    background: camera === c ? "rgba(124,58,237,0.15)" : "transparent",
                    borderColor: camera === c ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: camera === c ? "#a78bfa" : "var(--text-muted)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Cost */}
          <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Cost</span>
              <span style={{ color: "#fbbf24" }} className="font-bold">{sel.cost} credits</span>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: "var(--text-muted)" }}>Est. time</span>
              <span className="font-bold text-white">~2-4 min</span>
            </div>
          </div>
        </div>

        {/* Right — prompt + output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
            {mode === "image" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                {image ? (
                  <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Upload" className="w-full h-40 object-cover" />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 rounded-lg"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                      title="Remove image"
                    >
                      <X size={13} className="text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 px-2 py-1 truncate text-[10px]" style={{ background: "rgba(0,0,0,0.7)", color: "var(--text-muted)" }}>
                      {imageName}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files?.[0] ?? null); }}
                    className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
                    style={{
                      borderColor: dragOver ? "rgba(124,58,237,0.6)" : "var(--border)",
                      background: dragOver ? "rgba(124,58,237,0.08)" : "transparent",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Upload size={24} />
                    <p className="text-sm">Drop an image or click to upload</p>
                    <p className="text-xs">JPG, PNG, WEBP — max 10MB</p>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === "image" ? "Describe the motion you want… e.g. 'the woman turns and smiles at the camera'" : "Describe the video you want to create… e.g. 'A lone astronaut walking on Mars, dust swirling, cinematic, golden sunset'"}
                rows={3}
                className="input flex-1 resize-none"
              />
              <button
                onClick={generate}
                disabled={!prompt.trim() || loading || (mode === "image" && !image)}
                className="btn-primary px-5 self-stretch"
                style={{ minWidth: 120 }}
              >
                {loading ? <span className="spinner" /> : <><Video size={15} /> Generate</>}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            {loading ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" />
                <div>
                  <p className="font-bold text-white text-lg">Generating your video…</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Using {sel.name} · ~2-4 minutes</p>
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
              <div className="w-full max-w-2xl space-y-4">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full rounded-2xl"
                  style={{ border: "1px solid var(--border)" }}
                />
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
                <Video size={64} className="opacity-20 mx-auto mb-4" />
                <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Your video appears here</p>
                <p className="text-sm mt-1">Choose a provider, write a prompt, and generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
