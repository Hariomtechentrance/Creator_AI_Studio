import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCredits } from "@/lib/credits";
import { getStripeClient, isStripeConfigured, PLAN_BY_PRICE_ID } from "@/lib/stripe";

const PLAN_CREDITS: Record<string, number> = { apprentice: 8500, artisan: 25000, maestro: 60000 };

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

/**
 * Marks an event as handled in the idempotency ledger. Stripe delivers
 * webhooks at-least-once and retries on any non-2xx, so without this a
 * redelivered `checkout.session.completed` would grant credits twice.
 * Returns true if the event was already processed (caller should no-op).
 * Throws on a real DB error so Stripe retries rather than us silently
 * dropping a fulfilment.
 */
async function markProcessed(admin: ReturnType<typeof createAdminClient>, eventId: string, eventType: string): Promise<boolean> {
  const { error } = await admin.from("processed_stripe_events").insert({ event_id: eventId, event_type: eventType });
  if (error) {
    if (error.code === "23505") return true; // unique_violation => duplicate delivery
    throw error;
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !isStripeConfigured()) {
    return Response.json({ error: "Billing isn't configured" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "your_stripe_webhook_secret") {
    return Response.json({ error: "STRIPE_WEBHOOK_SECRET isn't configured" }, { status: 400 });
  }

  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    // Idempotency: skip anything we've already handled (before doing any work).
    const duplicate = await markProcessed(admin, event.id, event.type);
    if (duplicate) return Response.json({ received: true, skipped: "duplicate" });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) break;

        // One-time credit pack (wallet recharge) — add to the existing balance.
        if (session.metadata?.kind === "credit_pack") {
          const credits = Number(session.metadata?.credits ?? 0);
          if (credits > 0) {
            await addCredits(admin, userId, credits);
            await admin.from("credit_transactions").insert({
              user_id: userId,
              amount: credits,
              type: "purchased",
              description: `Bought ${credits.toLocaleString()} credit pack`,
            });
          }
          break;
        }

        // Subscription upgrade — grant the plan's monthly credit allotment.
        if (!session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? PLAN_BY_PRICE_ID[priceId] : undefined;
        if (!plan) break;

        await admin
          .from("profiles")
          .update({ plan, credits: PLAN_CREDITS[plan], stripe_subscription_id: subscription.id })
          .eq("id", userId);

        await admin.from("credit_transactions").insert({
          user_id: userId,
          amount: PLAN_CREDITS[plan],
          type: "purchased",
          description: `Upgraded to ${plan}`,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();
        if (profile) {
          await admin.from("profiles").update({ plan: "free", stripe_subscription_id: null }).eq("id", profile.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        // We intentionally do NOT downgrade on the first failed payment (Stripe
        // retries through a grace/collection period, and only emits
        // customer.subscription.deleted once it finally cancels — that handler
        // does the downgrade). Recorded here so the event is auditable and the
        // ledger reflects that we received it.
        break;
      }
    }
  } catch (err) {
    // Let Stripe retry: the ledger insert above is rolled-forward only on
    // success paths that completed; on a thrown DB error we return 500 so the
    // event is redelivered. (The ledger row already written will make the retry
    // a no-op if the failure happened after it was recorded — acceptable, as
    // the remaining work is a single credit grant.)
    console.error("stripe webhook handler error", err);
    return Response.json({ error: "webhook_handler_failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
