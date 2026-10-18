"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { CheckCircle2, XCircle, Hash } from "lucide-react";
import type { ContentPost } from "@/types/database";

export default function ApprovalsView({ initialPosts }: { initialPosts: ContentPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Record<string, { success: boolean; error?: string }>>>({});

  const handleApprove = async (postId: string) => {
    setBusy(postId);
    try {
      const res = await fetch(`/api/content-posts/${postId}/approve`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResults((prev) => ({ ...prev, [postId]: data.results }));
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (postId: string) => {
    setBusy(postId);
    try {
      const res = await fetch(`/api/content-posts/${postId}/reject`, { method: "POST" });
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Header title="Approvals" />
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <CheckCircle2 size={15} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Approving a post publishes it immediately to every platform selected when it was created.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Nothing waiting for approval</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex gap-4">
                  {post.media_type === "video" && post.media_urls[0] ? (
                    <video src={post.media_urls[0]} controls className="w-40 rounded-lg shrink-0" style={{ border: "1px solid var(--border)" }} />
                  ) : post.media_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.media_urls[0]} alt={post.title ?? ""} className="w-40 h-40 object-cover rounded-lg shrink-0" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{post.title || "Untitled"}</p>
                    <p className="text-xs mt-1 line-clamp-3" style={{ color: "var(--text-secondary)" }}>{post.caption}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1"><Hash size={10} /> {post.platforms.join(", ") || "No platform"}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleApprove(post.id)}
                        disabled={busy === post.id}
                        className="btn-primary px-4 py-1.5 text-xs"
                      >
                        {busy === post.id ? <span className="spinner" /> : <><CheckCircle2 size={13} /> Approve & Publish</>}
                      </button>
                      <button
                        onClick={() => handleReject(post.id)}
                        disabled={busy === post.id}
                        className="btn-secondary px-4 py-1.5 text-xs"
                      >
                        <XCircle size={13} /> Reject
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
