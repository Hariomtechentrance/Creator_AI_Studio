"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, RefreshCw, Send, MapPin } from "lucide-react";
import type { SocialAccount } from "@/types/database";

interface GbpReview {
  reviewId: string;
  starRating: number;
  comment: string;
  reviewerName: string;
  publishTime: string;
  reply: string | null;
}

interface GbpScoreResponse {
  score: number;
  recommendations: string[];
  stats: {
    reviewCount: number;
    unansweredReviews: number;
    averageRating: number;
    photos: number;
    videos: number;
    attributes: number;
    websiteChecked: boolean;
  };
  accountName: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 55) return "#f59e0b";
  return "#f87171";
}

export default function GbpPanel({ accounts }: { accounts: SocialAccount[] }) {
  const gbpAccounts = accounts.filter((a) => a.platform === "google_business" && a.is_active);
  const [selectedId, setSelectedId] = useState<string>(gbpAccounts[0]?.id ?? "");
  const [score, setScore] = useState<GbpScoreResponse | null>(null);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Derive the active selection instead of syncing it via an effect: if the
  // stored id is gone (connect/disconnect), fall back to the first account.
  const activeAccountId = gbpAccounts.some((a) => a.id === selectedId)
    ? selectedId
    : gbpAccounts[0]?.id ?? "";

  const loadAll = useCallback(async (accountId: string) => {
    if (!accountId) return;
    setError("");
    setLoadingScore(true);
    setLoadingReviews(true);
    try {
      const [scoreRes, reviewsRes] = await Promise.all([
        fetch(`/api/gbp/score?accountId=${accountId}`),
        fetch(`/api/gbp/reviews?accountId=${accountId}`),
      ]);
      const scoreData = await scoreRes.json();
      const reviewsData = await reviewsRes.json();
      if (!scoreRes.ok) throw new Error(scoreData.error ?? "Couldn't load score");
      setScore(scoreData);
      if (reviewsRes.ok) setReviews(reviewsData.reviews ?? []);
      else setError(reviewsData.error ?? "Couldn't load reviews");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingScore(false);
      setLoadingReviews(false);
    }
  }, []);

  // Load score + reviews whenever the active selection changes. loadAll flips
  // loading state synchronously on purpose (selection change / explicit
  // refresh), so we opt out of the cascading-render guard for this call.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll(activeAccountId);
  }, [activeAccountId, loadAll]);

  if (gbpAccounts.length === 0) return null;

  const unanswered = reviews.filter((r) => !r.reply);

  const handleReply = async (reviewId: string) => {
    const comment = (drafts[reviewId] ?? "").trim();
    if (!comment) return;
    setReplyingTo(reviewId);
    try {
      const res = await fetch("/api/gbp/reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId, reviewId, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reply failed");
        return;
      }
      setReviews((prev) => prev.map((r) => (r.reviewId === reviewId ? { ...r, reply: comment } : r)));
      setDrafts((prev) => ({ ...prev, [reviewId]: "" }));
    } finally {
      setReplyingTo(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pb-10 space-y-5">
      <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin size={18} style={{ color: "#34a853" }} />
            <h2 className="text-base font-bold text-white">Google Business Profile — Optimization</h2>
          </div>
          <div className="flex items-center gap-2">
            {gbpAccounts.length > 1 && (
              <select value={activeAccountId} onChange={(e) => setSelectedId(e.target.value)} className="input text-sm py-1.5">
                {gbpAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            )}
            <button onClick={() => loadAll(activeAccountId)} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(52,168,83,0.15)", color: "#34a853", border: "1px solid rgba(52,168,83,0.3)" }}>
              <RefreshCw size={12} className={loadingScore ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error && <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>{error}</p>}

        {loadingScore && !score && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Reading your profile from Google…</p>
        )}

        {score && (
          <div className="space-y-4">
            {/* Score meter */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black" style={{ background: `conic-gradient(${scoreColor(score.score)} ${score.score * 3.6}deg, var(--bg-hover) 0deg)` }}>
                  <span className="w-16 h-16 rounded-full flex items-center justify-center bg-[var(--bg-card)]">{score.score}%</span>
                </div>
              </div>
              <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                <p className="text-sm font-semibold text-white">{score.accountName || "Business Profile"}</p>
                <p>Avg rating <span style={{ color: "#f59e0b" }}>{score.stats.averageRating}★</span> · {score.stats.reviewCount} reviews · {score.stats.photos} photos{score.stats.videos ? ` · ${score.stats.videos} videos` : ""}</p>
                {score.stats.unansweredReviews > 0 && (
                  <p style={{ color: "#f87171" }}>{score.stats.unansweredReviews} review(s) still need a reply</p>
                )}
              </div>
            </div>

            {/* Top recommendations */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>How to rank higher</p>
              <ul className="space-y-1.5">
                {score.recommendations.slice(0, 8).map((rec, i) => (
                  <li key={i} className="text-xs flex gap-2" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "#34a853" }}>•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Reviews to reply */}
      {unanswered.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold text-white mb-1">Unanswered reviews ({unanswered.length})</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Replying to every review is one of the strongest local-ranking signals.</p>
          <div className="space-y-4">
            {unanswered.map((r) => (
              <div key={r.reviewId} className="rounded-lg p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white">{r.reviewerName}</span>
                  <span className="text-[11px]" style={{ color: "#f59e0b" }}>{r.starRating}★</span>
                </div>
                {r.comment && <p className="text-xs mb-2 line-clamp-3" style={{ color: "var(--text-secondary)" }}>{r.comment}</p>}
                <div className="flex gap-2">
                  <textarea
                    value={drafts[r.reviewId] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.reviewId]: e.target.value }))}
                    placeholder="Write a public reply…"
                    rows={2}
                    className="input flex-1 text-sm"
                  />
                  <button onClick={() => handleReply(r.reviewId)} disabled={replyingTo === r.reviewId || !(drafts[r.reviewId] ?? "").trim()} className="px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0" style={{ background: "#34a853", color: "#fff" }}>
                    {replyingTo === r.reviewId ? <RefreshCw size={12} className="animate-spin" /> : <><Send size={12} /> Reply</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadingReviews && unanswered.length === 0 && score && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#34d399" }}><Star size={12} /> All reviews have been replied to.</p>
      )}
    </div>
  );
}
