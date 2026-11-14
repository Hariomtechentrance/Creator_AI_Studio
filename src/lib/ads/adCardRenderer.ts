import sharp from "sharp";

/**
 * Renders a clean, on-brand ad creative deterministically from text — no
 * AI image model involved. Built after AI-generated creative (Pollinations)
 * repeatedly produced unusable results (blurry, garbled, or disturbing)
 * for this app's ad campaigns. Guaranteed legible, guaranteed on-message.
 */
export async function renderAdCardPng(input: {
  headline: string;
  highlights: string[];
  footerLine?: string;
}): Promise<Buffer> {
  const { headline, highlights, footerLine } = input;

  // Wraps at a width that still fits 1080px after a font-size drop for
  // longer headlines, rather than silently truncating overflow lines.
  const fontSize = headline.length > 70 ? 44 : headline.length > 45 ? 50 : 56;
  const charsPerLine = Math.floor(1080 / (fontSize * 0.62));
  const words = headline.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > charsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const headlineLines = lines.slice(0, 3);
  const lineHeight = fontSize * 1.25;

  const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const headlineSvg = headlineLines
    .map((line, i) => `<text x="540" y="${260 + i * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("\n");

  const pillRows: string[][] = [];
  let row: string[] = [];
  let rowWidth = 0;
  for (const h of highlights.slice(0, 6)) {
    const w = h.length * 15 + 60;
    if (rowWidth + w > 850 && row.length) {
      pillRows.push(row);
      row = [];
      rowWidth = 0;
    }
    row.push(h);
    rowWidth += w + 15;
  }
  if (row.length) pillRows.push(row);

  let pillsSvg = "";
  let pillY = 260 + headlineLines.length * lineHeight + 80;
  for (const r of pillRows) {
    const widths = r.map((h) => h.length * 15 + 60);
    const totalW = widths.reduce((a, b) => a + b, 0) + (r.length - 1) * 15;
    let x = 540 - totalW / 2;
    for (let i = 0; i < r.length; i++) {
      const w = widths[i];
      pillsSvg += `<rect x="${x}" y="${pillY}" width="${w}" height="56" rx="28" fill="#ffffff" opacity="0.12"/>`;
      pillsSvg += `<text x="${x + w / 2}" y="${pillY + 37}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#ffffff" text-anchor="middle">${escapeXml(r[i])}</text>`;
      x += w + 15;
    }
    pillY += 76;
  }

  const svg = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1033"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="920" cy="140" r="220" fill="#7c3aed" opacity="0.22"/>
  <circle cx="120" cy="980" r="260" fill="#a855f7" opacity="0.16"/>
  ${headlineSvg}
  ${pillsSvg}
  ${footerLine ? `<text x="540" y="1000" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#c4b5fd" text-anchor="middle" opacity="0.85">${escapeXml(footerLine)}</text>` : ""}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
