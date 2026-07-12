import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/supabase/activeOrg";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Not available yet" }, { status: 400 });
  }

  let body: { orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId } = body;
  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  // Confirm the caller actually belongs to this org before switching —
  // RLS on `organizations` (owner/member select policy) is the real gate.
  const { data: org, error } = await supabase.from("organizations").select("id").eq("id", orgId).single();
  if (error || !org) {
    return Response.json({ error: "You don't have access to that organization" }, { status: 403 });
  }

  const response = Response.json({ success: true });
  response.headers.append(
    "Set-Cookie",
    `${ACTIVE_ORG_COOKIE}=${orgId}; Path=/; Max-Age=31536000; SameSite=Lax`,
  );
  return response;
}
