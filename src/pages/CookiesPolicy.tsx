import Header from "@/components/Header";
import Footer from "@/components/Footer";

const CookiesPolicy = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Politique de cookies</h1>
        <div className="max-w-3xl mx-auto prose prose-sm text-muted-foreground space-y-6">

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Qu'est-ce qu'un cookie ?</h2>
            <p>Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite sur notre site. Il permet de mémoriser vos préférences et d'améliorer votre expérience.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Cookies utilisés</h2>
            <p><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement du site (authentification, session, panier).</p>
            <p><strong>Cookies de préférence :</strong> Mémorisation de vos choix (langue, thème sombre/clair).</p>
            <p>Ayiti Market n'utilise aucun cookie publicitaire ni de traçage tiers.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Gestion des cookies</h2>
            <p>Vous pouvez configurer votre navigateur pour refuser les cookies. Cependant, certaines fonctionnalités du site pourraient ne pas fonctionner correctement.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p>Pour toute question, contactez-nous à contact@ayitimarket.com ou au +1 (829) 699-9294.</p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default CookiesPolicy;
