import { cookies } from "next/headers";
import type { Organization } from "@/types/database";

// Split out from organizations.ts (server-only, needs next/headers) so
// client components can import the rest of that module (getUserOrgs,
// updateOrgLogo, etc.) without pulling next/headers into the client bundle.
export const ACTIVE_ORG_COOKIE = "active_org_id";

/** Picks the user's active org from the `active_org_id` cookie, falling back to the first org. */
export async function resolveActiveOrg(orgs: Organization[]): Promise<Organization | null> {
  if (orgs.length === 0) return null;
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === activeId) ?? orgs[0];
}
