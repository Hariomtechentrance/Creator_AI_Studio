import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startLoraTraining, isTrainingConfigured } from "@/lib/replicate/training";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)}-${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to train a model" }, { status: 400 });
  }
  if (!isTrainingConfigured()) {
    return Response.json({ error: "Model training needs REPLICATE_API_TOKEN and REPLICATE_USERNAME configured in .env.local" }, { status: 400 });
  }

  let body: { name?: string; triggerWord?: string; description?: string; imagePaths?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, triggerWord, description, imagePaths } = body;
  if (!name?.trim() || !triggerWord?.trim() || !imagePaths || imagePaths.length < 10) {
    return Response.json({ error: "name, triggerWord, and at least 10 uploaded images are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const admin = createAdminClient();
  const slug = slugify(name);

  const { data: model, error: insertError } = await admin
    .from("trained_models")
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() || null,
      trigger_word: triggerWord.trim().toUpperCase(),
      replicate_model_id: null,
      status: "training",
      thumbnail_url: null,
    })
    .select("*")
    .single();

  if (insertError || !model) {
    return Response.json({ error: insertError?.message ?? "Couldn't create the model record" }, { status: 500 });
  }

  try {
    const { trainingId } = await startLoraTraining(admin, {
      userId: user.id,
      modelId: model.id,
      modelSlug: slug,
      imagePaths,
      triggerWord: model.trigger_word,
    });

    await admin.from("trained_models").update({ replicate_model_id: trainingId }).eq("id", model.id);

    return Response.json({ model: { ...model, replicate_model_id: trainingId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Training failed to start";
    await admin.from("trained_models").update({ status: "failed" }).eq("id", model.id);
    return Response.json({ error: message }, { status: 500 });
  }
}
