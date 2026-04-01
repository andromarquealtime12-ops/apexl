import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, Smartphone } from "lucide-react";
import InstallAppModal from "./InstallAppModal";

const CTASection = () => {
  const [showInstall, setShowInstall] = useState(false);

  return (
    <section className="py-20 bg-gradient-hero">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground">
              Prêt à rejoindre la révolution ?
            </h2>
            <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
              Téléchargez l'app Ayiti Market et commencez à acheter, vendre ou livrer 
              dès aujourd'hui. L'économie digitale vous attend !
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-4 h-auto" onClick={() => setShowInstall(true)}>
              <Download className="h-5 w-5 mr-2" />
              Télécharger l'app
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="accent" className="text-lg px-8 py-4 h-auto" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Smartphone className="h-5 w-5 mr-2" />
              Version web
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary-foreground">🚀</div>
              <div className="text-primary-foreground/90 font-medium">Lancement rapide</div>
              <div className="text-primary-foreground/70 text-sm">En ligne en moins de 5 minutes</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary-foreground">💰</div>
              <div className="text-primary-foreground/90 font-medium">Commission réduite</div>
              <div className="text-primary-foreground/70 text-sm">Tarifs préférentiels pour la communauté</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-primary-foreground">🤝</div>
              <div className="text-primary-foreground/90 font-medium">Support dédié</div>
              <div className="text-primary-foreground/70 text-sm">Assistance en français et créole</div>
            </div>
          </div>
        </div>
      </div>

      <InstallAppModal open={showInstall} onOpenChange={setShowInstall} />
    </section>
  );
};

export default CTASection;
