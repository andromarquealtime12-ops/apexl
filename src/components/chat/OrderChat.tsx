import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateFnsLocale } from "@/i18n/dateLocale";
import { alertDriver } from "@/utils/notificationSound";
import { useTranslation } from "react-i18next";

interface OrderChatProps {
  orderId: string;
  otherUserName?: string;
  compact?: boolean;
}

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export default function OrderChat({ orderId, otherUserName, compact = false }: OrderChatProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["order-chat", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_chat_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!orderId && !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_chat_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["order-chat", orderId] });
          // Play sound if message is from the other person
          if (payload.new && (payload.new as any).sender_id !== user?.id) {
            alertDriver("pickup");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, queryClient, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from("order_chat_messages")
        .insert({
          order_id: orderId,
          sender_id: user!.id,
          message,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["order-chat", orderId] });
    },
  });

  const handleSend = () => {
    const msg = newMessage.trim();
    if (!msg) return;
    sendMessage.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {t("buyerx.chat.chatWith", { name: otherUserName || t("buyerx.chat.participant") })}
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {messages.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : "pt-0"}>
        {/* Messages */}
        <div
          ref={scrollRef}
          className={`space-y-3 overflow-y-auto mb-3 ${compact ? "max-h-[200px]" : "max-h-[300px]"} ${compact ? "p-2" : ""}`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t("buyerx.chat.noMessages")}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {isMe ? "M" : otherUserName?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-2xl px-3 py-2 max-w-[75%] ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm break-words">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: getDateFnsLocale(i18n.language) })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder={t("buyerx.chat.writeMessage")}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
