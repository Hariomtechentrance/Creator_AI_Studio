import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

// ffmpeg-static computes its binary path from `__dirname`, which Turbopack
// rewrites to a bogus placeholder when bundling server routes — resolve it
// from process.cwd() instead, which Next.js always sets to the project root.
const ffmpegPath = join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

export const KEN_BURNS_PRESETS: Record<string, { z: [number, number]; x: [number, number]; y: [number, number] }> = {
  None:          { z: [1.0, 1.15], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Pan Left":    { z: [1.25, 1.25], x: [1.0, 0.0], y: [0.5, 0.5] },
  "Pan Right":   { z: [1.25, 1.25], x: [0.0, 1.0], y: [0.5, 0.5] },
  "Zoom In":     { z: [1.0, 1.35], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Zoom Out":    { z: [1.35, 1.0], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Orbit Left":  { z: [1.15, 1.3], x: [0.85, 0.15], y: [0.5, 0.5] },
  "Orbit Right": { z: [1.15, 1.3], x: [0.15, 0.85], y: [0.5, 0.5] },
  "Tilt Up":     { z: [1.25, 1.25], x: [0.5, 0.5], y: [1.0, 0.0] },
  "Tilt Down":   { z: [1.25, 1.25], x: [0.5, 0.5], y: [0.0, 1.0] },
  "Crane Up":    { z: [1.3, 1.05], x: [0.5, 0.5], y: [0.9, 0.1] },
};

export const KEN_BURNS_CAMERA_NAMES = Object.keys(KEN_BURNS_PRESETS);

/**
 * Fully local, zero-cost provider: applies a Ken Burns pan/zoom effect to an
 * uploaded photo with ffmpeg. No GPU, no external service, no quota — this
 * hardware (4GB VRAM, no CUDA) can't realistically run AI video diffusion
 * models, so this is simulated camera motion on a still photo rather than
 * AI-generated motion, but it's fast and always available.
 */
export async function generateWithKenBurns(image: string, duration: number, camera: string): Promise<string> {
  const preset = KEN_BURNS_PRESETS[camera] ?? KEN_BURNS_PRESETS.None;
  const match = image.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data");

  const fps = 24;
  const clampedDuration = Math.min(10, Math.max(1, duration));
  const frames = fps * clampedDuration;
  const zExpr = `${preset.z[0]}+(${preset.z[1]}-${preset.z[0]})*on/(${frames}-1)`;
  const xExpr = `(${preset.x[0]}+(${preset.x[1]}-${preset.x[0]})*on/(${frames}-1))*(iw-iw/zoom)`;
  const yExpr = `(${preset.y[0]}+(${preset.y[1]}-${preset.y[0]})*on/(${frames}-1))*(ih-ih/zoom)`;
  const filter =
    `scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,` +
    `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=1024x576:fps=${fps}`;

  const id = randomUUID();
  const srcPath = join(tmpdir(), `kb-src-${id}.jpg`);
  const outPath = join(tmpdir(), `kb-out-${id}.mp4`);

  try {
    await writeFile(srcPath, Buffer.from(match[2], "base64"));
    await execFileAsync(ffmpegPath, [
      "-y", "-loop", "1", "-i", srcPath,
      "-vf", filter,
      "-t", String(clampedDuration),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ]);
    const buffer = await readFile(outPath);
    return `data:video/mp4;base64,${buffer.toString("base64")}`;
  } finally {
    await unlink(srcPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
