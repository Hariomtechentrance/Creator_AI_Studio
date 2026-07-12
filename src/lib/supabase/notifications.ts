import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/types/database";

export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getUnreadCount(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return count ?? 0;
}

export async function markAsRead(supabase: SupabaseClient<Database>, id: string): Promise<void> {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllAsRead(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
}
