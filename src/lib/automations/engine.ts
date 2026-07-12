import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead } from "@/types/database";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import { sendWhatsAppMessage } from "@/lib/social/whatsapp";
import { sendSms, isTwilioConfigured } from "@/lib/messaging/sms";
import { sendEmail, isEmailConfigured } from "@/lib/messaging/email";

export type AutomationActionType = "create_follow_up_task" | "notify_assignee" | "send_whatsapp_message" | "send_sms" | "send_email";

export interface AutomationAction {
  type: AutomationActionType;
  delay_hours?: number;
  task_title?: string;
  message_template?: string;
  email_subject?: string;
}

function fillTemplate(template: string, lead: Lead): string {
  return template.replace(/\{name\}/g, lead.name || "there").replace(/\{company\}/g, lead.company || "");
}

export type AutomationTriggerType = "lead_created" | "lead_status_changed";

/** Runs every active automation of the given trigger type for one org, using the service-role client (server-only). */
export async function runAutomations(
  admin: SupabaseClient<Database>,
  orgId: string,
  triggerType: AutomationTriggerType,
  lead: Lead,
): Promise<void> {
  const { data: automations } = await admin
    .from("automations")
    .select("*")
    .eq("org_id", orgId)
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  for (const automation of automations ?? []) {
    const actions = (automation.actions as unknown as AutomationAction[]) ?? [];
    const executed: AutomationAction[] = [];
    let status = "success";
    let errorMessage: string | null = null;

    try {
      for (const action of actions) {
        await executeAction(admin, orgId, lead, action);
        executed.push(action);
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : "Automation action failed";
    }

    await admin.from("automation_logs").insert({
      automation_id: automation.id,
      org_id: orgId,
      lead_id: lead.id,
      status,
      actions_executed: executed as unknown as Database["public"]["Tables"]["automation_logs"]["Row"]["actions_executed"],
      error: errorMessage,
    });

    await admin
      .from("automations")
      .update({ run_count: automation.run_count + 1, last_run_at: new Date().toISOString() })
      .eq("id", automation.id);
  }
}

async function executeAction(
  admin: SupabaseClient<Database>,
  orgId: string,
  lead: Lead,
  action: AutomationAction,
): Promise<void> {
  switch (action.type) {
    case "create_follow_up_task": {
      const dueAt = new Date(Date.now() + (action.delay_hours ?? 24) * 3600_000).toISOString();
      await admin.from("tasks").insert({
        org_id: orgId,
        lead_id: lead.id,
        title: action.task_title || `Follow up with ${lead.name || lead.email || "new lead"}`,
        description: null,
        type: "follow_up",
        priority: "medium",
        assigned_to: lead.assigned_to,
        due_at: dueAt,
        completed_at: null,
        created_by: null,
      });
      return;
    }
    case "notify_assignee": {
      if (!lead.assigned_to) return;
      await notifyOrgMembers(
        orgId,
        {
          type: "automation",
          title: `Automation: follow up with ${lead.name || lead.email || "a lead"}`,
          data: { leadId: lead.id },
        },
        undefined,
      );
      return;
    }
    case "send_whatsapp_message": {
      if (!lead.phone) throw new Error("Lead has no phone number");
      const { data: account } = await admin
        .from("social_accounts")
        .select("*")
        .eq("org_id", orgId)
        .eq("platform", "whatsapp")
        .eq("is_active", true)
        .maybeSingle();
      if (!account || !account.access_token) throw new Error("No WhatsApp number connected — see Social Accounts");
      const message = fillTemplate(action.message_template || `Hi {name}, thanks for your interest — we'll be in touch shortly!`, lead);
      await sendWhatsAppMessage(account.account_id, account.access_token, lead.phone, message);
      return;
    }
    case "send_sms": {
      if (!isTwilioConfigured()) throw new Error("SMS isn't configured — add TWILIO_* to .env.local");
      if (!lead.phone) throw new Error("Lead has no phone number");
      const message = fillTemplate(action.message_template || `Hi {name}, thanks for your interest — we'll be in touch shortly!`, lead);
      await sendSms(lead.phone, message);
      return;
    }
    case "send_email": {
      if (!isEmailConfigured()) throw new Error("Email isn't configured — add RESEND_API_KEY to .env.local");
      if (!lead.email) throw new Error("Lead has no email address");
      const body = fillTemplate(action.message_template || `Hi {name}, thanks for your interest — we'll be in touch shortly!`, lead);
      await sendEmail(lead.email, action.email_subject || "Thanks for reaching out", body);
      return;
    }
  }
}
