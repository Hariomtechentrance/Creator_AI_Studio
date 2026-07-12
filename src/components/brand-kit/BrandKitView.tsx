"use client";

import { useRef, useState } from "react";
import Header from "@/components/layout/Header";
import { Palette, Type, Image as ImageIcon, ShieldCheck, ShieldX, Plus, X, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateBrandKit } from "@/lib/supabase/brand";
import { updateOrgLogo } from "@/lib/supabase/organizations";
import { uploadBrandLogo } from "@/lib/supabase/storage";
import type { Organization, BrandProfile } from "@/types/database";

function TagEditor({ label, icon, tags, onChange, placeholder }: { label: string; icon: React.ReactNode; tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) { setInput(""); return; }
    onChange([...tags, v]);
    setInput("");
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>{icon} {label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}>
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-white"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button onClick={add} disabled={!input.trim()} className="btn-secondary px-3"><Plus size={13} /></button>
      </div>
    </div>
  );
}

export default function BrandKitView({ org, brandProfile }: { org: Organization | null; brandProfile: BrandProfile | null }) {
  const [colors, setColors] = useState<string[]>(brandProfile?.brand_colors ?? []);
  const [fonts, setFonts] = useState<string[]>(brandProfile?.brand_fonts ?? []);
  const [keywords, setKeywords] = useState<string[]>(brandProfile?.approved_keywords ?? []);
  const [banned, setBanned] = useState<string[]>(brandProfile?.banned_words ?? []);
  const [newColor, setNewColor] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState(org?.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!org || !brandProfile) {
    return (
      <div>
        <Header title="Brand Kit" />
        <div className="p-6 max-w-2xl mx-auto text-center py-16">
          <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Complete Brand Intelligence onboarding first to set up your brand kit.</p>
        </div>
      </div>
    );
  }

  const handleLogoFile = async (file: File) => {
    setUploadingLogo(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const { url, error } = await uploadBrandLogo(supabase, org.id, file);
      if (error || !url) {
        setUploadError(error ?? "Upload failed");
        return;
      }
      setLogoUrl(url);
      await updateOrgLogo(supabase, org.id, url);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const supabase = createClient();
      await Promise.all([
        updateBrandKit(supabase, org.id, { brand_colors: colors, brand_fonts: fonts, approved_keywords: keywords, banned_words: banned }),
        updateOrgLogo(supabase, org.id, logoUrl.trim() || null),
      ]);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Header title="Brand Kit" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Palette size={16} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Colors, fonts, and word rules here feed every AI generator in this app (Content Studio, Landing Pages, Chatbot) so your brand stays consistent.
          </p>
        </div>

        {/* Logo */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><ImageIcon size={13} /> Logo</p>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover" style={{ border: "1px solid var(--border)" }} />
            ) : (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border)" }}>
                <ImageIcon size={18} style={{ color: "var(--text-muted)" }} />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }}
                />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
                  {uploadingLogo ? <span className="spinner w-3 h-3" /> : <Upload size={12} />} Upload
                </button>
                <input className="input flex-1 text-xs" placeholder="or paste a hosted image URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
              {uploadError && <p className="text-[11px]" style={{ color: "#f87171" }}>{uploadError}</p>}
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Palette size={13} /> Brand Colors</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <div key={c} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <span className="w-6 h-6 rounded-md" style={{ background: c, border: "1px solid rgba(255,255,255,0.15)" }} />
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{c}</span>
                <button onClick={() => setColors(colors.filter((x) => x !== c))} className="hover:text-white" style={{ color: "var(--text-muted)" }}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer" style={{ border: "1px solid var(--border)" }} />
            <button onClick={() => { if (!colors.includes(newColor)) setColors([...colors, newColor]); }} className="btn-secondary px-3 py-1.5 text-xs">Add color</button>
          </div>
        </div>

        {/* Fonts */}
        <TagEditor label="Fonts" icon={<Type size={13} />} tags={fonts} onChange={setFonts} placeholder="e.g. Poppins" />

        {/* Approved keywords */}
        <TagEditor label="Approved Keywords" icon={<ShieldCheck size={13} />} tags={keywords} onChange={setKeywords} placeholder="Words the AI should favor" />

        {/* Banned words */}
        <TagEditor label="Banned Words" icon={<ShieldX size={13} />} tags={banned} onChange={setBanned} placeholder="Words the AI must never use" />

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3">
          {saving ? <span className="spinner" /> : saved ? "Saved ✓" : "Save Brand Kit"}
        </button>
      </div>
    </div>
  );
}
