import sharp from "sharp";

export interface PbrMapSet {
  diffuse: Buffer;
  height: Buffer;
  normal: Buffer;
  roughness: Buffer;
  ao: Buffer;
  metallic: Buffer;
}

const SIZE = 1024;

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/**
 * Derives normal/height/roughness/AO maps from a single diffuse image via
 * deterministic image processing — not a second AI model call. There's no
 * verified, stable Replicate model for single-image PBR material
 * estimation to depend on, so this uses the same technique real-time
 * texture tools use for "fake" normal/AO from a photo:
 *   - height  = grayscale luminance of the diffuse map
 *   - normal  = Sobel-gradient-of-height, encoded as a standard tangent-space normal map
 *   - roughness = local high-frequency detail (|pixel - blurred|), more detail → rougher
 *   - AO      = darkened where a pixel is darker than its local neighborhood average (cheap cavity approximation)
 * These are real, always-reproducible derivations from actual pixel data —
 * not fabricated placeholder images — but they're heuristics, not measured
 * material properties, and metallic can't be derived from a single photo at
 * all (see metallic map below).
 */
export async function derivePbrMaps(diffuseBuffer: Buffer): Promise<PbrMapSet> {
  const diffuseResized = await sharp(diffuseBuffer).resize(SIZE, SIZE, { fit: "cover" }).png().toBuffer();

  const { data: gray, info } = await sharp(diffuseResized)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const heightBuffer = await sharp(gray, { raw: { width, height, channels: 1 } }).png().toBuffer();

  const normalBuffer = await buildNormalMap(gray, width, height);
  const roughnessBuffer = await buildRoughnessMap(gray, width, height);
  const aoBuffer = await buildAoMap(gray, width, height);
  const metallicBuffer = await sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer();

  return { diffuse: diffuseResized, height: heightBuffer, normal: normalBuffer, roughness: roughnessBuffer, ao: aoBuffer, metallic: metallicBuffer };
}

function at(gray: Buffer, w: number, h: number, x: number, y: number): number {
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(h - 1, y));
  return gray[cy * w + cx];
}

async function buildNormalMap(gray: Buffer, w: number, h: number): Promise<Buffer> {
  const out = Buffer.alloc(w * h * 3);
  const strength = 2.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sobel gradient
      const gx =
        -at(gray, w, h, x - 1, y - 1) - 2 * at(gray, w, h, x - 1, y) - at(gray, w, h, x - 1, y + 1) +
        at(gray, w, h, x + 1, y - 1) + 2 * at(gray, w, h, x + 1, y) + at(gray, w, h, x + 1, y + 1);
      const gy =
        -at(gray, w, h, x - 1, y - 1) - 2 * at(gray, w, h, x, y - 1) - at(gray, w, h, x + 1, y - 1) +
        at(gray, w, h, x - 1, y + 1) + 2 * at(gray, w, h, x, y + 1) + at(gray, w, h, x + 1, y + 1);

      const dx = (gx / 255) * strength;
      const dy = (gy / 255) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx / len, ny = -dy / len, nz = 1 / len;

      const idx = (y * w + x) * 3;
      out[idx] = clamp255((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = clamp255((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = clamp255((nz * 0.5 + 0.5) * 255);
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

/**
 * sharp's .blur() on a single-channel raw buffer silently upconverts to
 * 3-channel RGB output (libvips colorspace behavior, not documented) —
 * .toColourspace("b-w") forces it back to the 1-channel buffer the caller
 * expects. Verified via a standalone round-trip test; without this the
 * blurred buffer is 3x the expected length and every subsequent per-pixel
 * index into it reads the wrong byte, silently corrupting the output.
 */
async function blurGrayscale(gray: Buffer, w: number, h: number, sigma: number): Promise<Buffer> {
  return sharp(gray, { raw: { width: w, height: h, channels: 1 } })
    .blur(sigma)
    .toColourspace("b-w")
    .raw()
    .toBuffer();
}

async function buildRoughnessMap(gray: Buffer, w: number, h: number): Promise<Buffer> {
  const blurred = await blurGrayscale(gray, w, h, 6);
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const diff = Math.abs(gray[i] - blurred[i]) * 4;
    // Base roughness of 90 (mostly rough) with detail areas pushing higher —
    // a photo's high-frequency texture reads as "more micro-surface detail".
    out[i] = clamp255(90 + diff);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

async function buildAoMap(gray: Buffer, w: number, h: number): Promise<Buffer> {
  const blurred = await blurGrayscale(gray, w, h, 12);
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    // Where a pixel is darker than its local neighborhood average, treat it
    // as a crevice and darken further; otherwise leave near-white (unoccluded).
    const localDarkening = Math.max(0, blurred[i] - gray[i]) * 1.5;
    out[i] = clamp255(255 - localDarkening);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}
