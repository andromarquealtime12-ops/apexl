import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingBag, 
  Facebook, 
  Instagram, 
  Twitter, 
  Mail, 
  Phone, 
  MapPin 
} from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-secondary p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Ayiti Market</h3>
                <p className="text-sm text-primary-foreground/80">Konekte nan RD</p>
              </div>
            </div>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              La première plateforme marketplace dédiée à la communauté haïtienne 
              en République dominicaine. Connectant vendeurs, acheteurs et livreurs 
              pour une économie digitale prospère.
            </p>
            <div className="flex gap-2">
              <Button size="icon" variant="secondary" className="h-8 w-8">
                <Facebook className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-8 w-8">
                <Instagram className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="h-8 w-8">
                <Twitter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Liens rapides</h4>
            <div className="space-y-2 text-sm">
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                À propos
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Comment ça marche
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Conditions d'utilisation
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Politique de confidentialité
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Aide et support
              </a>
            </div>
          </div>

          {/* For Business */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Pour les entreprises</h4>
            <div className="space-y-2 text-sm">
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Devenir vendeur
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Devenir livreur partenaire
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                API développeurs
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Solutions entreprises
              </a>
              <a href="#" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Programme d'affiliation
              </a>
            </div>
          </div>

          {/* Contact & Newsletter */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Restez connecté</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span>contact@ayitimarket.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>+1 (809) 123-4567</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span>Santo Domingo, RD</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-primary-foreground/80">
                Recevez nos dernières nouvelles
              </p>
              <div className="flex gap-2">
                <Input 
                  type="email" 
                  placeholder="Votre email" 
                  className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/60"
                />
                <Button variant="secondary" size="sm">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="mb-8 bg-primary-foreground/20" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/80">
          <p>
            © 2024 Ayiti Market. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary-foreground transition-smooth">
              Mentions légales
            </a>
            <a href="#" className="hover:text-primary-foreground transition-smooth">
              Cookies
            </a>
            <a href="#" className="hover:text-primary-foreground transition-smooth">
              Plan du site
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;