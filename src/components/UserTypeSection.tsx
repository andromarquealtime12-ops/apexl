import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Store, Truck, CheckCircle, ArrowRight } from "lucide-react";

const UserTypeSection = () => {
  const userTypes = [
    {
      id: "acheteur",
      title: "Acheteur",
      titleCreole: "Kliyan",
      description: "Trouvez tout ce dont vous avez besoin dans notre marketplace",
      icon: ShoppingCart,
      color: "primary",
      features: [
        "Catalogue de milliers de produits",
        "Livraison rapide à domicile",
        "Paiements sécurisés multiples",
        "Support client 24/7"
      ],
      cta: "Commencer à acheter"
    },
    {
      id: "vendeur",
      title: "Vendeur",
      titleCreole: "Vendè",
      description: "Développez votre business et atteignez plus de clients",
      icon: Store,
      color: "secondary",
      features: [
        "Créez votre boutique en ligne",
        "Gestion simple des commandes",
        "Outils marketing intégrés",
        "Analytics et rapports détaillés"
      ],
      cta: "Devenir vendeur"
    },
    {
      id: "livreur",
      title: "Livreur",
      titleCreole: "Livrè",
      description: "Gagnez de l'argent en livrant dans votre région",
      icon: Truck,
      color: "success",
      features: [
        "Horaires flexibles",
        "Rémunération attractive",
        "GPS intégré pour optimiser",
        "Paiements hebdomadaires"
      ],
      cta: "Devenir livreur"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Rejwenn Kominote a
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Que vous souhaitiez acheter, vendre ou livrer, Ayiti Market vous offre 
            les outils parfaits pour réussir dans l'économie digitale
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {userTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Card key={type.id} className="group hover:shadow-glow transition-smooth border-2 hover:border-primary/20">
                <CardHeader className="text-center pb-4">
                  <div className={`mx-auto p-4 rounded-full bg-${type.color} text-${type.color}-foreground w-fit mb-4 group-hover:shadow-glow transition-smooth`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <CardTitle className="text-2xl font-bold">
                    {type.title}
                  </CardTitle>
                  <div className="text-lg font-semibold text-primary">
                    {type.titleCreole}
                  </div>
                  <CardDescription className="text-base">
                    {type.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {type.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full" 
                    variant={type.color as any}
                  >
                    {type.cta}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UserTypeSection;