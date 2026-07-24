import { useState, useRef, useEffect } from "react";
import { useReturnMessages, useSendReturnMessage } from "@/hooks/useReturns";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ReturnChatProps {
  returnId: string;
}

function SignedImage({ value }: { value: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Legacy messages may already contain a full URL — render it as-is.
    if (/^https?:\/\//i.test(value)) {
      setUrl(value);
      return;
    }
    const path = value.replace(/^storage:\/\/return-photos\//, "");
    supabase.storage
      .from("return-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (!url) return null;
  return <img src={url} alt="Photo" className="rounded mb-1 max-h-32 w-auto" />;
}

export default function ReturnChat({ returnId }: ReturnChatProps) {
  const { user } = useAuth();
  const { data: messages, isLoading } = useReturnMessages(returnId);
  const sendMessage = useSendReturnMessage();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage.mutateAsync({ returnId, message: text.trim() });
    setText("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${returnId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("return-photos").upload(path, file);
      if (uploadError) throw uploadError;

      // Store the storage path only — bucket is private, signed URLs generated at render.
      await sendMessage.mutateAsync({ returnId, imageUrl: path, message: "📷 Photo envoyée" });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 text-sm font-medium">
        💬 Communication retour
      </div>

      <ScrollArea className="h-48 p-3" ref={scrollRef}>
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center">Chargement...</p>
        ) : messages?.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun message. Envoyez des photos ou messages concernant le retour.
          </p>
        ) : (
          <div className="space-y-2">
            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === user?.id ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.sender_id === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  {msg.image_url && <SignedImage value={msg.image_url} />}
                  {msg.message && <p>{msg.message}</p>}
                  <p className="text-[10px] opacity-60 mt-1">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-2 flex gap-2">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageUpload}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Button>
        <Input
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!text.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
