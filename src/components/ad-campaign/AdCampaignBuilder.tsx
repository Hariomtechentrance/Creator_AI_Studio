"use client";

import { useState, useRef } from "react";
import Header from "@/components/layout/Header";
import {
  Megaphone, Eye, MousePointerClick, MessageCircle, Mail, ShoppingCart,
  Wand2, RefreshCw, Check, X, MapPin, ImagePlus, Rocket, Sparkles,
} from "lucide-react";
import type { SocialAccount } from "@/types/database";
import { resizeImageFile } from "@/lib/image";
import type { AdCopyResult } from "@/lib/ai/adCopy";

type Step = "goal" | "describe" | "audience" | "creative" | "budget" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "goal", label: "Goal" },
  { key: "describe", label: "Ad Copy" },
  { key: "audience", label: "Audience" },
  { key: "creative", label: "Creative" },
  { key: "budget", label: "Budget" },
  { key: "review", label: "Review" },
];

const GOALS: { id: string; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "awareness", label: "Build Brand Awareness", desc: "Get more people in your area to know who you are", icon: <Eye size={20} /> },
  { id: "traffic", label: "Drive Website Visitors", desc: "Send people to your website or landing page", icon: <MousePointerClick size={20} /> },
  { id: "engagement", label: "Get Likes, Comments & Messages", desc: "Boost interaction with your posts and Page", icon: <MessageCircle size={20} /> },
  { id: "leads", label: "Collect Enquiries", desc: "Get people to reach out and ask about your product or service", icon: <Mail size={20} /> },
  { id: "sales", label: "Drive Sales", desc: "Get people to buy directly", icon: <ShoppingCart size={20} /> },
];

interface City { key: string; name: string; region: string | null; countryCode: string | null }

export default function AdCampaignBuilder({ orgId, connectedPlatforms }: { orgId: string | null; connectedPlatforms: SocialAccount["platform"][] }) {
  const [step, setStep] = useState<Step>("goal");
  const [error, setError] = useState("");

  // Step 1 — goal
  const [goal, setGoal] = useState("");

  // Step 2 — ad copy
  const [description, setDescription] = useState("");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [cta, setCta] = useState("Learn More");
  const [budgetHint, setBudgetHint] = useState("");

  // Step 3 — audience
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);
  const [selectedCities, setSelectedCities] = useState<City[]>([]);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [genders, setGenders] = useState<"all" | "male" | "female">("all");

  // Step 4 — creative
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [finalImageUrl, setFinalImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 5 — budget
  const [dailyBudget, setDailyBudget] = useState(500);

  // Step 6 — launch
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ note: string } | null>(null);

  const metaConnected = connectedPlatforms.includes("facebook") && connectedPlatforms.includes("meta_ads");

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const cardStyle = { background: "var(--bg-card)", border: "1px solid var(--border)" } as const;

  const generateAdCopy = async () => {
    if (!description.trim() || !orgId || !goal) return;
    setGeneratingCopy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/generate-ad-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, platform: "Meta Ads", goal, productDescription: description }),
      });
      const data: AdCopyResult & { error?: string } = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate ad copy"); return; }
      setHeadline(data.headlines[0] ?? "");
      setPrimaryText(data.primaryText);
      setCta(data.cta);
      setBudgetHint(data.budgetSuggestion);
      setStep("audience");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGeneratingCopy(false);
    }
  };

  const searchCities = async (q: string) => {
    setCitySearch(q);
    if (!orgId || q.trim().length < 2) { setCityResults([]); return; }
    setSearchingCities(true);
    try {
      const res = await fetch(`/api/ads/search-locations?orgId=${orgId}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCityResults(data.cities ?? []);
    } finally {
      setSearchingCities(false);
    }
  };

  const addCity = (city: City) => {
    if (!selectedCities.some((c) => c.key === city.key)) setSelectedCities((prev) => [...prev, city]);
    setCitySearch("");
    setCityResults([]);
  };
  const removeCity = (key: string) => setSelectedCities((prev) => prev.filter((c) => c.key !== key));

  const handleFileUpload = async (file: File | undefined) => {
    if (!file || !orgId) return;
    setUploadingImage(true);
    setError("");
    try {
      const resized = await resizeImageFile(file);
      setImageDataUrl(resized);
      const res = await fetch("/api/ads/upload-creative-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, imageDataUrl: resized }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't upload the image"); return; }
      setFinalImageUrl(data.imageUrl);
    } catch {
      setError("Couldn't read that image file");
    } finally {
      setUploadingImage(false);
    }
  };

  const generateCreativeImage = async () => {
    if (!imagePrompt.trim() || !orgId) return;
    setGeneratingImage(true);
    setError("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt.trim(), count: 1, width: 1080, height: 1080 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't generate an image"); return; }
      const url = data.images?.[0];
      if (url) { setImageDataUrl(url); setFinalImageUrl(url); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGeneratingImage(false);
    }
  };

  const launchCampaign = async () => {
    if (!orgId || !finalImageUrl || !destinationUrl.trim()) return;
    setLaunching(true);
    setError("");
    try {
      const res = await fetch("/api/ads/create-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          name: `${GOALS.find((g) => g.id === goal)?.label ?? goal} — ${description.slice(0, 40)}`,
          goal,
          dailyBudget,
          targeting: {
            cityKeys: selectedCities.map((c) => c.key),
            cityNames: selectedCities.map((c) => c.name),
            ageMin,
            ageMax,
            genders,
          },
          creative: { headline, primaryText, cta, imageUrl: finalImageUrl, destinationUrl: destinationUrl.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Couldn't launch the campaign"); return; }
      setLaunchResult({ note: data.note });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLaunching(false);
    }
  };

  if (!orgId) {
    return (
      <div>
        <Header title="Run an Ad Campaign" />
        <div className="p-6 max-w-2xl mx-auto"><p style={{ color: "var(--text-muted)" }}>Sign in to continue.</p></div>
      </div>
    );
  }

  if (!metaConnected) {
    return (
      <div>
        <Header title="Run an Ad Campaign" />
        <div className="p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl p-6 text-center space-y-3" style={cardStyle}>
            <Megaphone size={28} className="mx-auto text-violet-400" />
            <p className="text-sm font-bold text-white">Connect Meta first</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Running ads needs Facebook connected in Social Accounts (with ads permission). Go connect it, then come back here.
            </p>
            <a href="/social-accounts" className="inline-block btn-primary px-5 py-2.5">Go to Social Accounts</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Run an Ad Campaign" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">

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
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>
        )}

        {step === "goal" && (
          <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>What do you want this ad to do?</p>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all"
                  style={{
                    background: goal === g.id ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${goal === g.id ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <div className="shrink-0" style={{ color: goal === g.id ? "#c4b5fd" : "var(--text-muted)" }}>{g.icon}</div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: goal === g.id ? "#c4b5fd" : "white" }}>{g.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{g.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("describe")} disabled={!goal} className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
              Next
            </button>
          </div>
        )}

        {step === "describe" && (
          <div className="rounded-2xl p-5 space-y-3" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>What are you advertising?</p>
            <textarea className="input w-full resize-none text-sm" rows={4} placeholder="e.g. 'Our handmade leather bags, waterproof, lifetime warranty'" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("goal")} className="px-4 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>Back</button>
              <button onClick={generateAdCopy} disabled={!description.trim() || generatingCopy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                {generatingCopy ? (<><RefreshCw size={15} className="animate-spin" /> Writing ad copy…</>) : (<><Wand2 size={15} /> Generate Ad Copy</>)}
              </button>
            </div>
            {headline && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <input className="input w-full text-sm font-bold" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" />
                <textarea className="input w-full resize-none text-sm" rows={3} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} placeholder="Body text" />
                <input className="input w-full text-sm" value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Call to action, e.g. Shop Now" />
              </div>
            )}
          </div>
        )}

        {step === "audience" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Which cities should see this?</p>
              <div className="relative">
                <input className="input w-full text-sm" placeholder="Search a city, e.g. Mumbai" value={citySearch} onChange={(e) => searchCities(e.target.value)} />
                {searchingCities && <RefreshCw size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />}
                {cityResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    {cityResults.map((c) => (
                      <button key={c.key} onClick={() => addCity(c)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                        <MapPin size={12} /> {c.name}{c.region ? `, ${c.region}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedCities.map((c) => (
                  <span key={c.key} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>
                    {c.name} <button onClick={() => removeCity(c.key)}><X size={11} /></button>
                  </span>
                ))}
              </div>
              {!selectedCities.length && <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>No city picked yet — leaving this empty targets all of India.</p>}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Age range: {ageMin}–{ageMax}</p>
              <div className="flex items-center gap-3">
                <input type="range" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(Math.min(Number(e.target.value), ageMax))} className="flex-1" />
                <input type="range" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(Math.max(Number(e.target.value), ageMin))} className="flex-1" />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Gender</p>
              <div className="flex gap-2">
                {(["all", "male", "female"] as const).map((g) => (
                  <button key={g} onClick={() => setGenders(g)} className="px-4 py-2 rounded-lg text-xs font-semibold capitalize" style={{ background: genders === g ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${genders === g ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`, color: genders === g ? "#c4b5fd" : "var(--text-secondary)" }}>{g}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setStep("describe")} className="px-4 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>Back</button>
              <button onClick={() => setStep("creative")} className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>Next</button>
            </div>
          </div>
        )}

        {step === "creative" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ad image</p>
            {imageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="Ad creative" className="w-full max-h-72 object-cover rounded-xl" />
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage} className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                <ImagePlus size={14} /> {uploadingImage ? "Uploading…" : "Upload Your Photo"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
              <div className="flex gap-1.5">
                <input className="input flex-1 text-xs" placeholder="Describe an image to generate" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} />
                <button onClick={generateCreativeImage} disabled={!imagePrompt.trim() || generatingImage} className="px-3 rounded-xl" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)" }}>
                  {generatingImage ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} style={{ color: "#c4b5fd" }} />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Where should the ad link to?</p>
              <input className="input w-full text-sm" placeholder="https://www.yourwebsite.com" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setStep("audience")} className="px-4 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>Back</button>
              <button onClick={() => setStep("budget")} disabled={!finalImageUrl || !destinationUrl.trim()} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>Next</button>
            </div>
          </div>
        )}

        {step === "budget" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Daily budget (₹)</p>
            <input type="number" min={100} step={50} className="input w-full text-lg font-bold" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} />
            {budgetHint && <p className="text-xs" style={{ color: "var(--text-muted)" }}>💡 AI suggestion: {budgetHint}</p>}
            <p className="text-[11px] rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
              This creates the campaign PAUSED on Meta — no money is spent until you review it in Meta Ads Manager and switch it on yourself.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setStep("creative")} className="px-4 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>Back</button>
              <button onClick={() => setStep("review")} disabled={dailyBudget < 100} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>Next</button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="rounded-2xl p-5 space-y-4" style={cardStyle}>
            {!launchResult ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Review before launch</p>
                {imageDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageDataUrl} alt="" className="w-full max-h-56 object-cover rounded-xl" />
                )}
                <div className="text-sm space-y-1">
                  <p className="font-bold text-white">{headline}</p>
                  <p style={{ color: "var(--text-secondary)" }}>{primaryText}</p>
                  <p className="text-xs" style={{ color: "#c4b5fd" }}>{cta} → {destinationUrl}</p>
                </div>
                <div className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
                  <p>Goal: {GOALS.find((g) => g.id === goal)?.label}</p>
                  <p>Audience: {selectedCities.length ? selectedCities.map((c) => c.name).join(", ") : "All of India"}, ages {ageMin}-{ageMax}, {genders}</p>
                  <p>Daily budget: ₹{dailyBudget}</p>
                </div>
                <button onClick={launchCampaign} disabled={launching} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
                  {launching ? (<><RefreshCw size={15} className="animate-spin" /> Creating on Meta…</>) : (<><Rocket size={15} /> Create Campaign (Paused)</>)}
                </button>
              </>
            ) : (
              <div className="text-center space-y-2 py-4">
                <Check size={28} className="mx-auto" style={{ color: "#34d399" }} />
                <p className="text-sm font-bold" style={{ color: "#34d399" }}>Campaign created on Meta</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{launchResult.note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
