import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeGoogleCode } from "@/lib/social/google";
import { listGbpLocations } from "@/lib/social/googleBusinessProfile";
import { parseOAuthState, OAUTH_NONCE_COOKIE } from "@/lib/social/oauthState";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(errorParam)}`, request.url));
  if (!code || !stateParam) return NextResponse.redirect(new URL("/social-accounts?error=missing_code", request.url));

  const state = parseOAuthState(stateParam);
  const cookieNonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
  if (!state || !cookieNonce || state.nonce !== cookieNonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=invalid_state", request.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/gbp`;
    // Reuse the shared Google token exchange (same client id/secret as YouTube/Ads).
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const locations = await listGbpLocations(tokens.access_token);

    if (locations.length === 0) {
      return NextResponse.redirect(new URL("/social-accounts?error=gbp_no_locations", request.url));
    }

    const admin = createAdminClient();
    for (const loc of locations) {
      // account_id stores the full resource name (accounts/{a}/locations/{l}) so
      // later review/SEO calls can use it directly without re-deriving the parent account.
      await admin.from("social_accounts").upsert(
        {
          org_id: state.orgId,
          platform: "google_business",
          account_id: loc.resource,
          account_name: loc.title,
          account_username: null,
          account_avatar: null,
          account_type: "location",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: ["business.manage"],
          is_active: true,
          last_synced_at: new Date().toISOString(),
          follower_count: 0,
          following_count: 0,
          post_count: 0,
        },
        { onConflict: "org_id,platform,account_id" },
      );
    }

    const response = NextResponse.redirect(new URL("/social-accounts?connected=gbp", request.url));
    response.cookies.delete(OAUTH_NONCE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection_failed";
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(message)}`, request.url));
  }
}
