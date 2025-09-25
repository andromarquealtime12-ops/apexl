import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck, Store, ArrowRight, Star } from "lucide-react";
import heroImage from "@/assets/hero-marketplace.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/90" />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-2 text-sm font-medium">
              <Star className="h-4 w-4 mr-2" />
              Marketplace #1 pour la communauté haïtienne en RD
            </Badge>
          </div>

          {/* Main Heading */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground leading-tight">
              Ayiti Market
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 font-medium">
              Konekte Vendè, Kliyan ak Livrè yo nan yon sèl platfòm
            </p>
            <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
              La plateforme qui connecte la communauté haïtienne en République dominicaine. 
              Achetez, vendez et livrez en toute simplicité avec des paiements sécurisés.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-4 h-auto">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Commencer à acheter
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="accent" className="text-lg px-8 py-4 h-auto">
              <Store className="h-5 w-5 mr-2" />
              Devenir vendeur
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-foreground">1000+</div>
              <div className="text-primary-foreground/80">Vendeurs actifs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-foreground">15k+</div>
              <div className="text-primary-foreground/80">Commandes livrées</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-foreground">50+</div>
              <div className="text-primary-foreground/80">Livreurs partenaires</div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;