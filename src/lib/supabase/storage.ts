import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function uploadBrandLogo(
  supabase: SupabaseClient<Database>,
  orgId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${orgId}/logo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("brand-logos").upload(path, file, { upsert: true });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function uploadTrainingImages(
  supabase: SupabaseClient<Database>,
  userId: string,
  modelId: string,
  files: File[],
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${modelId}/${i}.${ext}`;
    const { error } = await supabase.storage.from("training-images").upload(path, file, { upsert: true });
    if (error) return { paths, error: error.message };
    paths.push(path);
  }
  return { paths, error: null };
}

export async function uploadContentMedia(
  supabase: SupabaseClient<Database>,
  orgId: string,
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<{ url: string | null; error: string | null }> {
  const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("content-media").upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("content-media").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function getTrainingImageSignedUrls(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<string[]> {
  const { data } = await supabase.storage.from("training-images").createSignedUrls(paths, 3600);
  return (data ?? []).map((d) => d.signedUrl).filter((url): url is string => !!url);
}
