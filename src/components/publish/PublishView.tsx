"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Send, Hash, Calendar } from "lucide-react";
import type { ContentPost } from "@/types/database";

const STATUS_COLOR: Record<string, string> = {
  draft: "#6b7280",
  scheduled: "#f59e0b",
  published: "#10b981",
  failed: "#ef4444",
};

export default function PublishView({ initialPosts }: { initialPosts: ContentPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Record<string, { success: boolean; error?: string }>>>({});

  const handlePublish = async (postId: string) => {
    setPublishing(postId);
    try {
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults((prev) => ({ ...prev, [postId]: data.results }));
        const allSucceeded = Object.values(data.results).every((r) => (r as { success: boolean }).success);
        const anySucceeded = Object.values(data.results).some((r) => (r as { success: boolean }).success);
        if (anySucceeded) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status: allSucceeded ? "published" : "failed" } : p)));
        }
      }
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div>
      <Header title="Publishing Hub" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Send size={15} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Publishing goes live on Facebook/Instagram/LinkedIn if connected (see Social Accounts). Other platforms aren&apos;t wired yet and will show &ldquo;not built&rdquo; per-platform below.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16">
            <Send size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No content yet — create some in Content Studio</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-white">{post.title || "Untitled"}</p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0"
                    style={{ background: `${STATUS_COLOR[post.status] ?? "#6b7280"}20`, color: STATUS_COLOR[post.status] ?? "#6b7280" }}
                  >
                    {post.status}
                  </span>
                </div>
                <p className="text-xs line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>{post.caption}</p>
                <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><Hash size={10} /> {post.platforms.join(", ") || "No platform"}</span>
                  {post.scheduled_at && (
                    <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(post.scheduled_at).toLocaleString()}</span>
                  )}
                  <button
                    onClick={() => handlePublish(post.id)}
                    disabled={publishing === post.id || post.status === "published"}
                    className="ml-auto px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}
                  >
                    {publishing === post.id ? "Publishing…" : post.status === "published" ? "Published" : "Publish Now"}
                  </button>
                </div>
                {results[post.id] && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(results[post.id]).map(([platform, r]) => (
                      <p key={platform} className="text-[11px]" style={{ color: r.success ? "#34d399" : "#f87171" }}>
                        {platform}: {r.success ? "Published" : r.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
