import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchMetaCities } from "@/lib/ads/metaAds";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const query = request.nextUrl.searchParams.get("q");
  if (!orgId || !query || query.trim().length < 2) return Response.json({ cities: [] });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", orgId).eq("platform", "meta_ads").eq("is_active", true);
  const account = (accounts ?? [])[0];
  if (!account?.access_token) return Response.json({ error: "Connect Meta (Facebook) in Social Accounts first" }, { status: 400 });

  try {
    const cities = await searchMetaCities(account.access_token, query.trim());
    return Response.json({ cities });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Location search failed" }, { status: 500 });
  }
}
