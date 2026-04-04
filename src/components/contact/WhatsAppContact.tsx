import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface WhatsAppContactProps {
  userId: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  message?: string;
}

export function WhatsAppContact({ userId, label = "WhatsApp", variant = "outline", size = "sm", message }: WhatsAppContactProps) {
  const { data: profile } = useQuery({
    queryKey: ["contact-whatsapp", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp, phone, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const whatsappNumber = profile?.whatsapp || profile?.phone;
  if (!whatsappNumber) return null;

  const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  let url = `https://wa.me/${cleanNumber}`;
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }

  return (
    <Button variant={variant} size={size} className="gap-1.5" asChild>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageSquare className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}
