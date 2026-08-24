import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";

/** Upload a profile / shop photo into the user-scoped product-images folder. */
export async function uploadProfilePhoto(userId: string, file: File, kind = "avatar") {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

interface AvatarUploadFieldProps {
  userId: string | undefined;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  kind?: string;
}

export function AvatarUploadField({
  userId,
  value,
  onChange,
  label,
  hint,
  required,
  kind = "avatar",
}: AvatarUploadFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    if (!userId) return;
    setBusy(true);
    try {
      const url = await uploadProfilePhoto(userId, file, kind);
      onChange(url);
      toast.success(t("photoUpload.uploaded", "Photo enregistrée"));
    } catch (e: any) {
      toast.error(e?.message || t("photoUpload.error", "Échec du téléversement"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        {label || t("photoUpload.label", "Photo de profil")} {required ? "*" : ""}
      </Label>
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative h-24 w-24 rounded-full overflow-hidden border">
            <img src={value} alt={label || "profile"} className="h-full w-full object-cover" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-0 right-0 h-6 w-6"
              onClick={() => onChange(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-24 w-24 rounded-full border-dashed flex-col gap-1"
            disabled={busy || !userId}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-[10px] leading-tight">
              {busy ? t("photoUpload.uploading", "Envoi...") : t("photoUpload.add", "Ajouter")}
            </span>
          </Button>
        )}
        <p className="text-xs text-muted-foreground flex-1">
          {hint || t("photoUpload.hint", "Une photo claire est obligatoire pour être visible dans l'application.")}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
        }}
      />
    </div>
  );
}
