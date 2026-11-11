import { createHash } from "crypto";

const GRAPH_VERSION = "v21.0";

function sha256Lower(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface LeadEventInput {
  pixelId: string;
  accessToken: string;
  email: string | null;
  phone: string | null;
  eventSourceUrl: string;
  clientIp?: string | null;
  userAgent?: string | null;
  eventId?: string;
}

/**
 * Server-side Meta Conversions API — reports a Lead event straight to Meta,
 * bypassing ad blockers and iOS tracking prevention that a client-side-only
 * Pixel would miss. Reuses the org's existing meta_ads access token (the
 * same one ads/launch already uses) rather than asking for a second Meta
 * credential just for this. user_data fields must be SHA-256 hashed per
 * Meta's spec — sent in plaintext, the call is rejected.
 */
export async function sendMetaLeadEvent(input: LeadEventInput): Promise<{ success: boolean; error?: string }> {
  const { pixelId, accessToken, email, phone, eventSourceUrl, clientIp, userAgent, eventId } = input;
  if (!pixelId || !accessToken) return { success: false, error: "Meta Pixel not configured" };

  const userData: Record<string, unknown> = {};
  if (email) userData.em = [sha256Lower(email)];
  if (phone) userData.ph = [sha256Lower(phone.replace(/[^\d]/g, ""))];
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: eventSourceUrl,
        event_id: eventId,
        user_data: userData,
      },
    ],
    access_token: accessToken,
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) return { success: false, error: data.error?.message ?? "Conversions API call failed" };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Conversions API call failed" };
  }
}
