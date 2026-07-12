import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLeadNotes } from "@/lib/supabase/leads";
import { analyzeLead } from "@/lib/ai/leadAnalysis";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to generate an AI summary" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "AI summaries aren't configured yet — add ANTHROPIC_API_KEY" }, { status: 400 });
  }

  let body: { leadId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { leadId } = body;
  if (!leadId) {
    return Response.json({ error: "leadId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  // RLS (`org_access_leads` via `is_org_member`) is the real gate — this
  // select simply returns nothing if the caller isn't in the lead's org.
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  const notes = await getLeadNotes(supabase, leadId);

  try {
    const result = await analyzeLead({ lead, notes });

    await supabase
      .from("leads")
      .update({
        ai_insights: { summary: result.summary, next_action: result.nextAction, risk_flag: result.riskFlag },
        ai_last_analyzed_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI summary failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
