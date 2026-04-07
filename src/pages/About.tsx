import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShoppingBag, Users, Truck, Shield } from "lucide-react";

const About = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">À propos d'Ayiti Market</h1>
        
        <div className="max-w-3xl mx-auto space-y-8">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Notre Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ayiti Market est la première plateforme marketplace dédiée à la communauté haïtienne 
              en République dominicaine. Notre mission est de connecter vendeurs, acheteurs et livreurs 
              pour créer une économie digitale prospère et inclusive.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card p-6 rounded-xl border border-border space-y-3">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Marketplace</h3>
              <p className="text-muted-foreground text-sm">
                Des milliers de produits disponibles, des vêtements aux appareils électroniques, 
                livrés directement chez vous.
              </p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border space-y-3">
              <Users className="h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Communauté</h3>
              <p className="text-muted-foreground text-sm">
                Une plateforme créée par et pour la communauté haïtienne, favorisant l'entraide 
                et le développement économique.
              </p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border space-y-3">
              <Truck className="h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Livraison rapide</h3>
              <p className="text-muted-foreground text-sm">
                Un réseau de livreurs partenaires pour vous garantir une livraison rapide 
                et sécurisée partout en RD.
              </p>
            </div>
            <div className="bg-card p-6 rounded-xl border border-border space-y-3">
              <Shield className="h-8 w-8 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Sécurité</h3>
              <p className="text-muted-foreground text-sm">
                Transactions sécurisées avec un système de vérification d'identité 
                et de suivi des commandes en temps réel.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Notre Histoire</h2>
            <p className="text-muted-foreground leading-relaxed">
              Fondé en 2024, Ayiti Market est né du constat que la communauté haïtienne en République 
              dominicaine avait besoin d'une plateforme de commerce en ligne adaptée à ses besoins. 
              Nous avons créé un espace où chacun peut vendre, acheter et se faire livrer en toute confiance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Contactez-nous</h2>
            <p className="text-muted-foreground leading-relaxed">
              Email : contact@ayitimarket.com<br />
              Téléphone : +1 (829) 699-9294<br />
              Adresse : Santo Domingo, République Dominicaine
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default About;
