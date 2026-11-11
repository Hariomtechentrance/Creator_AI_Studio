import { createClient } from "@/lib/supabase/server";
import { refreshGoogleToken } from "@/lib/social/google";

export interface GbpContext {
  accessToken: string;
  locationResource: string;
  accountName: string;
}

/**
 * Resolves a connected Google Business Profile row for the signed-in user.
 *
 * The social_accounts read goes through the user's own Supabase client, so RLS
 * (org_access_social_accounts / is_org_member) is the real authorization gate —
 * a member can only ever resolve a location belonging to their own org. Google
 * access tokens expire ~1h, so we mint a fresh one from the stored refresh token.
 *
 * Returns an error string (mapped to a 4xx by callers) instead of throwing so
 * each route can pick its own response shape.
 */
export async function getGbpContext(socialAccountId: string): Promise<{ ok: true; ctx: GbpContext } | { ok: false; error: string; status: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required", status: 401 };

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", socialAccountId)
    .maybeSingle();
  if (!account) return { ok: false, error: "Business profile not found for your org", status: 404 };
  if (account.platform !== "google_business") return { ok: false, error: "This account is not a Google Business Profile", status: 400 };

  // Google access tokens expire ~1h, so mint a fresh one from the stored refresh
  // token. refreshGoogleToken THROWS when the refresh token is expired/revoked
  // (user changed their Google password, withdrew consent, etc.) — a very common
  // case — so guard it and degrade to a clean 401 "reconnect" instead of letting
  // the exception bubble up as an unhandled 500 in the calling route.
  let accessToken: string | null = account.access_token;
  if (account.refresh_token) {
    try {
      accessToken = await refreshGoogleToken(account.refresh_token);
    } catch {
      return { ok: false, error: "Google session expired — please reconnect the Business Profile", status: 401 };
    }
  }
  if (!accessToken) return { ok: false, error: "No valid Google token — reconnect the profile", status: 401 };

  return { ok: true, ctx: { accessToken, locationResource: account.account_id, accountName: account.account_name ?? "" } };
}
