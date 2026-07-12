export interface ImageModel {
  id: string;
  name: string;
  badge: string;
  cost: number;
  desc: string;
}

export const IMAGE_MODELS: ImageModel[] = [
  { id: "flux-pro", name: "Flux Pro 1.1", badge: "Best", cost: 8, desc: "Highest quality, photorealistic" },
  { id: "flux-dev", name: "Flux Dev", badge: "Fast", cost: 5, desc: "Great quality, faster generation" },
  { id: "sdxl", name: "SDXL 1.0", badge: "Free", cost: 3, desc: "Classic, versatile model" },
  { id: "flux-schnell", name: "Flux Schnell", badge: "Fastest", cost: 1, desc: "Ultra-fast, great for drafts" },
  { id: "ideogram", name: "Ideogram 2.0", badge: "Text", cost: 6, desc: "Best for text in images" },
  { id: "stable-cascade", name: "Stable Cascade", badge: "New", cost: 4, desc: "High detail, sharp edges" },
];

export const IMAGE_MODEL_COST: Record<string, number> = Object.fromEntries(
  IMAGE_MODELS.map((m) => [m.id, m.cost]),
);

export const DEFAULT_IMAGE_MODEL_COST = 5;
