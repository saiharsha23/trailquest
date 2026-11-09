import { supabase } from "./supabase";

/**
 * Upload an image file to the Supabase 'clues' storage bucket
 * and return the permanent public URL.
 */
export async function uploadClueImage(file: File): Promise<{ url?: string; error?: string }> {
  if (!supabase) return { error: "Database not configured" };

  if (!file.type.startsWith("image/")) {
    return { error: "Please upload an image file (PNG, JPG, WEBP, GIF)" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image size must be under 5MB" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `clue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from("clues").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadErr) {
    return { error: uploadErr.message };
  }

  const { data } = supabase.storage.from("clues").getPublicUrl(path);
  return { url: data.publicUrl };
}

