import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/supabase/brand";
import { getLeads, getLeadNotes } from "@/lib/supabase/leads";
import { getCampaigns } from "@/lib/supabase/campaigns";
import { getLatestReport } from "@/lib/supabase/aiReports";
import { chatWithAgent, type AgentType } from "@/lib/ai/agentChat";
import { chatWithSalesAgent } from "@/lib/ai/salesAgent";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

type FullAgentType = AgentType | "sales";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to chat with an agent" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "AI agents aren't configured yet — add GEMINI_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string; agentType?: FullAgentType; leadId?: string; message?: string; history?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, agentType, leadId, message, history = [] } = body;
  if (!orgId || !agentType || !message?.trim() || !["marketing", "consultant", "sales"].includes(agentType)) {
    return Response.json({ error: "orgId, a valid agentType, and message are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  if (!org) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const brandProfile = await getBrandProfile(supabase, orgId);

  try {
    if (agentType === "sales") {
      if (!leadId) return Response.json({ error: "leadId is required for the Sales agent" }, { status: 400 });

      const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).eq("org_id", orgId).single();
      if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

      const notes = await getLeadNotes(supabase, leadId);
      const reply = await chatWithSalesAgent({ lead, notes, brandProfile, history, message });
      return Response.json({ reply });
    }

    const [leads, campaigns, latestReport] = await Promise.all([
      getLeads(supabase, orgId),
      getCampaigns(supabase, orgId),
      getLatestReport(supabase, orgId),
    ]);

    const reply = await chatWithAgent({ agentType, org, brandProfile, leads, campaigns, latestReport, history, message });
    return Response.json({ reply });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "The agent failed to reply";
    return Response.json({ error: errMessage }, { status: 500 });
  }
}
