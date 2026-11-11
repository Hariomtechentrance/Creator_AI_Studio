"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@/types/database";

export default function TrackingSettingsSection({ org, canManage }: { org: Organization; canManage: boolean }) {
  const router = useRouter();
  const [gtmContainerId, setGtmContainerId] = useState(org.gtm_container_id ?? "");
  const [ga4MeasurementId, setGa4MeasurementId] = useState(org.ga4_measurement_id ?? "");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");
  const [metaPixelId, setMetaPixelId] = useState(org.meta_pixel_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/org/tracking-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          gtmContainerId,
          ga4MeasurementId,
          // Omitted entirely unless the user actually typed a new secret —
          // the real value is never fetched back into this field, so there's
          // nothing to resend untouched.
          ...(ga4ApiSecret.trim() ? { ga4ApiSecret } : {}),
          metaPixelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        return;
      }
      setGa4ApiSecret("");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-bold text-white text-lg">Tracking &amp; Conversions</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Connect Google Tag Manager, GA4, and Meta Pixel so your published landing pages report real traffic and conversions — and so leads from them feed back into Meta/GA4 as conversion signal for ad optimization.
        </p>
      </div>
      {!canManage ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Only the owner or an admin can change tracking settings.</p>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>GTM Container ID</label>
            <input className="input" placeholder="GTM-XXXXXXX" value={gtmContainerId} onChange={(e) => setGtmContainerId(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>GA4 Measurement ID</label>
            <input className="input" placeholder="G-XXXXXXXXXX" value={ga4MeasurementId} onChange={(e) => setGa4MeasurementId(e.target.value)} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Only loaded directly on your landing pages if no GTM Container ID is set above — otherwise fire it as a GA4 tag inside GTM, so pageviews aren&apos;t double-counted.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>GA4 API Secret</label>
            <input
              className="input"
              type="password"
              placeholder={org.ga4_api_secret ? "••••••••••••  (set — leave blank to keep it)" : "Measurement Protocol API secret"}
              value={ga4ApiSecret}
              onChange={(e) => setGa4ApiSecret(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>From GA4 Admin → Data Streams → your stream → Measurement Protocol API secrets. Lets leads report server-side as real conversions.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Meta Pixel ID</label>
            <input className="input" placeholder="123456789012345" value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Sends Lead events to Meta via your already-connected Meta Ads login — no separate access token needed.</p>
          </div>
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          {saved && !error && <p className="text-sm" style={{ color: "#34d399" }}>Saved.</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5">
            {saving ? <span className="spinner" /> : "Save Tracking Settings"}
          </button>
        </>
      )}
    </div>
  );
}
