import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient, isStripeConfigured, findCreditPack } from "@/lib/stripe";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to upgrade your plan" }, { status: 400 });
  }
  if (!isStripeConfigured()) {
    return Response.json({ error: "Billing isn't configured yet — add STRIPE_SECRET_KEY and price IDs to .env.local" }, { status: 400 });
  }

  let body: { priceId?: string; packId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.priceId && !body.packId) {
    return Response.json({ error: "priceId or packId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: profile.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // One-time credit pack (wallet recharge): `payment` mode with inline
    // price_data so no pre-created Stripe Price is needed. The credit amount
    // is carried in metadata and trusted only because it's set server-side.
    if (body.packId) {
      const pack = findCreditPack(body.packId);
      if (!pack) {
        return Response.json({ error: "Unknown credit pack" }, { status: 400 });
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: pack.currency,
              unit_amount: pack.amountCents,
              product_data: { name: `${pack.credits.toLocaleString()} CreatorAI credits` },
            },
          },
        ],
        success_url: `${appUrl}/pricing?checkout=success&kind=pack`,
        cancel_url: `${appUrl}/pricing?checkout=cancelled`,
        metadata: { userId: user.id, kind: "credit_pack", credits: String(pack.credits), packId: pack.id },
      });
      return Response.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: `${appUrl}/pricing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: { userId: user.id },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't start checkout";
    return Response.json({ error: message }, { status: 500 });
  }
}
