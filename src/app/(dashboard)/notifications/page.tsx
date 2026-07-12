import Header from "@/components/layout/Header";
import NotificationsList from "@/components/notifications/NotificationsList";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/supabase/notifications";
import type { Notification } from "@/types/database";

async function getPageData(): Promise<{ userId: string | null; notifications: Notification[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { userId: null, notifications: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, notifications: [] };

  const notifications = await getNotifications(supabase, user.id, 50);
  return { userId: user.id, notifications };
}

export default async function NotificationsPage() {
  const { userId, notifications } = await getPageData();

  return (
    <div>
      <Header title="Notifications" />
      <NotificationsList userId={userId} initialNotifications={notifications} />
    </div>
  );
}
