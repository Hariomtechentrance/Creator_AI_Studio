import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

/**
 * Notifies a task's assignee once a pending task is overdue. There's no
 * cron/scheduler configured in this repo (would need Vercel Cron or similar
 * deployed infra), so this runs on-demand — called opportunistically from
 * the Tasks and Dashboard pages when a member visits, not on a real
 * schedule. Dedupes via a `missed_follow_up` notification already existing
 * for that task, since `tasks` has no "notified" flag to check instead.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ notified: 0 });
  }

  let body: { orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId } = body;
  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: overdueTasks } = await admin
    .from("tasks")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .not("due_at", "is", null)
    .lt("due_at", new Date().toISOString());

  if (!overdueTasks || overdueTasks.length === 0) {
    return Response.json({ notified: 0 });
  }

  const { data: existingNotifications } = await admin
    .from("notifications")
    .select("data")
    .eq("org_id", orgId)
    .eq("type", "missed_follow_up");

  const alreadyNotifiedTaskIds = new Set(
    (existingNotifications ?? [])
      .map((n) => (n.data as { taskId?: string } | null)?.taskId)
      .filter((id): id is string => !!id),
  );

  const toNotify = overdueTasks.filter((t) => t.assigned_to && !alreadyNotifiedTaskIds.has(t.id));

  if (toNotify.length > 0) {
    await admin.from("notifications").insert(
      toNotify.map((t) => ({
        org_id: orgId,
        user_id: t.assigned_to as string,
        type: "missed_follow_up",
        title: `Overdue: ${t.title}`,
        body: t.due_at ? `Was due ${new Date(t.due_at).toLocaleDateString()}` : null,
        data: { taskId: t.id, leadId: t.lead_id },
      })),
    );
  }

  return Response.json({ notified: toNotify.length });
}
