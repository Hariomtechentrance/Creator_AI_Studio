export function isEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return !!key && !key.startsWith("your_");
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY as string;
  const from = process.env.RESEND_FROM_EMAIL ?? "notifications@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Email send failed");
  return data.id;
}
