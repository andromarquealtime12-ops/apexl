import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Truck, Store, User, Menu } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b border-border">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-hero p-2 rounded-lg">
            <ShoppingBag className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Ayiti Market</h1>
            <p className="text-xs text-muted-foreground">Konekte nan RD</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <a href="#accueil" className="text-sm font-medium hover:text-primary transition-smooth">
            Accueil
          </a>
          <a href="#produits" className="text-sm font-medium hover:text-primary transition-smooth">
            Produits
          </a>
          <a href="#livreurs" className="text-sm font-medium hover:text-primary transition-smooth">
            Livreurs
          </a>
          <a href="#vendeurs" className="text-sm font-medium hover:text-primary transition-smooth">
            Vendeurs
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <User className="h-4 w-4 mr-2" />
            Connexion
          </Button>
          <Button variant="hero" size="sm">
            S'inscrire
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;