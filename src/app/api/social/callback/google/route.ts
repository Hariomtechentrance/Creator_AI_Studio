import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeGoogleCode, getYoutubeChannel } from "@/lib/social/google";
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
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/google`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const channel = await getYoutubeChannel(tokens.access_token);

    const admin = createAdminClient();

    // Always store a "google_ads" row (this OAuth grant also carries the
    // adwords scope, used by the Ads Manager's Google Ads launch flow) even
    // if there's no YouTube channel on this account.
    await admin.from("social_accounts").upsert(
      {
        org_id: state.orgId,
        platform: "google_ads",
        account_id: "google_ads",
        account_name: "Google Ads",
        account_username: null,
        account_avatar: null,
        account_type: "ads",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: ["adwords"],
        is_active: true,
        last_synced_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0,
        post_count: 0,
      },
      { onConflict: "org_id,platform,account_id" },
    );

    if (channel) {
      await admin.from("social_accounts").upsert(
        {
          org_id: state.orgId,
          platform: "youtube",
          account_id: channel.id,
          account_name: channel.title,
          account_username: null,
          account_avatar: null,
          account_type: "channel",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: ["youtube.upload"],
          is_active: true,
          last_synced_at: new Date().toISOString(),
          follower_count: 0,
          following_count: 0,
          post_count: 0,
        },
        { onConflict: "org_id,platform,account_id" },
      );
    }

    const response = NextResponse.redirect(new URL("/social-accounts?connected=google", request.url));
    response.cookies.delete(OAUTH_NONCE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection_failed";
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(message)}`, request.url));
  }
}
