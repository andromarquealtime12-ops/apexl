import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingBag, User, Menu, Wallet, 
  LogOut, ChevronDown, Settings, Package, Search,
  Store, Truck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { CartSheet } from "@/components/cart/CartSheet";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const Header = () => {
  const { user, isAdmin, isSeller, isDriver, signOut, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  const openSignIn = () => {
    setAuthTab("signin");
    setAuthModalOpen(true);
  };

  const openSignUp = () => {
    setAuthTab("signup");
    setAuthModalOpen(true);
  };

  return (
    <>
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b border-border">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-gradient-hero p-2 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-primary">Ayiti Market</h1>
                <p className="text-xs text-muted-foreground">Konekte nan RD</p>
              </div>
            </Link>
          </div>

          {/* Search bar - desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher des produits..." 
                className="pl-10 w-full"
              />
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium hover:text-primary transition-smooth">
              Accueil
            </Link>
            <Link to="/products" className="text-sm font-medium hover:text-primary transition-smooth">
              Produits
            </Link>
            <Link to="/seller" className="text-sm font-medium hover:text-primary transition-smooth">
              Vendre
            </Link>
            <Link to="/driver" className="text-sm font-medium hover:text-primary transition-smooth">
              Livrer
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* Cart */}
            <CartSheet />

            {loading ? (
              <div className="w-20 h-9 bg-muted animate-pulse rounded-md" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Mon compte</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {user.email}
                    {isAdmin && <Badge className="ml-2 text-xs">Admin</Badge>}
                    {isSeller && <Badge variant="secondary" className="ml-2 text-xs">Vendeur</Badge>}
                    {isDriver && <Badge variant="outline" className="ml-2 text-xs">Livreur</Badge>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Mon profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet" className="cursor-pointer">
                      <Wallet className="mr-2 h-4 w-4" />
                      Mon portefeuille
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="cursor-pointer">
                      <Package className="mr-2 h-4 w-4" />
                      Mes commandes
                    </Link>
                  </DropdownMenuItem>
                  {isSeller && (
                    <DropdownMenuItem asChild>
                      <Link to="/seller" className="cursor-pointer text-primary">
                        <Store className="mr-2 h-4 w-4" />
                        Dashboard vendeur
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isDriver && (
                    <DropdownMenuItem asChild>
                      <Link to="/driver" className="cursor-pointer text-primary">
                        <Truck className="mr-2 h-4 w-4" />
                        Dashboard livreur
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Paramètres
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer text-primary">
                          <Settings className="mr-2 h-4 w-4" />
                          Panel Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="outline" size="sm" className="hidden sm:flex" onClick={openSignIn}>
                  <User className="h-4 w-4 mr-2" />
                  Connexion
                </Button>
                <Button variant="hero" size="sm" onClick={openSignUp}>
                  S'inscrire
                </Button>
              </>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher..." className="pl-10" />
                  </div>
                  <Link to="/" className="text-lg font-medium py-2 border-b">Accueil</Link>
                  <Link to="/products" className="text-lg font-medium py-2 border-b">Produits</Link>
                  <Link to="/seller" className="text-lg font-medium py-2 border-b">Vendre</Link>
                  <Link to="/driver" className="text-lg font-medium py-2 border-b">Livrer</Link>
                  {!user && (
                    <div className="flex flex-col gap-2 pt-4">
                      <Button onClick={openSignIn}>Connexion</Button>
                      <Button variant="outline" onClick={openSignUp}>S'inscrire</Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        defaultTab={authTab}
      />
    </>
  );
};

export default Header;