"use client";

import { useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/** Reads the GA4 client id from the _ga cookie (format GA1.1.XXXXXXXXXX.YYYYYYYYYY) so the server-side Lead event in /api/public/lead-capture stitches into the same GA4 session as this visitor's page view, instead of a disconnected random id. */
function readGa4ClientId(): string | null {
  const match = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
  return match ? match[1] : null;
}

export interface QualifyingField {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
}

export default function LandingPageForm({ slug, pageId, variant, ctaText, trackingEnabled, qualifyingFields = [] }: { slug: string; pageId: string; variant: "a" | "b"; ctaText: string; trackingEnabled?: boolean; qualifyingFields?: QualifyingField[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const allQualifyingAnswered = qualifyingFields.every((f) => (answers[f.key] ?? "").trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/public/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, phone, city, pageId, variant, ga4ClientId: trackingEnabled ? readGa4ClientId() : null, customFields: answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong");
        return;
      }
      // Client-side signal too (deduped against the server-side Conversions
      // API event by Meta/GA4 on timing+identity) — belt-and-suspenders,
      // since either side can get dropped by a blocker independently.
      window.fbq?.("track", "Lead");
      window.gtag?.("event", "generate_lead");
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Something went wrong — try again");
    }
  };

  if (status === "done") {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
        <p className="font-bold" style={{ color: "#34d399" }}>Thanks! We&apos;ll be in touch shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <input
        className="w-full px-3 py-2.5 rounded-lg text-sm"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full px-3 py-2.5 rounded-lg text-sm"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
        placeholder="Mobile number"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="w-full px-3 py-2.5 rounded-lg text-sm"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
        placeholder="City"
        autoComplete="address-level2"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      {qualifyingFields.map((f) =>
        f.type === "select" ? (
          <select
            key={f.key}
            className="w-full px-3 py-2.5 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: answers[f.key] ? "white" : "#71717a" }}
            value={answers[f.key] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))}
          >
            <option value="" disabled>{f.label}</option>
            {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            key={f.key}
            className="w-full px-3 py-2.5 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
            placeholder={f.label}
            value={answers[f.key] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))}
          />
        )
      )}
      {status === "error" && <p className="text-sm" style={{ color: "#f87171" }}>{message}</p>}
      <button
        type="submit"
        disabled={status === "loading" || !name.trim() || !phone.trim() || !city.trim() || !allQualifyingAnswered}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
      >
        {status === "loading" ? "Submitting…" : ctaText}
      </button>
    </form>
  );
}
