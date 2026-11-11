import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: { accountId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { accountId } = body;
  if (!accountId) return Response.json({ error: "accountId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  // RLS already scopes this to orgs the user belongs to.
  const { data: account } = await supabase.from("social_accounts").select("id, org_id, platform").eq("id", accountId).single();
  if (!account) return Response.json({ error: "Account not found" }, { status: 404 });

  const { error: clearError } = await supabase
    .from("social_accounts")
    .update({ is_default: false })
    .eq("org_id", account.org_id)
    .eq("platform", account.platform);
  if (clearError) return Response.json({ error: clearError.message }, { status: 500 });

  const { error: setError } = await supabase.from("social_accounts").update({ is_default: true }).eq("id", accountId);
  if (setError) return Response.json({ error: setError.message }, { status: 500 });

  return Response.json({ success: true });
}
