"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CreateOrgGate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("create_organization_with_owner", { p_name: name.trim() });
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-primary)" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 50% at 50% 0%, rgba(124,58,237,0.15), transparent)" }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 0 40px rgba(124,58,237,0.4)" }}
          >
            <Sparkles size={22} />
          </div>
          <h1 className="text-2xl font-black text-white">Name your business</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            You&apos;ll be the owner — you can invite your team next
          </p>
        </div>

        <div className="card space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Business name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Marketing Co."
                required
                minLength={2}
                className="input"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full justify-center py-3">
              {loading ? <span className="spinner" /> : "Create business"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
