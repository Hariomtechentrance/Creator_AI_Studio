"use client";

import Header from "@/components/layout/Header";
import { useState, useCallback } from "react";
import { ArrowUpCircle, Upload, Download } from "lucide-react";

const MODELS = [
  { id: "real-esrgan", name: "Real-ESRGAN x4+", badge: "Photo", cost: 10, desc: "Best for photos, faces, nature" },
  { id: "esrgan-anime", name: "ESRGAN Anime", badge: "Anime", cost: 10, desc: "Optimised for anime & illustrations" },
  { id: "clarity", name: "Clarity Upscaler", badge: "Detail", cost: 15, desc: "Maximum detail & sharpness" },
  { id: "supir", name: "SUPIR", badge: "AI+", cost: 20, desc: "AI-powered detail enhancement" },
];

const SCALES = [2, 4, 8];

export default function UpscalerPage() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [model, setModel] = useState("real-esrgan");
  const [scale, setScale] = useState(4);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
    setResult(null);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFile(file);
  }, []);

  const upscale = async () => {
    if (!image) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, model, scale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't upscale that image");
        return;
      }
      setResult(data.resultUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  const sel = MODELS.find((m) => m.id === model)!;

  return (
    <div>
      <Header title="Universal Upscaler" />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Controls */}
        <div className="w-72 shrink-0 overflow-y-auto p-4 space-y-5" style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Model</label>
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className="w-full text-left p-3 rounded-xl border mb-2 transition-all"
                style={{
                  background: model === m.id ? "rgba(124,58,237,0.12)" : "var(--bg-card)",
                  borderColor: model === m.id ? "rgba(124,58,237,0.5)" : "var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-bold text-white">{m.name}</span>
                  <span className="badge badge-purple text-xs">{m.badge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{m.desc}</span>
                  <span className="text-xs font-medium" style={{ color: "#fbbf24" }}>{m.cost}cr</span>
                </div>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Upscale Factor</label>
            <div className="flex gap-2">
              {SCALES.map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm transition-all"
                  style={{
                    background: scale === s ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                    borderColor: scale === s ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: scale === s ? "#a78bfa" : "var(--text-secondary)",
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              {scale}x = output will be {scale * scale}× the pixel count
            </p>
          </div>

          <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex justify-between"><span style={{ color: "var(--text-muted)" }}>Cost</span><span style={{ color: "#fbbf24" }} className="font-bold">{sel.cost} credits</span></div>
            <div className="flex justify-between mt-1"><span style={{ color: "var(--text-muted)" }}>Max output</span><span className="font-bold text-white">Up to 8K</span></div>
          </div>

          <button onClick={upscale} disabled={!image || loading} className="btn-primary w-full justify-center py-3">
            {loading ? <span className="spinner" /> : <><ArrowUpCircle size={15} /> Upscale {scale}x</>}
          </button>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!image ? (
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              className="h-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all"
              style={{ borderColor: dragging ? "#7c3aed" : "var(--border)", background: dragging ? "rgba(124,58,237,0.05)" : "transparent" }}
            >
              <label className="flex flex-col items-center gap-4 cursor-pointer">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)", border: "2px dashed rgba(124,58,237,0.3)" }}>
                  <Upload size={32} style={{ color: "#7c3aed" }} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">Drop your image here</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>or click to browse — JPG, PNG, WEBP up to 10MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`grid gap-6 ${result ? "grid-cols-2" : "grid-cols-1 max-w-xl mx-auto"}`}>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>Original</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="Original" className="w-full rounded-2xl" style={{ border: "1px solid var(--border)" }} />
                </div>
                {result && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>Upscaled {scale}x</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result} alt="Upscaled" className="w-full rounded-2xl" style={{ border: "1px solid rgba(16,185,129,0.4)" }} />
                    <a href={result} download className="btn-primary w-full justify-center"><Download size={14} /> Download {scale}x</a>
                  </div>
                )}
              </div>
              {loading && (
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" />
                  <p className="text-white font-semibold">Upscaling {scale}x…</p>
                  <div className="progress-bar w-64 mx-auto"><div className="progress-fill" style={{ width: "60%" }} /></div>
                </div>
              )}
              {error && <p className="text-center text-sm font-semibold" style={{ color: "#f87171" }}>{error}</p>}
              <div className="flex gap-3 justify-center">
                <label className="btn-secondary cursor-pointer">
                  <Upload size={14} /> Upload New Image
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
