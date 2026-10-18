import { isHeyGenConfigured, listAvatars, listVoices } from "@/lib/ai/heygen";

export async function GET() {
  if (!isHeyGenConfigured()) {
    return Response.json({ configured: false, avatars: [], voices: [] });
  }

  try {
    const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);
    return Response.json({ configured: true, avatars, voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't load HeyGen avatars/voices";
    return Response.json({ error: message }, { status: 500 });
  }
}
