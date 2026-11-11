import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const ffmpegPath = join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const FONT_PATH = join(process.cwd(), "assets", "fonts", "Inter-Variable.ttf");

let fontBase64Cache: string | null = null;
async function getFontBase64(): Promise<string> {
  if (!fontBase64Cache) fontBase64Cache = (await readFile(FONT_PATH)).toString("base64");
  return fontBase64Cache;
}

function escXml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ContactCardInput {
  orgName: string;
  tagline?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
}

/**
 * Renders a glassmorphism-style branded contact card as a still PNG — the
 * same "end card" convention the reference video closes on (logo, name,
 * tagline, contact details in a glass panel over a brand-color gradient).
 * Returned as an image, not a video, so the caller decides how long to hold
 * it on screen (looped via ffmpeg, same as any other still-photo scene).
 */
export async function renderContactCardPng(input: ContactCardInput, width = 1080, height = 1920): Promise<Buffer> {
  const accent = input.brandColor && /^#[0-9a-fA-F]{6}$/.test(input.brandColor) ? input.brandColor : "#7C3AED";
  const fontBase64 = await getFontBase64();

  let logoEl = "";
  if (input.logoUrl) {
    try {
      const res = await fetch(input.logoUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get("content-type") ?? "image/png";
        const logoSize = Math.round(width * 0.16);
        const logoB64 = buf.toString("base64");
        logoEl = `<image href="data:${mime};base64,${logoB64}" x="${width / 2 - logoSize / 2}" y="${height * 0.3}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />`;
      }
    } catch {
      // Logo fetch failed — fall through to the monogram badge below.
    }
  }
  if (!logoEl) {
    const initial = escXml(input.orgName.trim().charAt(0).toUpperCase() || "?");
    const r = Math.round(width * 0.075);
    logoEl = `
      <circle cx="${width / 2}" cy="${height * 0.3 + r}" r="${r}" fill="${accent}" />
      <text x="${width / 2}" y="${height * 0.3 + r + r * 0.35}" font-family="Inter" font-weight="900" font-size="${r * 1.1}" fill="#ffffff" text-anchor="middle">${initial}</text>`;
  }

  const lines: string[] = [];
  let y = height * 0.58;
  const rowGap = height * 0.042;
  if (input.phone) { lines.push(`<text x="${width * 0.12}" y="${y}" font-family="Inter" font-weight="600" font-size="${width * 0.032}" fill="#1a1a2e">☎  ${escXml(input.phone)}</text>`); y += rowGap; }
  if (input.email) { lines.push(`<text x="${width * 0.12}" y="${y}" font-family="Inter" font-weight="600" font-size="${width * 0.032}" fill="#1a1a2e">✉  ${escXml(input.email)}</text>`); y += rowGap; }
  if (input.website) { lines.push(`<text x="${width * 0.12}" y="${y}" font-family="Inter" font-weight="700" font-size="${width * 0.032}" fill="#1a1a2e">Web:  ${escXml(input.website)}</text>`); y += rowGap; }

  const panelTop = height * 0.56;
  const panelHeight = height * 0.1 + lines.length * rowGap;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>@font-face { font-family: "Inter"; src: url(data:font/ttf;base64,${fontBase64}) format("truetype"); }</style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F0524" /><stop offset="55%" stop-color="${accent}" stop-opacity="0.55" /><stop offset="100%" stop-color="#0F0524" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  ${logoEl}
  <text x="${width / 2}" y="${height * 0.44}" font-family="Inter" font-weight="900" font-size="${width * 0.07}" fill="#ffffff" text-anchor="middle">${escXml(input.orgName)}</text>
  ${input.tagline ? `<text x="${width / 2}" y="${height * 0.48}" font-family="Inter" font-weight="600" font-size="${width * 0.03}" fill="#E5E0F5" text-anchor="middle">${escXml(input.tagline)}</text>` : ""}
  <rect x="${width * 0.08}" y="${panelTop}" width="${width * 0.84}" height="${panelHeight}" rx="${width * 0.04}" fill="#ffffff" fill-opacity="0.92" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2" />
  ${lines.join("\n")}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Loops the still card for `duration` seconds with a very gentle zoom (not a static freeze-frame, matching the subtle motion every other scene has). */
export async function renderContactCardClip(input: ContactCardInput, duration = 4, width = 1080, height = 1920): Promise<Buffer> {
  const png = await renderContactCardPng(input, width, height);
  const id = randomUUID();
  const srcPath = join(tmpdir(), `cc-src-${id}.png`);
  const outPath = join(tmpdir(), `cc-out-${id}.mp4`);
  const { writeFile, unlink } = await import("node:fs/promises");

  try {
    await writeFile(srcPath, png);
    const fps = 24;
    const frames = fps * duration;
    // Subtle 1.0 -> 1.06 zoom — enough to not feel like a frozen slide, not so much it distracts from reading contact details.
    const zExpr = `1.0+(0.06)*on/(${frames}-1)`;
    const filter = `scale=${width * 2}:${height * 2},zoompan=z='${zExpr}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${width}x${height}:fps=${fps}`;
    await execFileAsync(ffmpegPath, ["-y", "-loop", "1", "-i", srcPath, "-vf", filter, "-t", String(duration), "-pix_fmt", "yuv420p", outPath]);
    return await readFile(outPath);
  } finally {
    await unlink(srcPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
