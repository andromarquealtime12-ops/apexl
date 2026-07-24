import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Politique de confidentialité</h1>
        <div className="max-w-3xl mx-auto prose prose-sm text-muted-foreground space-y-6">
          <p className="text-sm text-muted-foreground">Dernière mise à jour : 1er janvier 2026</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Collecte des données</h2>
            <p>Nous collectons les données suivantes lors de votre utilisation d'Mantalite Kominote :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Informations d'inscription : nom complet, email, téléphone</li>
              <li>Données de profil : adresse, ville, photo de profil</li>
              <li>Documents d'identité : pour la vérification d'identité (vendeurs et livreurs)</li>
              <li>Données de localisation : pour le calcul des distances de livraison</li>
              <li>Historique des transactions : achats, ventes, transferts</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Utilisation des données</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Fournir et améliorer nos services</li>
              <li>Traiter les transactions et livraisons</li>
              <li>Vérifier l'identité des utilisateurs</li>
              <li>Envoyer des notifications liées aux commandes</li>
              <li>Prévenir la fraude et assurer la sécurité</li>
              <li>Générer des statistiques anonymisées</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Protection des données</h2>
            <p>Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données personnelles, incluant le chiffrement des données sensibles, l'authentification sécurisée et des contrôles d'accès stricts.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Partage des données</h2>
            <p>Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Les autres utilisateurs impliqués dans une transaction (vendeur, livreur)</li>
              <li>Les prestataires de services de paiement</li>
              <li>Les autorités compétentes sur demande légale</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Conservation des données</h2>
            <p>Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données personnelles sont supprimées dans un délai de 30 jours, à l'exception des données nécessaires pour des obligations légales.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Vos droits</h2>
            <p>Vous avez le droit de :</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Accéder à vos données personnelles</li>
              <li>Corriger vos informations</li>
              <li>Demander la suppression de votre compte</li>
              <li>Retirer votre consentement pour les notifications</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Cookies</h2>
            <p>Mantalite Kominote utilise des cookies essentiels pour le fonctionnement de la plateforme (session, authentification). Aucun cookie publicitaire n'est utilisé.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Contact</h2>
            <p>Pour toute question relative à la protection de vos données, contactez-nous à contact@mantalitekominote.com ou au +1 (829) 699-9294.</p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default PrivacyPolicy;
