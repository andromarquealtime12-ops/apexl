import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "identity-documents";

/** Extract the storage object path from a stored value (raw path or full public URL). */
export function extractIdentityDocPath(value: string): string {
  let path = value;
  const marker = `/${BUCKET}/`;
  const idx = path.indexOf(marker);
  if (idx !== -1) path = path.slice(idx + marker.length);
  path = path.replace(/^\/+/, "").replace(new RegExp(`^${BUCKET}/`), "");
  return decodeURIComponent(path.split("?")[0]);
}

/**
 * The identity-documents bucket is private: stored "public" URLs return 404.
 * Always resolve a fresh signed URL for display.
 */
export function useIdentityDocUrl(value?: string | null) {
  return useQuery({
    queryKey: ["identity-doc-url", value],
    queryFn: async () => {
      if (!value) return null;
      const path = extractIdentityDocPath(value);
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!value,
    staleTime: 50 * 60 * 1000,
  });
}
