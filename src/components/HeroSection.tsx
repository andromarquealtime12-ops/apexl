import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-marketplace.jpg";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Background Image - more visible */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: `url(${heroImage})` }} />
      
      {/* Gradient Overlay - lighter */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-primary/60 to-secondary/70" />

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
            <h1 className="text-3xl md:text-5xl font-bold text-primary-foreground">
              La meilleure plateforme pour acheter en ligne
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 font-medium">
              Pi bon platfòm pou achte sou entènèt
            </p>
            <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto">
              Découvrez des milliers de produits de la communauté haïtienne en République dominicaine. 
              Achetez en toute simplicité avec des paiements sécurisés et une livraison rapide.
            </p>
          </div>

          {/* CTA Button - only "Commencer à acheter" */}
          <div className="flex justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-4 h-auto" onClick={() => navigate("/products")}>
              <ShoppingCart className="h-5 w-5 mr-2" />
              Commencer à acheter
              <ArrowRight className="h-5 w-5 ml-2" />
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
    </section>);

};

export default HeroSection;