import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Server-only: uses the service-role client because own_notifications' RLS
// (user_id = auth.uid()) means a normal session can only insert rows for
// itself — fanning a notification out to teammates has to bypass that.
export async function notifyOrgMembers(
  orgId: string,
  notification: { type: string; title: string; body?: string; data?: Json },
  excludeUserId?: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: members } = await admin.from("org_members").select("user_id").eq("org_id", orgId);

  const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== excludeUserId);
  if (recipients.length === 0) return;

  await admin.from("notifications").insert(
    recipients.map((user_id) => ({
      org_id: orgId,
      user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      data: notification.data ?? {},
    })),
  );
}
