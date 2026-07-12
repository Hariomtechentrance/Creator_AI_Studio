import { randomBytes } from "crypto";

export interface OAuthState {
  orgId: string;
  nonce: string;
}

export const OAUTH_NONCE_COOKIE = "oauth_nonce";

export function createOAuthState(orgId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ orgId, nonce })).toString("base64url");
  return { state, nonce };
}

export function parseOAuthState(state: string): OAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (typeof parsed.orgId === "string" && typeof parsed.nonce === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}
