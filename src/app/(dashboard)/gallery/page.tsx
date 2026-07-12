import Header from "@/components/layout/Header";
import { Images, Sparkles } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Generation } from "@/types/database";

async function getGenerations(): Promise<Generation[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export default async function GalleryPage() {
  const generations = await getGenerations();
  const items = generations.flatMap((gen) =>
    gen.output_urls.map((url, i) => ({ url, key: `${gen.id}-${i}`, prompt: gen.prompt, model: gen.model })),
  );

  return (
    <div>
      <Header title="My Gallery" />
      <div className="p-6 max-w-6xl mx-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24" style={{ color: "var(--text-muted)" }}>
            <Images size={64} className="opacity-20 mb-4" />
            <p className="text-xl font-bold mb-2" style={{ color: "var(--text-secondary)" }}>Your gallery is empty</p>
            <p className="text-sm mb-6">All your generated images and videos will appear here</p>
            <Link href="/image-generation" className="btn-primary px-6 py-3">
              <Sparkles size={15} /> Create your first generation
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.key} className="group relative rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.prompt} className="w-full aspect-square object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                  <p className="text-xs text-white truncate">{item.prompt}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.model}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
