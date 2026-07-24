import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TermsOfUse = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Conditions d'utilisation</h1>
        <div className="max-w-3xl mx-auto prose prose-sm text-muted-foreground space-y-6">
          <p className="text-sm text-muted-foreground">Dernière mise à jour : 1er janvier 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptation des conditions</h2>
            <p>En accédant et en utilisant Mantalite Kominote, vous acceptez d'être lié par les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Description du service</h2>
            <p>Mantalite Kominote est une plateforme marketplace qui met en relation des vendeurs, des acheteurs et des livreurs. Nous fournissons l'infrastructure technologique mais ne sommes pas partie aux transactions entre utilisateurs.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Inscription et compte</h2>
            <p>Pour utiliser certaines fonctionnalités, vous devez créer un compte avec des informations exactes et à jour. Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute activité effectuée sous votre compte relève de votre responsabilité.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Rôles des utilisateurs</h2>
            <p><strong>Acheteurs :</strong> Peuvent parcourir, acheter des produits et demander des retours selon les conditions applicables.</p>
            <p><strong>Vendeurs :</strong> Doivent soumettre une candidature approuvée. Sont responsables de la qualité et de la description exacte de leurs produits.</p>
            <p><strong>Livreurs :</strong> Doivent soumettre une candidature approuvée avec des documents valides. Sont responsables de la livraison sécurisée des colis.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Paiements et portefeuille</h2>
            <p>Les transactions sont effectuées via le portefeuille Mantalite Kominote. Les utilisateurs peuvent recharger leur portefeuille via les méthodes de dépôt disponibles. Une commission peut être appliquée sur les conversions de devises.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Retours et remboursements</h2>
            <p>Les acheteurs peuvent demander un retour de colis dans un délai raisonnable après la livraison. Le remboursement est traité après réception et vérification du retour par le vendeur. Les frais de livraison de retour peuvent s'appliquer selon le type de faute.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Comportement interdit</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Publier des informations fausses ou trompeuses</li>
              <li>Vendre des produits contrefaits ou illégaux</li>
              <li>Harceler d'autres utilisateurs</li>
              <li>Manipuler le système d'évaluation</li>
              <li>Utiliser la plateforme pour des activités frauduleuses</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Suspension de compte</h2>
            <p>Mantalite Kominote se réserve le droit de suspendre ou de supprimer tout compte en cas de violation des présentes conditions, de signalements multiples ou de comportement frauduleux.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">9. Propriété intellectuelle</h2>
            <p>Tout le contenu de la plateforme (logos, design, textes) est la propriété d'Mantalite Kominote. Les vendeurs conservent les droits sur leurs propres contenus mais accordent à Mantalite Kominote une licence pour les afficher sur la plateforme.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">10. Limitation de responsabilité</h2>
            <p>Mantalite Kominote agit en tant qu'intermédiaire et ne peut être tenu responsable des litiges entre utilisateurs, de la qualité des produits vendus par des tiers, ou des retards de livraison indépendants de notre volonté.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">11. Modifications</h2>
            <p>Nous nous réservons le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des changements importants. L'utilisation continue de la plateforme après modification vaut acceptation.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">12. Contact</h2>
            <p>Pour toute question concernant ces conditions, contactez-nous à contact@mantalitekominote.com ou au +1 (829) 699-9294.</p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default TermsOfUse;
