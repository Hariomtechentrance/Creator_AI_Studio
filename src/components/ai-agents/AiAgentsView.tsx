"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import * as Select from "@radix-ui/react-select";
import { Megaphone, Brain, Users, Send, Bot, ChevronDown, Check } from "lucide-react";
import type { AgentType } from "@/lib/ai/agentChat";
import type { Lead } from "@/types/database";

type FullAgentType = AgentType | "sales";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AGENTS: { id: FullAgentType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: "marketing", label: "Marketing AI Agent", desc: "Content planning, campaign ideas, social strategy", icon: <Megaphone size={20} />, color: "#06b6d4" },
  { id: "consultant", label: "Business Consultant AI", desc: "Growth opportunities, marketing plans, revenue outlook", icon: <Brain size={20} />, color: "#a855f7" },
  { id: "sales", label: "Sales AI Agent", desc: "Qualify leads, handle objections, propose meeting times", icon: <Users size={20} />, color: "#10b981" },
];

export default function AiAgentsView({ orgId, leads }: { orgId: string | null; leads: Lead[] }) {
  const [activeAgent, setActiveAgent] = useState<FullAgentType | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSales = activeAgent === "sales";
  const ready = !isSales || !!leadId;

  const handleSend = async () => {
    if (!input.trim() || !orgId || !activeAgent || !ready) return;
    const message = input.trim();
    setInput("");
    setError("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, agentType: activeAgent, leadId: isSales ? leadId : undefined, message, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The agent couldn't reply");
        return;
      }
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  const openAgent = (id: FullAgentType) => {
    setActiveAgent(id);
    setMessages([]);
    setError("");
    setLeadId(null);
  };

  const agent = AGENTS.find((a) => a.id === activeAgent);
  const selectedLead = leads.find((l) => l.id === leadId);

  return (
    <div>
      <Header title="AI Agents" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <div className="grid sm:grid-cols-3 gap-3">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => openAgent(a.id)}
              className="text-left rounded-2xl p-4 transition-all"
              style={{
                background: activeAgent === a.id ? `${a.color}15` : "var(--bg-card)",
                border: activeAgent === a.id ? `1px solid ${a.color}60` : "1px solid var(--border)",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${a.color}20`, color: a.color }}>
                {a.icon}
              </div>
              <p className="text-sm font-bold text-white">{a.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{a.desc}</p>
            </button>
          ))}
        </div>

        {isSales && (
          <div className="rounded-xl p-3.5 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Which lead?</p>
            <Select.Root value={leadId ?? undefined} onValueChange={(v) => { setLeadId(v); setMessages([]); }}>
              <Select.Trigger
                className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <Select.Value placeholder="Pick a lead to work" />
                <ChevronDown size={13} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="rounded-xl p-1.5 z-[60] max-h-64"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                >
                  <Select.Viewport>
                    {leads.map((l) => (
                      <Select.Item
                        key={l.id}
                        value={l.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-white/5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Select.ItemText>{l.name || l.email || "Unnamed lead"}</Select.ItemText>
                        <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                    {leads.length === 0 && <p className="text-xs px-2.5 py-2" style={{ color: "var(--text-muted)" }}>No leads yet</p>}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        )}

        {agent && (
          <div className="rounded-2xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border)", height: 440 }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
              {agent.icon}
              <span className="text-sm font-bold text-white">{agent.label}{selectedLead ? ` — ${selectedLead.name || selectedLead.email}` : ""}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--bg-card)" }}>
              {messages.length === 0 && (
                <p className="text-xs text-center mt-8" style={{ color: "var(--text-muted)" }}>
                  {isSales
                    ? ready
                      ? "Ask this agent to qualify the lead, draft a reply, handle an objection, or propose meeting times."
                      : "Pick a lead above to start."
                    : "Ask about your business — this agent uses your brand profile, leads, and campaigns."}
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && <Bot size={16} style={{ color: agent.color }} className="shrink-0 mt-1" />}
                  <div
                    className="max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap"
                    style={{ background: m.role === "user" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "var(--bg-secondary)", color: m.role === "user" ? "white" : "var(--text-secondary)" }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && <div className="flex items-center gap-2"><span className="spinner w-4 h-4" /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Thinking…</span></div>}
              {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <input
                className="input flex-1"
                placeholder={ready ? "Ask this agent…" : "Pick a lead first…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                disabled={loading || !ready}
              />
              <button onClick={handleSend} disabled={loading || !input.trim() || !ready} className="btn-primary px-4">{loading ? <span className="spinner" /> : <Send size={14} />}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
