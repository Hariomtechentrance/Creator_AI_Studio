import Replicate from "replicate";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function isConfigured(val: string | undefined): val is string {
  return !!val && !val.startsWith("your_");
}

export function isTrainingConfigured(): boolean {
  return isConfigured(process.env.REPLICATE_API_TOKEN) && isConfigured(process.env.REPLICATE_USERNAME);
}

/**
 * Zips the uploaded training images (downloaded from the private
 * `training-images` bucket via the admin client), re-uploads the zip to the
 * same bucket, and returns a short-lived signed URL Replicate can fetch it
 * from — Replicate's training API needs a public(-ish) URL to a zip, not
 * individual file uploads.
 */
async function buildTrainingZipUrl(
  admin: SupabaseClient<Database>,
  userId: string,
  modelId: string,
  imagePaths: string[],
): Promise<string> {
  const zip = new JSZip();

  for (const [i, path] of imagePaths.entries()) {
    const { data, error } = await admin.storage.from("training-images").download(path);
    if (error || !data) throw new Error(`Couldn't read uploaded image ${i + 1}: ${error?.message ?? "not found"}`);
    zip.file(`${i}.${path.split(".").pop() ?? "jpg"}`, await data.arrayBuffer());
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const zipPath = `${userId}/${modelId}/training-set.zip`;
  const { error: uploadError } = await admin.storage.from("training-images").upload(zipPath, zipBuffer, {
    contentType: "application/zip",
    upsert: true,
  });
  if (uploadError) throw new Error(`Couldn't prepare training zip: ${uploadError.message}`);

  const { data: signed, error: signError } = await admin.storage.from("training-images").createSignedUrl(zipPath, 3600);
  if (signError || !signed) throw new Error(`Couldn't sign training zip URL: ${signError?.message ?? "unknown error"}`);

  return signed.signedUrl;
}

/**
 * Starts a Flux LoRA training run via `ostris/flux-dev-lora-trainer`. This
 * trainer is a well-known, actively maintained Replicate model, but its
 * exact version hash rotates — rather than hardcode one (which would go
 * stale), this resolves `latest_version` dynamically at call time, which is
 * Replicate's documented way to avoid pinning a brittle version id.
 * Destination model creation is idempotent (ignores "already exists").
 */
export async function startLoraTraining(
  admin: SupabaseClient<Database>,
  input: {
    userId: string;
    modelId: string;
    modelSlug: string;
    imagePaths: string[];
    triggerWord: string;
  },
): Promise<{ trainingId: string; status: string }> {
  const token = process.env.REPLICATE_API_TOKEN as string;
  const owner = process.env.REPLICATE_USERNAME as string;
  const replicate = new Replicate({ auth: token });

  const zipUrl = await buildTrainingZipUrl(admin, input.userId, input.modelId, input.imagePaths);

  try {
    await replicate.models.create(owner, input.modelSlug, {
      visibility: "private",
      hardware: "gpu-t4",
      description: `LoRA trained via GrowthPilot — trigger word ${input.triggerWord}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.toLowerCase().includes("already exists")) throw err;
  }

  const trainer = await replicate.models.get("ostris", "flux-dev-lora-trainer");
  const versionId = trainer.latest_version?.id;
  if (!versionId) throw new Error("Couldn't resolve the trainer model's latest version from Replicate");

  const training = await replicate.trainings.create("ostris", "flux-dev-lora-trainer", versionId, {
    destination: `${owner}/${input.modelSlug}` as `${string}/${string}`,
    input: {
      input_images: zipUrl,
      trigger_word: input.triggerWord,
      steps: 1000,
    },
  });

  return { trainingId: training.id, status: training.status };
}
