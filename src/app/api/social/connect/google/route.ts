import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/social/google";
import { createOAuthState, OAUTH_NONCE_COOKIE } from "@/lib/social/oauthState";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.redirect(new URL("/social-accounts?error=missing_org", request.url));

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/social-accounts?error=google_not_configured", request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.redirect(new URL("/social-accounts?error=not_a_member", request.url));

  const { state, nonce } = createOAuthState(orgId);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/google`;
  const authUrl = getGoogleAuthUrl(redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_NONCE_COOKIE, nonce, { path: "/", maxAge: 600, httpOnly: true, sameSite: "lax" });
  return response;
}
