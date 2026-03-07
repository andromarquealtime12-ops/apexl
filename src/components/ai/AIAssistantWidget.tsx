import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Bot, Send, Trash2, Sparkles, User, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import ReactMarkdown from "react-markdown";

export default function AIAssistantWidget() {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, clearMessages, getUserType } = useAIAssistant();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const userType = getUserType();
  const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: "Admin", color: "bg-destructive text-destructive-foreground" },
    vendeur: { label: "Vendeur", color: "bg-primary text-primary-foreground" },
    livreur: { label: "Livreur", color: "bg-accent text-accent-foreground" },
    acheteur: { label: "Acheteur", color: "bg-secondary text-secondary-foreground" },
  };

  const role = roleLabels[userType] || roleLabels.acheteur;

  if (!user) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-to-br from-primary to-accent hover:shadow-xl transition-all"
          size="icon"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[480px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-primary to-accent p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              Assistant IA
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Badge className={role.color} variant="secondary">
                {role.label}
              </Badge>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearMessages}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-semibold text-foreground mb-1">Bonjou! Mwen la pou ede w 👋</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {userType === "vendeur" && "Comment gérer vos produits, commandes ou retraits ?"}
                  {userType === "livreur" && "Besoin d'aide avec vos livraisons ou codes de vérification ?"}
                  {userType === "admin" && "Analyse de signalements, gestion des utilisateurs..."}
                  {userType === "acheteur" && "Recherche de produits, suivi de commandes, ou autre ?"}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {userType === "acheteur" && (
                    <>
                      <SuggestionChip onClick={() => { setInput("Comment recharger mon portefeuille ?"); }} text="💰 Recharger portefeuille" />
                      <SuggestionChip onClick={() => { setInput("Comment suivre ma commande ?"); }} text="📦 Suivre commande" />
                    </>
                  )}
                  {userType === "vendeur" && (
                    <>
                      <SuggestionChip onClick={() => { setInput("Comment ajouter un produit ?"); }} text="🛍️ Ajouter produit" />
                      <SuggestionChip onClick={() => { setInput("Comment retirer mes gains ?"); }} text="💸 Retirer gains" />
                    </>
                  )}
                  {userType === "livreur" && (
                    <>
                      <SuggestionChip onClick={() => { setInput("Comment fonctionne la vérification ?"); }} text="🔐 Vérification" />
                      <SuggestionChip onClick={() => { setInput("Comment voir les livraisons disponibles ?"); }} text="📋 Livraisons dispo" />
                    </>
                  )}
                  {userType === "admin" && (
                    <>
                      <SuggestionChip onClick={() => { setInput("Comment analyser un signalement ?"); }} text="🚨 Analyser signalement" />
                      <SuggestionChip onClick={() => { setInput("Comment vérifier un vendeur suspect ?"); }} text="🔍 Vérifier vendeur" />
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="bg-gradient-to-br from-primary to-accent p-1 rounded-full">
                      <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-1 [&>p:last-child]:mb-0 [&>ul]:mb-1 [&>ol]:mb-1">
                      <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="bg-secondary p-1 rounded-full">
                      <User className="h-3.5 w-3.5 text-secondary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2 items-center">
                <div className="bg-gradient-to-br from-primary to-accent p-1 rounded-full">
                  <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              placeholder="Écrivez votre message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={isLoading}
              className="rounded-full"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="rounded-full flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-foreground"
    >
      {text}
    </button>
  );
}
