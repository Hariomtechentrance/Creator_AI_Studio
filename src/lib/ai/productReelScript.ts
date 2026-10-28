import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";
import { getContentCategory } from "@/lib/ai/contentCategories";
import { KEN_BURNS_CAMERA_NAMES } from "@/lib/video/kenBurns";

export interface ProductReelScene {
  sceneNumber: number;
  camera: string;
  visualPrompt: string;
  onScreenText: string;
  durationSeconds: number;
}

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          camera: { type: "string", enum: KEN_BURNS_CAMERA_NAMES },
          visualPrompt: { type: "string" },
          onScreenText: { type: "string" },
          durationSeconds: { type: "integer" },
        },
        required: ["sceneNumber", "camera", "visualPrompt", "onScreenText", "durationSeconds"],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are directing a short, presenter-free product reel made entirely from the brand's own product photos — one scene per photo, each photo animated with simple camera motion (pan/zoom/tilt), no spokesperson, no AI-generated footage.

For each photo (in the order given) produce exactly one scene with:
- camera: pick the single best camera movement for THAT photo/feature from the allowed list only.
- visualPrompt: a vivid, concrete description of cinematic motion to apply to THIS exact photo for a premium AI video model (e.g. "the product slowly rotates on a reflective dark surface, dramatic rim lighting, subtle light flares drifting across frame" or "camera glides in close on the fabric texture as soft studio light sweeps across it, slow motion"). Describe motion/atmosphere only — never invent new objects, text, logos, or change the product itself from what's in the photo.
- onScreenText: a short, punchy on-screen text callout (3-8 words) naming or selling the specific feature/benefit that photo shows — this is the only "voice" the video has, so make it count (e.g. "Waterproof up to 50m", "Handmade in small batches", "30-day money-back guarantee").
- durationSeconds: an integer between 3 and 6, so the whole reel lands in the 20-30 second range across all scenes.

Rules:
- Exactly one scene per photo, same order as given, numbered from 1.
- Never invent pricing, stats, guarantees, or claims that weren't given in the topic/brief or brand info.
- If brand banned_words are given, never use them. If approved_keywords are given, prefer working them in naturally.
- Vary the camera movement across scenes — don't repeat the same one back to back unless there are only one or two photos.
- Follow the given content format's structural convention for ordering/pacing (e.g. which feature leads, which closes).`;

export async function generateProductReelScenes(input: {
  topic: string;
  brandProfile: BrandProfile | null;
  categoryId?: string;
  numPhotos: number;
}): Promise<ProductReelScene[]> {
  const { topic, brandProfile, numPhotos } = input;
  const category = getContentCategory(input.categoryId);

  const userContent = JSON.stringify(
    {
      topic,
      numPhotos,
      contentFormat: { name: category.label, structuralConvention: category.promptHint },
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            target_audience: brandProfile.target_audience,
            unique_selling_points: brandProfile.unique_selling_points,
            approved_keywords: brandProfile.approved_keywords,
            banned_words: brandProfile.banned_words,
          }
        : null,
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SCENE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no scene breakdown");
  }

  const parsed = JSON.parse(textBlock.text) as { scenes: ProductReelScene[] };
  return parsed.scenes.slice(0, numPhotos);
}
