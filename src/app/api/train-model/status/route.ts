import Replicate from "replicate";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * No webhook receiver is registered with Replicate for training completion,
 * so status is checked opportunistically on demand (same pattern as
 * api/automations/check-overdue) rather than pushed in real time.
 */
export async function POST(request: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token || token.startsWith("your_")) {
    return Response.json({ error: "Not configured" }, { status: 400 });
  }

  let body: { modelId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.modelId) {
    return Response.json({ error: "modelId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: model } = await admin
    .from("trained_models")
    .select("*")
    .eq("id", body.modelId)
    .eq("user_id", user.id)
    .single();

  if (!model || !model.replicate_model_id) {
    return Response.json({ error: "Model not found" }, { status: 404 });
  }

  const replicate = new Replicate({ auth: token });
  const training = await replicate.trainings.get(model.replicate_model_id);

  const status = training.status === "succeeded" ? "ready" : training.status === "failed" || training.status === "canceled" ? "failed" : "training";
  if (status !== model.status) {
    await admin.from("trained_models").update({ status }).eq("id", model.id);
  }

  return Response.json({ status });
}
