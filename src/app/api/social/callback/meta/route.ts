import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeMetaCode, getMetaPages } from "@/lib/social/meta";
import { parseOAuthState, OAUTH_NONCE_COOKIE } from "@/lib/social/oauthState";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(errorParam)}`, request.url));
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(new URL("/social-accounts?error=missing_code", request.url));
  }

  const state = parseOAuthState(stateParam);
  const cookieNonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
  if (!state || !cookieNonce || state.nonce !== cookieNonce) {
    return NextResponse.redirect(new URL("/social-accounts?error=invalid_state", request.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social/callback/meta`;
    const userAccessToken = await exchangeMetaCode(code, redirectUri);
    const pages = await getMetaPages(userAccessToken);

    const admin = createAdminClient();
    for (const page of pages) {
      await admin.from("social_accounts").upsert(
        {
          org_id: state.orgId,
          platform: "facebook",
          account_id: page.pageId,
          account_name: page.pageName,
          account_username: null,
          account_avatar: null,
          account_type: "page",
          access_token: page.pageAccessToken,
          refresh_token: null,
          token_expires_at: null,
          scopes: ["pages_manage_posts", "pages_read_engagement"],
          is_active: true,
          last_synced_at: new Date().toISOString(),
          follower_count: 0,
          following_count: 0,
          post_count: 0,
        },
        { onConflict: "org_id,platform,account_id" },
      );

      if (page.instagramAccountId) {
        await admin.from("social_accounts").upsert(
          {
            org_id: state.orgId,
            platform: "instagram",
            account_id: page.instagramAccountId,
            account_name: page.pageName,
            account_username: page.instagramUsername,
            account_avatar: null,
            account_type: "business",
            access_token: page.pageAccessToken,
            refresh_token: null,
            token_expires_at: null,
            scopes: ["instagram_content_publish"],
            is_active: true,
            last_synced_at: new Date().toISOString(),
            follower_count: 0,
            following_count: 0,
            post_count: 0,
          },
          { onConflict: "org_id,platform,account_id" },
        );
      }
    }

    const response = NextResponse.redirect(new URL("/social-accounts?connected=meta", request.url));
    response.cookies.delete(OAUTH_NONCE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "connection_failed";
    return NextResponse.redirect(new URL(`/social-accounts?error=${encodeURIComponent(message)}`, request.url));
  }
}
