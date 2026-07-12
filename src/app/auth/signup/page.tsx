"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Zap, Check, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PERKS = ["150 free credits daily", "6 AI tools included", "No credit card required"];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const handle = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (!data.session) {
        // Email confirmation required before a session exists
        setConfirmEmailSent(true);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setGoogleLoading(false);
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
          <h1 className="text-2xl font-black text-white">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Start creating with AI — completely free</p>
        </div>

        {/* Perks */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {PERKS.map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
              <Check size={11} /> {p}
            </span>
          ))}
        </div>

        {confirmEmailSent ? (
          <div className="card text-center space-y-3 py-8">
            <MailCheck size={36} className="mx-auto" style={{ color: "#34d399" }} />
            <h2 className="text-lg font-bold text-white">Check your email</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              We sent a confirmation link to <span className="text-white">{form.email}</span>. Click it to activate your account.
            </p>
          </div>
        ) : (
        <div className="card space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="btn-secondary w-full justify-center py-3 gap-3"
          >
            {googleLoading ? (
              <span className="spinner" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            {[
              { key: "name", label: "Full Name", type: "text", placeholder: "John Doe" },
              { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input type={type} value={form[key as keyof typeof form]} onChange={handle(key as keyof typeof form)} placeholder={placeholder} required className="input" />
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Password</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={form.password} onChange={handle("password")} placeholder="Min. 8 characters" required minLength={8} className="input pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <span className="spinner" /> : <><Zap size={15} /> Create Free Account</>}
            </button>
          </form>

          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            By signing up, you agree to our{" "}
            <Link href="/terms" className="underline" style={{ color: "var(--text-secondary)" }}>Terms</Link>
            {" & "}
            <Link href="/privacy" className="underline" style={{ color: "var(--text-secondary)" }}>Privacy Policy</Link>
          </p>
        </div>
        )}

        <p className="text-center text-sm mt-5" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: "#a78bfa" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
