import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrement } from "@/lib/rateLimit";
export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) return NextResponse.json({ error: "missing_phone" }, { status: 400 });

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    const phoneOk = await checkAndIncrement(phone);
    const ipOk = await checkAndIncrement(ip);
    if (!phoneOk.ok || !ipOk.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const supabase = await createClient(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
