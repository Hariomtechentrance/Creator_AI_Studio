import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { phone, token } = await request.json();
    if (!phone || !token) return NextResponse.json({ error: "missing_params" }, { status: 400 });

    const supabase = await createClient(true);
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      return NextResponse.json({ error: "no_session" }, { status: 400 });
    }

    // Set server session cookies via existing API
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
    });

    if (!res.ok) return NextResponse.json({ error: "failed_set_session" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
