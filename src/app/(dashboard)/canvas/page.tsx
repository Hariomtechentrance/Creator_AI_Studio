"use client";

import Header from "@/components/layout/Header";
import { useEffect, useRef, useState } from "react";
import { Layers, Eraser, Paintbrush, Sparkles, Download, Upload, Undo2, Redo2, ZoomIn, ZoomOut, Move, Square, Circle, Type } from "lucide-react";

const TOOLS = [
  { id: "select", icon: Move, label: "Select" },
  { id: "brush", icon: Paintbrush, label: "Brush" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
];

const INPAINT_MODELS = ["Stable Diffusion XL", "Flux Fill", "Adobe Firefly Style", "ControlNet"];

export default function CanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState("select");
  const [brushSize, setBrushSize] = useState(20);
  const [prompt, setPrompt] = useState("");
  const [inpaintModel, setInpaintModel] = useState("Stable Diffusion XL");
  const [mode, setMode] = useState<"inpaint" | "outpaint" | "generate">("inpaint");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw grid
    ctx.strokeStyle = "rgba(124,58,237,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Center text
    ctx.fillStyle = "rgba(124,58,237,0.15)";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Drop an image or use Generate to start", canvas.width / 2, canvas.height / 2);
  }, []);

  return (
    <div>
      <Header title="Real-Time Canvas" />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left toolbar */}
        <div
          className="w-16 shrink-0 flex flex-col items-center py-4 gap-2"
          style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}
        >
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              title={label}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: tool === id ? "rgba(124,58,237,0.2)" : "transparent",
                color: tool === id ? "#a78bfa" : "var(--text-muted)",
                border: tool === id ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
              }}
            >
              <Icon size={16} />
            </button>
          ))}

          <div className="flex-1" />

          {[Undo2, Redo2, ZoomIn, ZoomOut].map((Icon, i) => (
            <button key={i} className="btn-ghost w-10 h-10 p-0 flex items-center justify-center rounded-xl">
              <Icon size={16} />
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center" style={{ background: "#0d0d14" }}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={900}
              height={600}
              className="rounded-2xl"
              style={{ border: "1px solid var(--border)", cursor: tool === "select" ? "default" : "crosshair" }}
            />
            {/* Upload overlay button */}
            <label
              className="absolute top-4 left-1/2 -translate-x-1/2 btn-secondary px-4 py-2 text-xs cursor-pointer"
            >
              <Upload size={12} /> Upload Image
              <input type="file" accept="image/*" className="hidden" />
            </label>
          </div>
        </div>

        {/* Right panel — AI tools */}
        <div
          className="w-72 shrink-0 overflow-y-auto p-4 space-y-4"
          style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-secondary)" }}
        >
          {/* Mode */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Mode</label>
            <div className="grid grid-cols-3 gap-1">
              {(["inpaint", "outpaint", "generate"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="py-2 rounded-lg text-xs font-semibold capitalize border transition-all"
                  style={{
                    background: mode === m ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                    borderColor: mode === m ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: mode === m ? "#a78bfa" : "var(--text-muted)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>AI Model</label>
            {INPAINT_MODELS.map((m) => (
              <button
                key={m}
                onClick={() => setInpaintModel(m)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm border mb-1 transition-all"
                style={{
                  background: inpaintModel === m ? "rgba(124,58,237,0.1)" : "transparent",
                  borderColor: inpaintModel === m ? "rgba(124,58,237,0.4)" : "var(--border)",
                  color: inpaintModel === m ? "#a78bfa" : "var(--text-secondary)",
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Brush size */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Brush Size</label>
              <span className="text-xs font-bold text-white">{brushSize}px</span>
            </div>
            <input type="range" min={5} max={100} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full accent-violet-500" />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>AI Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "inpaint" ? "Describe what to fill the masked area with…"
                : mode === "outpaint" ? "Describe the extended scene…"
                : "Describe what to generate…"
              }
              rows={4}
              className="input resize-none text-sm"
            />
          </div>

          <button
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }}
            disabled={!prompt.trim() || loading}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? <span className="spinner" /> : <><Sparkles size={14} /> Apply AI</>}
          </button>

          <button className="btn-secondary w-full justify-center">
            <Download size={14} /> Export Canvas
          </button>

          {/* Layer info */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              <Layers size={13} /> Layers
            </div>
            {["Background", "AI Layer 1", "Mask"].map((l, i) => (
              <div key={l} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--bg-hover)" }}>
                <div className="w-3 h-3 rounded-sm" style={{ background: ["#7c3aed", "#06b6d4", "rgba(255,255,255,0.3)"][i] }} />
                <span style={{ color: "var(--text-secondary)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
