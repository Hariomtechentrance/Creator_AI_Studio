"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Header from "@/components/layout/Header";
import { Camera, Briefcase, ThumbsUp, PlaySquare, X as Twitter, Music2, Share2, CheckCircle2, Target, MessageCircle, X, MapPin } from "lucide-react";
import type { SocialAccount, SocialPlatform } from "@/types/database";
import GbpPanel from "./GbpPanel";

const PLATFORMS: { id: SocialPlatform; label: string; icon: React.ReactNode; color: string; connectVia: "meta" | "linkedin" | "google" | "whatsapp" | "gbp" | null }[] = [
  { id: "instagram", label: "Instagram", icon: <Camera size={20} />, color: "#e1306c", connectVia: "meta" },
  { id: "facebook", label: "Facebook", icon: <ThumbsUp size={20} />, color: "#1877f2", connectVia: "meta" },
  { id: "linkedin", label: "LinkedIn", icon: <Briefcase size={20} />, color: "#0077b5", connectVia: "linkedin" },
  { id: "whatsapp", label: "WhatsApp Business", icon: <MessageCircle size={20} />, color: "#25d366", connectVia: "whatsapp" },
  { id: "twitter", label: "X (Twitter)", icon: <Twitter size={20} />, color: "#1d9bf0", connectVia: null },
  { id: "youtube", label: "YouTube Shorts", icon: <PlaySquare size={20} />, color: "#ff0000", connectVia: "google" },
  { id: "tiktok", label: "TikTok", icon: <Music2 size={20} />, color: "#25f4ee", connectVia: null },
  { id: "google_ads", label: "Google Ads", icon: <Target size={20} />, color: "#4285f4", connectVia: "google" },
  { id: "google_business", label: "Google Business Profile", icon: <MapPin size={20} />, color: "#34a853", connectVia: "gbp" },
];

export default function SocialAccountsView({ orgId, initialAccounts, connected, error }: { orgId: string | null; initialAccounts: SocialAccount[]; connected: string | null; error: string | null }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      const res = await fetch("/api/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSetDefault = async (account: SocialAccount) => {
    setSettingDefault(account.id);
    try {
      const res = await fetch("/api/social/set-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });
      if (res.ok) {
        setAccounts((prev) => prev.map((a) => (a.platform === account.platform ? { ...a, is_default: a.id === account.id } : a)));
      }
    } finally {
      setSettingDefault(null);
    }
  };

  return (
    <div>
      <Header title="Social Accounts" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {connected && (
          <p className="text-sm rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
            <CheckCircle2 size={14} /> Connected {connected} — accounts below.
          </p>
        )}
        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            Connection failed: {error}
          </p>
        )}

        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Share2 size={16} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Meta, LinkedIn, Google, and WhatsApp connect for real here — needs API credentials in .env.local first. X/TikTok aren&apos;t wired (X&apos;s API is paid-tier only; TikTok is listed as future scope in the spec).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {PLATFORMS.map((p) => {
            const connectedAccounts = accounts.filter((a) => a.platform === p.id);
            return (
              <div key={p.id} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}20`, color: p.color }}>
                    {p.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.label}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {connectedAccounts.length > 0 ? `${connectedAccounts.length} connected` : "Not connected"}
                    </p>
                  </div>
                  {p.connectVia === "whatsapp" && orgId ? (
                    <button onClick={() => setWhatsappOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                      Connect
                    </button>
                  ) : p.connectVia && orgId ? (
                    <a href={`/api/social/connect/${p.connectVia}?orgId=${orgId}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                      Connect
                    </a>
                  ) : (
                    <button disabled className="px-3 py-1.5 rounded-lg text-xs font-semibold opacity-50 cursor-not-allowed" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                      {p.connectVia ? "Connect" : "Not available"}
                    </button>
                  )}
                </div>
                {connectedAccounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between mt-2 pl-13 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1.5">
                      {a.account_name || a.account_username}
                      {a.is_default && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                          DEFAULT
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {connectedAccounts.length > 1 && !a.is_default && (
                        <button onClick={() => handleSetDefault(a)} disabled={settingDefault === a.id} className="hover:text-violet-400">
                          {settingDefault === a.id ? "…" : "Set default"}
                        </button>
                      )}
                      <button onClick={() => handleDisconnect(a.id)} disabled={disconnecting === a.id} className="hover:text-red-400">
                        {disconnecting === a.id ? "…" : "Disconnect"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <GbpPanel accounts={accounts} />

      {orgId && (
        <WhatsAppConnectDialog
          orgId={orgId}
          open={whatsappOpen}
          onOpenChange={setWhatsappOpen}
          onConnected={(account) => setAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account])}
        />
      )}
    </div>
  );
}

function WhatsAppConnectDialog({ orgId, open, onOpenChange, onConnected }: { orgId: string; open: boolean; onOpenChange: (open: boolean) => void; onConnected: (account: SocialAccount) => void }) {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/social/connect/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, phoneNumberId, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't connect that number");
        return;
      }
      onConnected({
        id: `${orgId}-whatsapp-${phoneNumberId}`,
        org_id: orgId,
        platform: "whatsapp",
        account_id: phoneNumberId,
        account_name: data.verifiedName,
        account_username: data.displayNumber,
        account_avatar: null,
        account_type: "business",
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        is_default: true,
        last_synced_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0,
        post_count: 0,
        created_at: new Date().toISOString(),
      });
      onOpenChange(false);
      setPhoneNumberId("");
      setAccessToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-white">Connect WhatsApp Business</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg hover:bg-white/10"><X size={16} style={{ color: "var(--text-muted)" }} /></Dialog.Close>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            WhatsApp Business Cloud API doesn&apos;t have a one-click OAuth flow — generate a permanent access token via a System User in Meta Business Suite, then paste it and your Phone Number ID here.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input className="input w-full" placeholder="Phone Number ID" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} required />
            <input className="input w-full" placeholder="Access Token" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required />
            {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
              {saving ? <span className="spinner" /> : "Connect"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
