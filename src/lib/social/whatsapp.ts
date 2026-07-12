const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function isWhatsAppWebhookConfigured(): boolean {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  return !!token && !token.startsWith("choose_") && !token.startsWith("your_");
}

/** Validates a phone-number-id/access-token pair by fetching its display info. */
export async function verifyWhatsAppNumber(phoneNumberId: string, accessToken: string): Promise<{ displayNumber: string; verifiedName: string }> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't verify that WhatsApp number");
  return { displayNumber: data.display_phone_number, verifiedName: data.verified_name };
}

export async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, message: string): Promise<string> {
  const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/[^\d]/g, ""),
      type: "text",
      text: { body: message },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "WhatsApp send failed");
  return data.messages?.[0]?.id ?? "sent";
}

export interface WhatsAppInboundMessage {
  phoneNumberId: string;
  fromNumber: string;
  fromName: string | null;
  text: string;
  externalMessageId: string;
}

/** Parses the (fairly deeply nested) webhook payload shape into the one inbound text message it carries, or null for non-message events (delivery receipts, etc). */
export function parseWhatsAppWebhook(payload: unknown): WhatsAppInboundMessage | null {
  try {
    const entry = (payload as { entry: unknown[] }).entry?.[0] as Record<string, unknown>;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>;
    const value = change?.value as Record<string, unknown>;
    const metadata = value?.metadata as { phone_number_id: string };
    const messages = value?.messages as Array<Record<string, unknown>> | undefined;
    const contacts = value?.contacts as Array<{ profile?: { name?: string }; wa_id: string }> | undefined;

    const message = messages?.[0];
    if (!message || message.type !== "text") return null;

    const text = (message.text as { body?: string })?.body;
    if (!text) return null;

    return {
      phoneNumberId: metadata.phone_number_id,
      fromNumber: message.from as string,
      fromName: contacts?.[0]?.profile?.name ?? null,
      text,
      externalMessageId: message.id as string,
    };
  } catch {
    return null;
  }
}
