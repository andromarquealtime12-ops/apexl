import { supabase } from "@/integrations/supabase/client";

/**
 * Upload an application document (identity, license, registration) to the
 * `identity-documents` bucket, scoped to the user id, and return the public URL.
 * File names are randomised so re-uploads never collide.
 */
export async function uploadApplicationDocument(
  userId: string,
  kind: string,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("identity-documents")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("identity-documents").getPublicUrl(path);
  return data.publicUrl;
}
