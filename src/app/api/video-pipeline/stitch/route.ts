import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadContentMedia } from "@/lib/supabase/storage";
import { renderCaptionPng } from "@/lib/video/caption";

const execFileAsync = promisify(execFile);

// Same Turbopack __dirname workaround as generate-video/route.ts.
const ffmpegPath = join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

export const maxDuration = 300;

const COST = 5;
const XFADE_DURATION = 0.5;

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "5:4": { width: 1350, height: 1080 },
};

interface StitchClip {
  url: string;
  type: "presenter" | "broll";
  durationSeconds: number;
  onScreenText: string;
  transition: "cut" | "crossfade";
}

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

/**
 * ffmpeg-static ships no ffprobe binary, so duration is read from ffmpeg's
 * own stderr: `ffmpeg -i <file>` with no output always exits non-zero but
 * prints "Duration: HH:MM:SS.ss" for the input — a well-known, reliable
 * trick that avoids bundling a second ~100MB static binary just for this.
 */
async function getMediaDuration(path: string): Promise<number> {
  try {
    await execFileAsync(ffmpegPath, ["-i", path]);
  } catch (err) {
    const stderr = (err as { stderr?: string })?.stderr ?? "";
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const [, h, m, s] = match;
      return Number(h) * 3600 + Number(m) * 60 + Number(s);
    }
  }
  throw new Error("Couldn't determine the duration of a scene clip");
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download a scene clip (${res.status})`);
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
}

/**
 * Scales/pads a clip to the uniform target size, forces a constant 24fps,
 * guarantees an audio stream (synthesizing silence for b-roll clips that
 * have none, so every normalized clip has matching streams for the combine
 * pass), and overlays a caption bar if the scene has on-screen text.
 * Presenter clips are NOT truncated to their planned durationSeconds — v3
 * HeyGen renders are timed by the spoken script, not a requested duration,
 * so cutting to the AI's estimate risks chopping off dialogue mid-word.
 * B-roll clips ARE capped, as a safety net (Replicate already renders them
 * close to the requested length).
 */
async function normalizeClip(input: {
  srcPath: string;
  outPath: string;
  width: number;
  height: number;
  hasAudio: boolean;
  capDuration: number | null;
  captionPngPath: string | null;
}): Promise<void> {
  const { srcPath, outPath, width, height, hasAudio, capDuration, captionPngPath } = input;

  const args = ["-y", "-i", srcPath];
  let nextInputIndex = 1;
  let silentAudioIndex: number | null = null;
  if (!hasAudio) {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    silentAudioIndex = nextInputIndex++;
  }
  let captionIndex: number | null = null;
  if (captionPngPath) {
    args.push("-i", captionPngPath);
    captionIndex = nextInputIndex++;
  }

  const scaleChain = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`;
  const filterParts = [`[0:v]${scaleChain}[scaled]`];
  let finalVideoLabel = "[scaled]";
  if (captionIndex !== null) {
    const overlayY = Math.round(height * 0.78);
    filterParts.push(`[scaled][${captionIndex}:v]overlay=0:${overlayY}[vout]`);
    finalVideoLabel = "[vout]";
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", finalVideoLabel);
  args.push("-map", hasAudio ? "0:a" : `${silentAudioIndex}:a`);
  args.push("-shortest");
  if (capDuration != null) args.push("-t", String(capDuration));
  args.push(
    "-c:v", "libx264",
    "-c:a", "aac",
    "-ar", "44100",
    "-ac", "2",
    "-pix_fmt", "yuv420p",
    "-hide_banner", "-loglevel", "error",
    outPath,
  );

  await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 20 });
}

async function combineClips(clips: { path: string; duration: number; transition: "cut" | "crossfade" }[], outPath: string): Promise<void> {
  if (clips.length === 1) {
    await execFileAsync(ffmpegPath, ["-y", "-i", clips[0].path, "-c", "copy", "-hide_banner", "-loglevel", "error", outPath]);
    return;
  }

  const args = ["-y"];
  clips.forEach((c) => args.push("-i", c.path));

  const filterParts: string[] = [];
  let curV = "[0:v]";
  let curA = "[0:a]";
  let cumulative = clips[0].duration;

  for (let i = 1; i < clips.length; i++) {
    const clip = clips[i];
    const nextV = `[${i}:v]`;
    const nextA = `[${i}:a]`;
    const outV = `[v${i}]`;
    const outA = `[a${i}]`;
    const useCrossfade = clip.transition === "crossfade" && cumulative > XFADE_DURATION;

    if (useCrossfade) {
      const offset = Math.max(0, cumulative - XFADE_DURATION);
      filterParts.push(`${curV}${nextV}xfade=transition=fade:duration=${XFADE_DURATION}:offset=${offset.toFixed(2)}${outV}`);
      filterParts.push(`${curA}${nextA}acrossfade=d=${XFADE_DURATION}${outA}`);
      cumulative = cumulative + clip.duration - XFADE_DURATION;
    } else {
      filterParts.push(`${curV}${curA}${nextV}${nextA}concat=n=2:v=1:a=1${outV}${outA}`);
      cumulative = cumulative + clip.duration;
    }
    curV = outV;
    curA = outA;
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", curV, "-map", curA);
  args.push("-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-hide_banner", "-loglevel", "error", outPath);

  await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 20 });
}

export async function POST(request: NextRequest) {
  let body: { clips?: StitchClip[]; aspectRatio?: string; orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { clips, orgId } = body;
  const dims = ASPECT_DIMENSIONS[body.aspectRatio ?? "9:16"] ?? ASPECT_DIMENSIONS["9:16"];
  if (!clips?.length) return Response.json({ error: "At least one clip is required" }, { status: 400 });

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to stitch a video" }, { status: 401 });
    userId = user.id;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
    creditsBefore = profile.credits;
    if (creditsBefore < COST) {
      return Response.json({ error: `Not enough credits — this needs ${COST}, you have ${creditsBefore}` }, { status: 402 });
    }

    if (orgId) {
      const { data: membership } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }
  }
  if (!orgId) return Response.json({ error: "orgId is required" }, { status: 400 });

  const runId = randomUUID();
  const tempPaths: string[] = [];

  try {
    // Download + normalize every clip in parallel — each is an independent
    // ffmpeg invocation, so there's no reason to serialize them within the
    // route's 300s budget.
    const normalized = await Promise.all(
      clips.map(async (clip, i) => {
        const srcPath = join(tmpdir(), `stitch-src-${runId}-${i}.mp4`);
        const outPath = join(tmpdir(), `stitch-norm-${runId}-${i}.mp4`);
        tempPaths.push(srcPath, outPath);

        await downloadToFile(clip.url, srcPath);

        let captionPngPath: string | null = null;
        const captionPng = await renderCaptionPng({ text: clip.onScreenText, videoWidth: dims.width, videoHeight: dims.height });
        if (captionPng) {
          captionPngPath = join(tmpdir(), `stitch-caption-${runId}-${i}.png`);
          await writeFile(captionPngPath, captionPng);
          tempPaths.push(captionPngPath);
        }

        const hasAudio = clip.type === "presenter";
        await normalizeClip({
          srcPath,
          outPath,
          width: dims.width,
          height: dims.height,
          hasAudio,
          capDuration: hasAudio ? null : clip.durationSeconds,
          captionPngPath,
        });

        const duration = await getMediaDuration(outPath);
        return { path: outPath, duration, transition: clip.transition };
      }),
    );

    const finalPath = join(tmpdir(), `stitch-final-${runId}.mp4`);
    tempPaths.push(finalPath);
    await combineClips(normalized, finalPath);

    const finalBuffer = await readFile(finalPath);

    if (!authEnabled) throw new Error("Storage isn't configured — can't save the stitched video");
    const admin = createAdminClient();

    const { url, error: uploadError } = await uploadContentMedia(admin, orgId, finalBuffer, "video/mp4", "mp4");
    if (uploadError || !url) throw new Error(uploadError ?? "Upload failed");

    if (userId) {
      await admin.from("profiles").update({ credits: creditsBefore - COST }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "video_stitch",
        prompt: `Stitched ${clips.length} scenes`,
        model: "ffmpeg",
        status: "completed",
        output_urls: [url],
        settings: { sceneCount: clips.length, aspectRatio: body.aspectRatio ?? "9:16" },
        credits_used: COST,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -COST,
        type: "spent",
        description: "AI Video Pipeline — scene stitching",
      });
    }

    return Response.json({ videoUrl: url, creditsUsed: COST });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video stitching failed";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    await Promise.all(tempPaths.map((p) => unlink(p).catch(() => {})));
  }
}
