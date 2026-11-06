/**
 * GA4 Measurement Protocol — sends a server-side event straight to GA4,
 * same rationale as the Meta Conversions API sibling in metaConversions.ts
 * (reliable even when the client-side gtag.js call is blocked or dropped).
 * clientId should be the visitor's _ga cookie value when available, so the
 * server event stitches into the same GA4 session as their page views; a
 * random id is an acceptable fallback (GA4 only requires it be a stable-ish
 * opaque string), but it won't connect to that visitor's other events.
 */
export async function sendGa4Event(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  eventName: string,
  params: Record<string, unknown> = {},
): Promise<{ success: boolean; error?: string }> {
  if (!measurementId || !apiSecret) return { success: false, error: "GA4 not configured" };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        body: JSON.stringify({ client_id: clientId, events: [{ name: eventName, params }] }),
      },
    );
    // GA4's Measurement Protocol returns 204 with no body on success and
    // doesn't validate most payload errors synchronously — a non-2xx here
    // means the request itself was malformed (bad measurement_id/secret).
    if (!res.ok) return { success: false, error: `GA4 collect failed (${res.status})` };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "GA4 collect failed" };
  }
}

export function randomGa4ClientId(): string {
  return `${Math.floor(Math.random() * 1e10)}.${Math.floor(Date.now() / 1000)}`;
}
