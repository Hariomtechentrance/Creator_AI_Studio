"use client";

import Header from "@/components/layout/Header";
import { useRef, useState } from "react";
import { Sparkles, Download, Heart, RotateCcw, Settings2, ChevronDown, AlertCircle, Wand2, Upload, X } from "lucide-react";
import { IMAGE_MODELS } from "@/lib/models";
import { useSessionStore } from "@/store/useSessionStore";

async function resizeImageFile(file: File, maxDim = 1536): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Invalid image"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

const MODELS = IMAGE_MODELS;

const RATIOS = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "16:9", w: 1344, h: 768 },
  { label: "9:16", w: 768, h: 1344 },
  { label: "4:3", w: 1152, h: 896 },
  { label: "3:4", w: 896, h: 1152 },
  { label: "3:2", w: 1216, h: 832 },
];

const STYLES = ["None", "Portrait", "Photorealistic", "Cinematic", "Anime", "Digital Art", "Oil Painting", "Watercolor", "Sketch", "3D Render", "Cyberpunk", "Fantasy", "Minimalist"];

const EXAMPLE_PROMPTS = [
  "A majestic snow leopard perched on a rocky mountain ledge at golden hour, ultra detailed, 8K",
  "Futuristic Tokyo street at night with glowing neon signs and rain reflections on wet asphalt",
  "An ancient library with floating books, magical glowing orbs, and shafts of dusty light",
  "Portrait of a Viking warrior woman with intricate braided hair, battle armor, fierce expression",
  "Underwater city with coral skyscrapers, bioluminescent fish and shimmering light rays",
  "A cozy autumn cabin in a dense pine forest, warm orange light glowing through the windows",
  "Cyberpunk samurai standing in a neon-lit alley, katana drawn, rain falling, photorealistic",
  "Ethereal fairy tale castle floating on clouds at sunset, golden and purple hues",
  "Macro photograph of a dewdrop on a spider web at dawn, bokeh background, ultra detailed",
  "Steampunk airship fleet sailing over Victorian London, dramatic storm clouds",
  "Abstract ocean waves made of liquid gold and molten sapphire, swirling pattern",
  "A lone astronaut planting a flag on a red alien planet with twin moons and a ringed gas giant",
  "Art nouveau portrait of a forest goddess, flowers and vines growing from her hair",
  "Dragon made of shimmering northern lights flying over a frozen tundra, epic scale",
  "Hyperrealistic cup of espresso with intricate latte art, morning light, shallow depth of field",
  "Medieval fantasy marketplace with elves, dwarves, and colorful stalls, vibrant and detailed",
  "Extreme closeup of a human eye with a spiral galaxy reflected in the iris, surreal",
  "Zen Japanese garden at dawn, cherry blossom petals falling on a perfectly still koi pond",
  "Biomechanical deep-sea creature with glowing organs emerging from the abyss, horror concept art",
  "Renaissance oil painting of a robot philosopher in a golden robe holding a glowing orb",
  "Storm chaser POV inside a massive F5 tornado over the Great Plains, dramatic lighting",
  "Magical treehouse village in an ancient redwood forest, fairy lights, twilight atmosphere",
  "Neon-soaked desert highway at midnight, vintage red convertible, stars and Milky Way overhead",
  "Crystal cave filled with giant amethyst formations and soft purple and violet light",
  "Bengal tiger emerging from dark fog at night, intense amber eyes, ultra realistic",
  "A phoenix rising from golden flames, feathers of fire and light, epic fantasy art",
  "Solarpunk city rooftops covered in lush gardens, solar panels, and bright murals",
  "Portrait of an old sea captain weathered by decades at sea, dramatic chiaroscuro lighting",
];

export default function ImageGenerationPage() {
  const profile = useSessionStore((s) => s.profile);
  const adjustCredits = useSessionStore((s) => s.adjustCredits);
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("");
  const [model, setModel] = useState("flux-dev");
  const [ratio, setRatio] = useState("1:1");
  const [style, setStyle] = useState("None");
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [steps, setSteps] = useState(30);
  const [guidance, setGuidance] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | "all" | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refImageName, setRefImageName] = useState("");
  const [strength, setStrength] = useState(0.75);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = MODELS.find((m) => m.id === model)!;

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please upload an image file"); return; }
    try {
      const resized = await resizeImageFile(file);
      setRefImage(resized);
      setRefImageName(file.name);
      setError(null);
    } catch {
      setError("Couldn't read that image file");
    }
  };

  const clearRefImage = () => {
    setRefImage(null);
    setRefImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setImages([]);
    setError(null);
    setProvider(null);

    const selectedRatio = RATIOS.find((r) => r.label === ratio)!;

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negPrompt,
          model,
          width: selectedRatio.w,
          height: selectedRatio.h,
          count,
          steps,
          guidance,
          style,
          ...(refImage ? { image: refImage, strength } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }

      setImages(data.images ?? []);
      setProvider(data.provider ?? null);
      if (data.creditsUsed) adjustCredits(-data.creditsUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string, index: number) => {
    setDownloading(index);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `creatorai-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    setDownloading("all");
    for (let i = 0; i < images.length; i++) {
      const res = await fetch(images[i]);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `creatorai-${Date.now()}-${i + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      if (i < images.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setDownloading(null);
  };

  return (
    <div>
      <Header title="AI Image Generation" />
      <div className="flex h-[calc(100vh-57px)]">

        {/* Left panel — controls */}
        <div
          className="w-80 shrink-0 overflow-y-auto p-4 space-y-4"
          style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}
        >
          {/* Reference image upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
              Reference Image <span className="normal-case font-normal" style={{ color: "var(--text-muted)" }}>— optional, edit a photo</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />

            {refImage ? (
              <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refImage} alt="Reference" className="w-full h-32 object-cover" />
                <button
                  onClick={clearRefImage}
                  className="absolute top-2 right-2 p-1.5 rounded-lg"
                  style={{ background: "rgba(0,0,0,0.7)" }}
                  title="Remove reference image"
                >
                  <X size={13} className="text-white" />
                </button>
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 truncate text-[10px]" style={{ background: "rgba(0,0,0,0.7)", color: "var(--text-muted)" }}>
                  {refImageName}
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files?.[0] ?? null); }}
                className="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-1.5 transition-colors"
                style={{
                  borderColor: dragOver ? "rgba(124,58,237,0.6)" : "var(--border)",
                  background: dragOver ? "rgba(124,58,237,0.08)" : "var(--bg-card)",
                }}
              >
                <Upload size={16} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Click or drag an image here</span>
              </button>
            )}

            {refImage && (
              <div className="mt-3">
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Prompt Influence</label>
                  <span className="text-xs font-bold text-white">{Math.round(strength * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={strength}
                  onChange={(e) => setStrength(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Lower = stay closer to your photo. Higher = follow the prompt more.
                </p>
              </div>
            )}
          </div>

          {/* Model selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Model</label>
            <div className="space-y-1.5">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className="w-full text-left p-3 rounded-xl border transition-all"
                  style={{
                    background: model === m.id ? "rgba(124,58,237,0.12)" : "var(--bg-card)",
                    borderColor: model === m.id ? "rgba(124,58,237,0.5)" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-white">{m.name}</span>
                    <span className="badge badge-purple text-xs">{m.badge}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{m.desc}</span>
                    <span className="text-xs font-medium" style={{ color: "#f59e0b" }}>{m.cost}cr</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-1.5">
              {RATIOS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRatio(r.label)}
                  className="py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    background: ratio === r.label ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                    borderColor: ratio === r.label ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: ratio === r.label ? "#a78bfa" : "var(--text-secondary)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Style Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className="px-2.5 py-1 rounded-lg text-xs border transition-all"
                  style={{
                    background: style === s ? "rgba(124,58,237,0.15)" : "transparent",
                    borderColor: style === s ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: style === s ? "#a78bfa" : "var(--text-muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
              Images to generate: <span style={{ color: "white" }}>{count}</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold border transition-all"
                  style={{
                    background: count === n ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                    borderColor: count === n ? "rgba(124,58,237,0.5)" : "var(--border)",
                    color: count === n ? "#a78bfa" : "var(--text-secondary)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-2 text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="flex items-center gap-2"><Settings2 size={14} /> Advanced Settings</span>
            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced && (
            <div className="space-y-4">
              {[
                { label: "Steps", value: steps, set: setSteps, min: 1, max: 50 },
                { label: "Guidance Scale", value: guidance, set: setGuidance, min: 1, max: 20 },
              ].map(({ label, value, set, min, max }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</label>
                    <span className="text-xs font-bold text-white">{value}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Cost info */}
          <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Cost per generation</span>
              <span style={{ color: "#fbbf24" }} className="font-bold">{selectedModel.cost * count} credits</span>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: "var(--text-muted)" }}>Your balance</span>
              <span className="font-bold text-white">{profile ? `${profile.credits} credits` : "—"}</span>
            </div>
          </div>
        </div>

        {/* Right panel — prompt + output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Prompt area */}
          <div className="p-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                placeholder={refImage
                  ? "Describe the edit… e.g. 'add a red baseball cap and sunglasses'"
                  : "Describe what you want to create… e.g. 'A majestic lion at sunset, golden hour, cinematic photography, 8K, hyperrealistic'"}
                rows={3}
                className="input resize-none pr-28"
                style={{ fontSize: 15 }}
              />
              <button
                onClick={generate}
                disabled={!prompt.trim() || loading}
                className="btn-primary absolute right-2 bottom-2 px-4 py-2 text-sm"
              >
                {loading ? <span className="spinner w-4 h-4" /> : <><Sparkles size={14} /> {refImage ? "Edit" : "Generate"}</>}
              </button>
            </div>
            <input
              value={negPrompt}
              onChange={(e) => setNegPrompt(e.target.value)}
              placeholder="Negative prompt — things to avoid (e.g. blur, ugly, watermark)"
              className="input text-sm"
            />
            {/* Example prompts */}
            <div>
              <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Wand2 size={11} /> Prompt ideas — click to use
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(p)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-all whitespace-nowrap"
                    style={{
                      background: prompt === p ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                      borderColor: prompt === p ? "rgba(124,58,237,0.5)" : "var(--border)",
                      color: prompt === p ? "#a78bfa" : "var(--text-muted)",
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={p}
                  >
                    {p.length > 48 ? p.slice(0, 48) + "…" : p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="flex items-center gap-3 mb-4 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-white">Generating {count} image{count > 1 ? "s" : ""}…</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Using {selectedModel.name}</p>
                </div>
              </div>
            ) : images.length > 0 ? (
              <div>
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-white">{images.length} image{images.length > 1 ? "s" : ""} generated</p>
                    {provider && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                        via {provider}
                      </span>
                    )}
                  </div>
                  {images.length > 1 && (
                    <button
                      onClick={downloadAll}
                      disabled={downloading !== null}
                      className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg"
                    >
                      {downloading === "all" ? (
                        <span className="spinner w-3 h-3" />
                      ) : (
                        <Download size={13} />
                      )}
                      Download All
                    </button>
                  )}
                </div>

                <div className={`grid gap-4 ${images.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
                  {images.map((src, i) => (
                    <div key={i} className="group relative rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Generation ${i + 1}`} className="w-full aspect-square object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={() => downloadImage(src, i)}
                          disabled={downloading !== null}
                          className="btn-primary p-2.5 rounded-xl"
                          title="Download"
                        >
                          {downloading === i ? <span className="spinner w-4 h-4" /> : <Download size={16} />}
                        </button>
                        <button className="btn-secondary p-2.5 rounded-xl" title="Save to favorites"><Heart size={16} /></button>
                        <button
                          onClick={() => setPrompt(prompt + " (variation)")}
                          className="btn-secondary p-2.5 rounded-xl"
                          title="Use prompt again"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(0,0,0,0.7)", color: "var(--text-muted)" }}>
                          #{i + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "var(--text-muted)" }}>
                <Sparkles size={56} className="opacity-20" />
                <div className="text-center">
                  <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Your images appear here</p>
                  <p className="text-sm mt-1">Pick a prompt idea above or write your own, then click Generate</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
