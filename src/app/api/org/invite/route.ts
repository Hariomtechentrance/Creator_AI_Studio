import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgMemberRole } from "@/types/database";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

const INVITABLE_ROLES: OrgMemberRole[] = ["admin", "manager", "sales", "marketing", "viewer"];

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Team invites aren't available yet" }, { status: 400 });
  }

  let body: { orgId?: string; email?: string; role?: OrgMemberRole };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, email, role } = body;
  if (!orgId || !email?.trim() || !role || !INVITABLE_ROLES.includes(role)) {
    return Response.json({ error: "orgId, a valid email, and role are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Inviting a brand-new email creates the auth user and emails them a
  // signup link. If they already have an account, look them up instead.
  let invitedUserId: string | undefined;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail);

  if (invited?.user) {
    invitedUserId = invited.user.id;
  } else if (inviteError?.message?.toLowerCase().includes("already")) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();
    invitedUserId = existingProfile?.id;
  }

  if (!invitedUserId) {
    return Response.json({ error: inviteError?.message ?? "Couldn't invite that email" }, { status: 400 });
  }

  // Insert through the caller's own session so the org_members RLS insert
  // policy (owner/admin only) is the actual authority, not app code.
  const { error: insertError } = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: invitedUserId,
    role,
    invited_by: user.id,
  });

  if (insertError) {
    const message = insertError.code === "23505" ? "That person is already on the team" : insertError.message;
    return Response.json({ error: message }, { status: 403 });
  }

  return Response.json({ success: true });
}
