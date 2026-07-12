"use client";

import Header from "@/components/layout/Header";
import { useState } from "react";
import { Brain, Upload, Plus, X, CheckCircle, AlertCircle, Info, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadTrainingImages } from "@/lib/supabase/storage";
import type { TrainedModel } from "@/types/database";

const TEMP_MODEL_ID = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const TRAINING_TYPES = [
  { id: "style", label: "Style", desc: "Train on a visual style or aesthetic" },
  { id: "character", label: "Character / Face", desc: "Train on a specific person or character" },
  { id: "object", label: "Object / Product", desc: "Train on a specific object or product" },
  { id: "concept", label: "Custom Concept", desc: "Train on any custom concept or idea" },
];

export default function ModelTrainingView({ initialModels, userId }: { initialModels: TrainedModel[]; userId: string | null }) {
  const [models, setModels] = useState(initialModels);
  const [step, setStep] = useState<"list" | "create">("list");
  const [trainingType, setTrainingType] = useState("character");
  const [modelName, setModelName] = useState("");
  const [triggerWord, setTriggerWord] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const statusIcon = (status: string) => {
    if (status === "ready") return <CheckCircle size={14} className="text-emerald-400" />;
    if (status === "training") return <span className="spinner w-4 h-4" />;
    return <AlertCircle size={14} className="text-red-400" />;
  };

  const addFiles = (list: File[]) => {
    const next = list.slice(0, 20 - files.length);
    setFiles((prev) => [...prev, ...next]);
    next.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== i));
    setPreviews((prev) => prev.filter((_, j) => j !== i));
  };

  const handleStartTraining = async () => {
    if (!modelName.trim() || !triggerWord.trim() || files.length < 10 || !userId) return;
    setStarting(true);
    setError("");
    try {
      const supabase = createClient();
      const tempModelId = TEMP_MODEL_ID();
      const { paths, error: uploadError } = await uploadTrainingImages(supabase, userId, tempModelId, files);
      if (uploadError) {
        setError(uploadError);
        return;
      }

      const res = await fetch("/api/train-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, triggerWord, description: trainingType, imagePaths: paths }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start training");
        return;
      }

      setModels((prev) => [data.model, ...prev]);
      setStep("list");
      setModelName("");
      setTriggerWord("");
      setFiles([]);
      setPreviews([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setStarting(false);
    }
  };

  const handleCheckStatus = async (modelId: string) => {
    setCheckingId(modelId);
    try {
      const res = await fetch("/api/train-model/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      const data = await res.json();
      if (res.ok && data.status) {
        setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, status: data.status } : m)));
      }
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div>
      <Header title="Custom Model Training" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(99,102,241,0.08))", border: "1px solid rgba(124,58,237,0.3)" }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)" }}>
              <Brain size={22} style={{ color: "#a78bfa" }} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-white text-lg mb-1">Train Your Own AI Model</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Upload 10–20 images and train a custom LoRA model in ~20 minutes. Use it in Image Generation with your trigger word to create consistent characters, styles, or objects.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-white">500</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>credits</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setStep("list")} className={step === "list" ? "btn-primary px-5" : "btn-secondary px-5"}>My Models</button>
          <button onClick={() => setStep("create")} className={step === "create" ? "btn-primary px-5" : "btn-secondary px-5"}>
            <Plus size={14} /> Train New Model
          </button>
        </div>

        {step === "list" ? (
          <div className="space-y-3">
            {models.map((m) => (
              <div key={m.id} className="card flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <Brain size={20} style={{ color: "#a78bfa" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{m.name}</p>
                    {statusIcon(m.status)}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Trigger: <code className="font-mono text-violet-400">{m.trigger_word}</code> · {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                {m.status === "ready" && (
                  <button className="btn-primary px-4 py-2 text-xs">Use in Generation</button>
                )}
                {m.status === "training" && (
                  <button
                    onClick={() => handleCheckStatus(m.id)}
                    disabled={checkingId === m.id}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  >
                    {checkingId === m.id ? <span className="spinner w-3 h-3" /> : <RefreshCw size={12} />} Check status
                  </button>
                )}
              </div>
            ))}
            {models.length === 0 && (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <Brain size={48} className="opacity-20 mx-auto mb-3" />
                <p>No models trained yet. Click &ldquo;Train New Model&rdquo; to start.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Training Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRAINING_TYPES.map((t) => (
                    <button key={t.id} onClick={() => setTrainingType(t.id)}
                      className="p-3 rounded-xl border text-left transition-all"
                      style={{
                        background: trainingType === t.id ? "rgba(124,58,237,0.12)" : "var(--bg-card)",
                        borderColor: trainingType === t.id ? "rgba(124,58,237,0.5)" : "var(--border)",
                      }}
                    >
                      <p className="text-sm font-bold text-white">{t.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Model Name</label>
                <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="My Custom Model" className="input" />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Trigger Word</label>
                <input value={triggerWord} onChange={(e) => setTriggerWord(e.target.value.toUpperCase())} placeholder="MYMODEL" className="input font-mono" />
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Use this word in prompts to activate your model</p>
              </div>

              {error && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>
              )}

              <button
                onClick={handleStartTraining}
                disabled={starting || !modelName.trim() || !triggerWord.trim() || files.length < 10}
                className="btn-primary w-full justify-center py-3"
              >
                {starting ? <span className="spinner" /> : `Start Training (500 credits)`}
              </button>
              <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Info size={12} className="shrink-0 mt-0.5" />
                Uploads to Supabase Storage, zips them, and starts a real Replicate LoRA training run — needs REPLICATE_API_TOKEN + REPLICATE_USERNAME configured.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Training Images ({files.length}/20)
              </label>
              <label
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <Upload size={28} />
                <div className="text-center">
                  <p className="font-semibold text-sm">Upload 10–20 images</p>
                  <p className="text-xs">Clear, consistent photos of your subject</p>
                </div>
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files || []))}
                />
              </label>
              <div className="grid grid-cols-4 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ background: "rgba(0,0,0,0.7)" }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
