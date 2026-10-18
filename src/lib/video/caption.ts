import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ffmpeg-static's build has no libfreetype (no `drawtext` filter — verified:
// `ffmpeg -filters` lists overlay/scale/pad/concat/xfade/acrossfade but not
// drawtext), so on-screen text is rendered as a transparent PNG via sharp's
// SVG rasterizer instead, then composited onto the clip with `overlay`. The
// font is base64-embedded directly in the SVG (@font-face data URI) rather
// than referenced by family name, so rendering doesn't depend on whatever
// fonts happen to be installed in the deployment environment.
const FONT_PATH = join(process.cwd(), "assets", "fonts", "Inter-Variable.ttf");

let fontBase64Cache: string | null = null;
async function getFontBase64(): Promise<string> {
  if (!fontBase64Cache) {
    fontBase64Cache = (await readFile(FONT_PATH)).toString("base64");
  }
  return fontBase64Cache;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough sans-serif average character width as a fraction of font size — no text-measurement API is available server-side, so wrapping is estimated rather than exact. */
const AVG_CHAR_WIDTH_RATIO = 0.56;

function wrapText(text: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * AVG_CHAR_WIDTH_RATIO)));
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "…");
  }
  return lines;
}

/**
 * Renders a lower-third caption bar (semi-transparent background + centered
 * bold white text) as a transparent PNG the same width as the target video,
 * ready to overlay with ffmpeg. Returns null for empty/whitespace-only text.
 */
export async function renderCaptionPng(input: {
  text: string;
  videoWidth: number;
  videoHeight: number;
}): Promise<Buffer | null> {
  const text = input.text?.trim();
  if (!text) return null;

  const { videoWidth: width, videoHeight } = input;
  const fontSize = Math.round(videoHeight * 0.032);
  const lineHeight = Math.round(fontSize * 1.35);
  const maxLines = 3;
  const horizontalPadding = Math.round(width * 0.08);
  const lines = wrapText(text, fontSize, width - horizontalPadding * 2, maxLines);

  const verticalPadding = Math.round(fontSize * 0.9);
  const barHeight = lines.length * lineHeight + verticalPadding * 2;
  const fontBase64 = await getFontBase64();

  const textElements = lines
    .map((line, i) => {
      const y = verticalPadding + lineHeight * i + fontSize * 0.85;
      return `<text x="${width / 2}" y="${y}" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("\n");

  const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: "CaptionFont";
        src: url(data:font/ttf;base64,${fontBase64}) format("truetype");
      }
      text {
        font-family: "CaptionFont";
        font-weight: 700;
        font-size: ${fontSize}px;
        fill: #ffffff;
      }
    </style>
  </defs>
  <rect x="0" y="0" width="${width}" height="${barHeight}" fill="#000000" fill-opacity="0.55" />
  ${textElements}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
