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
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-secondary p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Mantalite Kominote</h3>
                <p className="text-sm text-primary-foreground/80">Konekte nan RD</p>
              </div>
            </div>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              La première plateforme marketplace dédiée à la communauté haïtienne 
              en République dominicaine. Connectant vendeurs, acheteurs et livreurs 
              pour une économie digitale prospère.
            </p>
            <div className="flex gap-2">
              <a href="https://www.facebook.com/MantaliteKominoteRD" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="secondary" className="h-8 w-8">
                  <Facebook className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://www.instagram.com/mantalitekominote" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="secondary" className="h-8 w-8">
                  <Instagram className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://x.com/MantaliteKominote" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="secondary" className="h-8 w-8">
                  <Twitter className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Liens rapides</h4>
            <div className="space-y-2 text-sm">
              <Link to="/about" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                À propos
              </Link>
              <Link to="/how-it-works" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Comment ça marche
              </Link>
              <Link to="/terms" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Conditions d'utilisation
              </Link>
              <Link to="/privacy" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Politique de confidentialité
              </Link>
              <Link to="/settings" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Aide et support
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Pour les entreprises</h4>
            <div className="space-y-2 text-sm">
              <Link to="/shops" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Devenir vendeur
              </Link>
              <Link to="/products" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Voir les produits
              </Link>
              <Link to="/restaurants" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Restaurants
              </Link>
              <Link to="/about" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Solutions entreprises
              </Link>
              <Link to="/settings" className="block text-primary-foreground/80 hover:text-primary-foreground transition-smooth">
                Programme d'affiliation
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Restez connecté</h4>
            <div className="space-y-3">
              <a href="mailto:contact@mantalitekominote.com" className="flex items-center gap-2 text-sm hover:text-primary-foreground/100 text-primary-foreground/80">
                <Mail className="h-4 w-4" />
                <span>contact@mantalitekominote.com</span>
              </a>
              <a href="tel:+18296999294" className="flex items-center gap-2 text-sm hover:text-primary-foreground/100 text-primary-foreground/80">
                <Phone className="h-4 w-4" />
                <span>+1 (829) 699-9294</span>
              </a>
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

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-primary-foreground/80">
          <p>
            © 2026 Mantalite Kominote. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            <Link to="/legal" className="hover:text-primary-foreground transition-smooth">
              Mentions légales
            </Link>
            <Link to="/cookies" className="hover:text-primary-foreground transition-smooth">
              Cookies
            </Link>
            <Link to="/about" className="hover:text-primary-foreground transition-smooth">
              Plan du site
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
