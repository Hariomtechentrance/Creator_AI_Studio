import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient, isStripeConfigured, PLAN_BY_PRICE_ID } from "@/lib/stripe";

const PLAN_CREDITS: Record<string, number> = { apprentice: 8500, artisan: 25000, maestro: 60000 };

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? PLAN_BY_PRICE_ID[priceId] : undefined;
      if (!plan) break;

      await admin
        .from("profiles")
        .update({
          plan,
          credits: PLAN_CREDITS[plan],
          stripe_subscription_id: subscription.id,
        })
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
  }

  return Response.json({ received: true });
}
