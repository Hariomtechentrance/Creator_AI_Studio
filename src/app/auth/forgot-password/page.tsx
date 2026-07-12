"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
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
            C
          </div>
          <h1 className="text-2xl font-black text-white">Reset your password</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            We&apos;ll email you a link to set a new one
          </p>
        </div>

        {sent ? (
          <div className="card text-center space-y-3 py-8">
            <MailCheck size={36} className="mx-auto" style={{ color: "#34d399" }} />
            <h2 className="text-lg font-bold text-white">Check your email</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
            </p>
          </div>
        ) : (
          <div className="card space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? <span className="spinner" /> : "Send reset link"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm mt-5" style={{ color: "var(--text-muted)" }}>
          Remembered it?{" "}
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "#a78bfa" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
