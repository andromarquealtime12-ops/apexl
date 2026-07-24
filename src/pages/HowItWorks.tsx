import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShoppingCart, Store, Truck, CreditCard, Package, Star } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    { icon: Store, title: "1. Parcourez les boutiques", desc: "Explorez les boutiques et restaurants disponibles sur la plateforme. Filtrez par catégorie, ville ou distance." },
    { icon: ShoppingCart, title: "2. Ajoutez au panier", desc: "Sélectionnez vos produits, choisissez la taille et la couleur, puis ajoutez-les à votre panier." },
    { icon: CreditCard, title: "3. Payez en toute sécurité", desc: "Payez via votre portefeuille Mantalite Kominote. Rechargez-le via transfert bancaire ou agent de dépôt." },
    { icon: Package, title: "4. Suivi en temps réel", desc: "Suivez votre commande en temps réel. Le vendeur prépare, le livreur récupère et livre chez vous." },
    { icon: Truck, title: "5. Livraison vérifiée", desc: "Le livreur utilise un code de vérification pour confirmer la livraison. Votre colis est sécurisé." },
    { icon: Star, title: "6. Évaluez l'expérience", desc: "Notez le vendeur et le livreur pour aider la communauté à maintenir un service de qualité." },
  ];

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-4 text-center">Comment ça marche</h1>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Mantalite Kominote rend l'achat en ligne simple et sécurisé. Voici comment ça fonctionne en 6 étapes.
        </p>

        <div className="max-w-3xl mx-auto space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4 bg-card p-6 rounded-xl border border-border">
              <div className="bg-primary/10 p-3 rounded-lg h-fit">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default HowItWorks;
