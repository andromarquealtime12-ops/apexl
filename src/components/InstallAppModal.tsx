import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Listen globally
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

const InstallAppModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else setPlatform("desktop");
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      deferredPrompt = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Installer Ayiti Marché
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <img src="/icons/icon-192x192.png" alt="Ayiti Marché" className="w-24 h-24 rounded-2xl shadow-lg" />

          {installed ? (
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <p className="text-lg font-semibold text-foreground">Application installée !</p>
              <p className="text-sm text-muted-foreground">Retrouvez Ayiti Marché sur votre écran d'accueil.</p>
            </div>
          ) : platform === "ios" ? (
            <div className="space-y-4 w-full">
              <p className="text-sm text-muted-foreground text-center">
                Sur iPhone/iPad, suivez ces étapes :
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="font-medium text-foreground">Ouvrir dans Safari</p>
                    <p className="text-xs text-muted-foreground">Cette page doit être ouverte dans Safari (pas Chrome ou autre)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">2</div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">Appuyez sur</p>
                    <Share className="h-5 w-5 text-primary" />
                    <p className="font-medium text-foreground">(Partager)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">3</div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">Choisissez</p>
                    <Plus className="h-5 w-5 text-primary" />
                    <p className="font-medium text-foreground">"Sur l'écran d'accueil"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">4</div>
                  <div>
                    <p className="font-medium text-foreground">Appuyez "Ajouter"</p>
                    <p className="text-xs text-muted-foreground">L'app apparaîtra sur votre écran d'accueil</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 w-full text-center">
              <p className="text-sm text-muted-foreground">
                Installez l'application pour un accès rapide depuis votre écran d'accueil.
              </p>
              {deferredPrompt ? (
                <Button onClick={handleInstall} size="lg" className="w-full text-lg py-6">
                  <Download className="h-5 w-5 mr-2" />
                  Installer maintenant
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Ouvrez le menu de votre navigateur (⋮) puis sélectionnez <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong>.
                  </p>
                  <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Menu ⋮ → Installer l'application</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallAppModal;
