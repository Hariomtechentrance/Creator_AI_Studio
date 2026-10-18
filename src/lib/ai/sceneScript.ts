import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";
import { getContentCategory } from "@/lib/ai/contentCategories";

export interface VideoScene {
  sceneNumber: number;
  type: "presenter" | "broll";
  /** Only meaningful when type is "broll" — marks this as a shot of the user's real uploaded product photo (image-to-video) rather than a purely AI-imagined visual. */
  featuresProduct: boolean;
  cameraMovement: string;
  presenterMovement: string;
  dialogue: string;
  visualPrompt: string;
  onScreenText: string;
  transition: "cut" | "crossfade";
  durationSeconds: number;
}

const SCENE_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          type: { type: "string", enum: ["presenter", "broll"] },
          featuresProduct: { type: "boolean" },
          cameraMovement: { type: "string" },
          presenterMovement: { type: "string" },
          dialogue: { type: "string" },
          visualPrompt: { type: "string" },
          onScreenText: { type: "string" },
          transition: { type: "string", enum: ["cut", "crossfade"] },
          durationSeconds: { type: "integer" },
        },
        required: [
          "sceneNumber",
          "type",
          "featuresProduct",
          "cameraMovement",
          "presenterMovement",
          "dialogue",
          "visualPrompt",
          "onScreenText",
          "transition",
          "durationSeconds",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["scenes"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a video director breaking a short social ad/reel down into an exact, copy-paste-ready shot list for an Indian SMB.

Produce 4-8 scenes whose durations sum to 30-90 seconds. For each scene give:
- type: "presenter" if a spokesperson is talking to camera in this scene, "broll" if it's cutaway footage with no spokesperson (product shots, lifestyle footage, text-only moments).
- featuresProduct: true only for a "broll" scene that should show the brand's REAL product (from a photo the user provides) rather than an AI-imagined visual — e.g. a clean product shot, a close-up of it in use, a detail shot. Always false for "presenter" scenes. Use it for the scenes where seeing the actual real product matters most; not every broll scene needs it.
- cameraMovement: a short, concrete instruction (e.g. "slow push-in", "static wide shot", "pan left to right", "handheld follow").
- presenterMovement: what the presenter physically does (e.g. "stands centered, gestures toward product on the table"). Use an empty string for broll scenes.
- dialogue: the EXACT words spoken in this scene, word for word, ready to read aloud. Empty string for broll scenes with no voiceover.
- visualPrompt: a vivid, concrete description of what's on screen — used directly as an AI video-generation prompt for broll scenes (or, when featuresProduct is true, as the camera-motion/framing instruction applied to the real product photo), and as scene-setting context for presenter scenes.
- onScreenText: short on-screen caption/lower-third text for this scene (can be empty string if none).
- transition: "cut" or "crossfade" — how this scene transitions FROM the previous one (first scene is always "cut").
- durationSeconds: an integer between 3 and 12.

Rules:
- At least one scene must be type "presenter" with real dialogue — this is a spokesperson-led ad, not pure b-roll.
- Mark a scene "broll" only when there is genuinely no presenter in frame.
- Never invent pricing, guarantees, stats, or client testimonials that weren't given.
- If brand banned_words are given, never use them. If approved_keywords are given, prefer working them in naturally.
- Keep dialogue conversational and spoken, not written marketing copy.
- Follow the given content format's structural convention for how the scenes are ordered and paced.`;

export async function generateSceneScript(input: {
  topic: string;
  brandProfile: BrandProfile | null;
  numScenes?: number;
  categoryId?: string;
}): Promise<VideoScene[]> {
  const { topic, brandProfile, numScenes } = input;
  const category = getContentCategory(input.categoryId);

  const userContent = JSON.stringify(
    {
      topic,
      preferredSceneCount: numScenes,
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
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SCENE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no scene breakdown");
  }

  const parsed = JSON.parse(textBlock.text) as { scenes: VideoScene[] };
  return parsed.scenes;
}
