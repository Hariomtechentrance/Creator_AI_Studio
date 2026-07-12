import Header from "@/components/layout/Header";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getContentPosts } from "@/lib/supabase/content";
import { CalendarDays } from "lucide-react";
import type { ContentPost } from "@/types/database";

async function getPageData(): Promise<ContentPost[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return [];

  const posts = await getContentPosts(supabase, org.id);
  return posts.filter((p) => p.scheduled_at);
}

export default async function ContentCalendarPage() {
  const scheduled = await getPageData();

  const byDate = new Map<string, ContentPost[]>();
  for (const post of scheduled) {
    const day = new Date(post.scheduled_at as string).toDateString();
    byDate.set(day, [...(byDate.get(day) ?? []), post]);
  }
  const days = [...byDate.entries()].sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  return (
    <div>
      <Header title="Content Calendar" />
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        {days.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Nothing scheduled yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Generate content in{" "}
              <Link href="/content" className="underline" style={{ color: "#a78bfa" }}>Content Studio</Link>{" "}
              and schedule it to see it here.
            </p>
          </div>
        ) : (
          days.map(([day, posts]) => (
            <div key={day}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                {new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <div className="space-y-2">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <span className="text-xs font-bold shrink-0 w-14" style={{ color: "#a78bfa" }}>
                      {new Date(post.scheduled_at as string).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{post.title || "Untitled"}</p>
                      <p className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>{post.platforms.join(", ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
