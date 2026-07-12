import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeLinkedInCode, getLinkedInProfile } from "@/lib/social/linkedin";
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
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/linkedin`;
    const accessToken = await exchangeLinkedInCode(code, redirectUri);
    const profile = await getLinkedInProfile(accessToken);

    const admin = createAdminClient();
    await admin.from("social_accounts").upsert(
      {
        org_id: state.orgId,
        platform: "linkedin",
        account_id: profile.sub,
        account_name: profile.name,
        account_username: null,
        account_avatar: null,
        account_type: "member",
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: null,
        scopes: ["w_member_social"],
        is_active: true,
        last_synced_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0,
        post_count: 0,
      },
      { onConflict: "org_id,platform,account_id" },
    );

    const response = NextResponse.redirect(new URL("/social-accounts?connected=linkedin", request.url));
    response.cookies.delete(OAUTH_NONCE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection_failed";
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(message)}`, request.url));
  }
}
