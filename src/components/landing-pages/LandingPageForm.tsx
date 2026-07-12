"use client";

import { useState } from "react";

export default function LandingPageForm({ slug, pageId, variant, ctaText }: { slug: string; pageId: string; variant: "a" | "b"; ctaText: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/public/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, email, phone, pageId, variant }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong");
        return;
      }
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
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full px-3 py-2.5 rounded-lg text-sm"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {status === "error" && <p className="text-sm" style={{ color: "#f87171" }}>{message}</p>}
      <button
        type="submit"
        disabled={status === "loading" || (!email.trim() && !phone.trim())}
        className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
      >
        {status === "loading" ? "Submitting…" : ctaText}
      </button>
    </form>
  );
}
