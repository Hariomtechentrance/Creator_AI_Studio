"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { MessageSquare, Send, Bot, User, MessageCircle, Camera, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateWebsiteTestConversation, getMessages } from "@/lib/supabase/conversations";
import type { Conversation, Message } from "@/types/database";

interface CommunityViewProps {
  orgId: string | null;
  initialConversations: Conversation[];
}

export default function CommunityView({ orgId, initialConversations }: CommunityViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const handleStartTest = async () => {
    if (!orgId) return;
    setStarting(true);
    setError("");
    try {
      const supabase = createClient();
      const convo = await getOrCreateWebsiteTestConversation(supabase, orgId);
      const history = await getMessages(supabase, convo.id);
      setConversation(convo);
      setMessages(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a test conversation");
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !orgId || !conversation) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    setError("");

    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, conversation_id: conversation.id, org_id: orgId, sender_type: "lead", sender_id: null, content: text, media_urls: [], media_type: "text", ai_generated: false, ai_confidence: null, sentiment: null, intent_detected: null, external_message_id: null, is_read: true, delivered_at: null, read_at: null, created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, conversationId: conversation.id, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't get a reply");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `temp-bot-${Date.now()}`, conversation_id: conversation.id, org_id: orgId, sender_type: "bot", sender_id: null, content: data.reply, media_urls: [], media_type: "text", ai_generated: true, ai_confidence: null, sentiment: null, intent_detected: null, external_message_id: null, is_read: true, delivered_at: null, read_at: null, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header title="Inbox" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <Bot size={16} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Try your AI chatbot below — it answers using your Brand Intelligence profile. WhatsApp and Instagram DM inboxes need those platforms connected first (see Social Accounts).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-2.5">
          {[
            { label: "WhatsApp Business", icon: <MessageCircle size={14} /> },
            { label: "Instagram DMs", icon: <Camera size={14} /> },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-xl p-3 opacity-50" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {c.icon}
              <div>
                <p className="text-xs font-semibold text-white">{c.label}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Not connected</p>
              </div>
            </div>
          ))}
        </div>

        {!conversation ? (
          <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-4" style={{ background: "var(--bg-card)", border: "2px dashed var(--border)" }}>
            <MessageSquare size={28} className="text-violet-400" />
            <div className="text-center">
              <p className="text-sm font-bold text-white mb-1">Test your website chatbot</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>See how it answers questions using your brand context</p>
            </div>
            <button onClick={handleStartTest} disabled={!orgId || starting} className="btn-primary px-5 py-2.5">
              {starting ? <span className="spinner" /> : "Start test chat"}
            </button>
            {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border)", height: 420 }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--bg-card)" }}>
              {messages.length === 0 && (
                <p className="text-xs text-center mt-8" style={{ color: "var(--text-muted)" }}>Say hello to test your chatbot</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex items-start gap-2 ${m.sender_type === "lead" ? "justify-end" : ""}`}>
                  {m.sender_type === "bot" && <Bot size={16} className="text-violet-400 shrink-0 mt-1" />}
                  <div
                    className="max-w-[75%] rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: m.sender_type === "lead" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "var(--bg-secondary)",
                      color: m.sender_type === "lead" ? "white" : "var(--text-secondary)",
                    }}
                  >
                    {m.content}
                  </div>
                  {m.sender_type === "lead" && <User size={16} style={{ color: "var(--text-muted)" }} className="shrink-0 mt-1" />}
                </div>
              ))}
              {conversation.status === "needs_human" && (
                <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                  <AlertTriangle size={12} /> Escalated: {conversation.escalation_reason}
                </div>
              )}
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <input
                className="input flex-1"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                disabled={loading}
              />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="btn-primary px-4">
                {loading ? <span className="spinner" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        )}
        {error && conversation && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        {initialConversations.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-white mb-2">Past conversations</h2>
            <div className="space-y-1.5">
              {initialConversations.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <span className="capitalize" style={{ color: "var(--text-secondary)" }}>{c.platform} · {c.external_username || "Visitor"}</span>
                  <span style={{ color: "var(--text-muted)" }}>{new Date(c.last_message_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
