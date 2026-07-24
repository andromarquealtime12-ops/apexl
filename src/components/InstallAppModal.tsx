import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Smartphone, Chrome, Globe } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Global store for the deferred prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

function useDeferredPrompt() {
  const [ready, setReady] = useState(!!deferredPrompt);

  useEffect(() => {
    const handler = () => setReady(!!deferredPrompt);
    listeners.add(handler);
    // Check immediately in case prompt already captured
    handler();
    return () => { listeners.delete(handler); };
  }, []);

  return { ready, prompt: deferredPrompt };
}

const InstallAppModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [installed, setInstalled] = useState(false);
  const { ready } = useDeferredPrompt();

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
      notifyListeners();
    }
  };

  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|OPR/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  const getBrowserName = () => {
    if (isChrome) return "Chrome";
    if (isEdge) return "Edge";
    if (isFirefox) return "Firefox";
    if (isSafari) return "Safari";
    return "votre navigateur";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Installer Mantalite Kominote
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <img src="/icons/icon-192x192.png" alt="Mantalite Kominote" className="w-24 h-24 rounded-2xl shadow-lg" />

          {installed ? (
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <p className="text-lg font-semibold text-foreground">Application installée !</p>
              <p className="text-sm text-muted-foreground">Retrouvez Mantalite Kominote sur votre écran d'accueil.</p>
            </div>
          ) : ready ? (
            /* Native install prompt available */
            <div className="space-y-4 w-full text-center">
              <p className="text-sm text-muted-foreground">
                Installez l'application pour un accès rapide depuis votre écran d'accueil.
              </p>
              <Button onClick={handleInstall} size="lg" className="w-full text-lg py-6">
                <Download className="h-5 w-5 mr-2" />
                Installer maintenant
              </Button>
            </div>
          ) : platform === "ios" ? (
            /* iOS instructions */
            <div className="space-y-4 w-full">
              <p className="text-sm text-muted-foreground text-center">
                Sur iPhone/iPad, suivez ces étapes :
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</div>
                  <div>
                    <p className="font-medium text-foreground">Ouvrir dans Safari</p>
                    <p className="text-xs text-muted-foreground">Cette page doit être ouverte dans Safari</p>
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
              </div>
            </div>
          ) : (
            /* Desktop / Android fallback instructions */
            <div className="space-y-4 w-full">
              <p className="text-sm text-muted-foreground text-center">
                Installez l'app depuis {getBrowserName()} :
              </p>
              <div className="space-y-3">
                {isChrome || isEdge ? (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium text-foreground">Cliquez sur l'icône d'installation</p>
                        <p className="text-xs text-muted-foreground">
                          Dans la barre d'adresse à droite, cherchez l'icône <Download className="inline h-4 w-4" /> ou <Smartphone className="inline h-4 w-4" />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium text-foreground">Ou utilisez le menu</p>
                        <p className="text-xs text-muted-foreground">
                          Menu ⋮ → <strong>"Installer Mantalite Kominote"</strong>
                        </p>
                      </div>
                    </div>
                  </>
                ) : isSafari ? (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium text-foreground">Ouvrez le menu Fichier</p>
                        <p className="text-xs text-muted-foreground">En haut dans la barre de menu</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium text-foreground">Cliquez "Ajouter au Dock"</p>
                        <p className="text-xs text-muted-foreground">L'app apparaîtra dans votre Dock</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">1</div>
                    <div>
                      <p className="font-medium text-foreground">Ouvrez le menu du navigateur</p>
                      <p className="text-xs text-muted-foreground">
                        Cherchez <strong>"Installer"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-muted-foreground text-center">
                  💡 Pour la meilleure expérience, utilisez <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallAppModal;
