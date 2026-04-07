import Header from "@/components/Header";
import Footer from "@/components/Footer";

const LegalNotice = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Mentions légales</h1>
        <div className="max-w-3xl mx-auto prose prose-sm text-muted-foreground space-y-6">

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Éditeur du site</h2>
            <p>
              <strong>Ayiti Market</strong><br />
              Plateforme de commerce en ligne<br />
              Santo Domingo, République Dominicaine<br />
              Téléphone : +1 (829) 699-9294<br />
              Email : contact@ayitimarket.com
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Hébergement</h2>
            <p>
              Le site est hébergé par des services cloud sécurisés avec des serveurs situés 
              dans des centres de données certifiés.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu du site Ayiti Market (textes, images, logos, graphismes, 
              icônes, sons, logiciels) est protégé par les lois relatives à la propriété 
              intellectuelle. Toute reproduction, représentation, modification ou adaptation 
              de tout ou partie du site est interdite sans autorisation préalable.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Responsabilité</h2>
            <p>
              Ayiti Market s'efforce d'assurer l'exactitude des informations diffusées sur 
              le site. Toutefois, elle ne peut garantir l'exactitude, la complétude et 
              l'actualité des informations. Ayiti Market agit en tant qu'intermédiaire entre 
              vendeurs et acheteurs et décline toute responsabilité quant aux produits vendus 
              par des tiers sur la plateforme.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Données personnelles</h2>
            <p>
              Conformément à notre politique de confidentialité, les données personnelles 
              collectées sont traitées de manière sécurisée. Pour en savoir plus, consultez 
              notre <a href="/privacy" className="text-primary hover:underline">politique de confidentialité</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Droit applicable</h2>
            <p>
              Les présentes mentions légales sont régies par le droit de la République 
              Dominicaine. Tout litige sera soumis à la juridiction compétente de 
              Santo Domingo.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
};

export default LegalNotice;
