import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  MapPin, 
  Shield, 
  Clock, 
  MessageSquare, 
  TrendingUp,
  Smartphone,
  Globe
} from "lucide-react";

const FeaturesSection = () => {
  const features = [
    {
      icon: CreditCard,
      title: "Paiements Sécurisés",
      description: "Acceptez tous les types de paiement sauf cash : cartes, virements, portefeuilles digitaux",
      badge: "Sécurisé"
    },
    {
      icon: MapPin,
      title: "Géolocalisation",
      description: "Suivi en temps réel des livraisons avec GPS intégré pour une expérience optimale",
      badge: "GPS"
    },
    {
      icon: Shield,
      title: "Transactions Protégées", 
      description: "Système de protection avancé pour sécuriser toutes vos transactions",
      badge: "Protection"
    },
    {
      icon: Clock,
      title: "Livraison Express",
      description: "Livraison rapide dans toute la République dominicaine avec suivi en temps réel",
      badge: "Rapide"
    },
    {
      icon: MessageSquare,
      title: "Chat Intégré",
      description: "Communication directe entre acheteurs, vendeurs et livreurs via chat sécurisé",
      badge: "Communication"
    },
    {
      icon: TrendingUp,
      title: "Analytics Avancés",
      description: "Tableaux de bord complets pour suivre vos ventes, performances et tendances",
      badge: "Analytics"
    },
    {
      icon: Smartphone,
      title: "App Mobile",
      description: "Application mobile intuitive disponible sur iOS et Android",
      badge: "Mobile"
    },
    {
      icon: Globe,
      title: "Multi-langues",
      description: "Interface disponible en français, créole haïtien et espagnol",
      badge: "Multilangue"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-2">
            Fonctionnalités
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Une plateforme complète avec toutes les fonctionnalités modernes 
            pour une expérience marketplace exceptionnelle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="group hover:shadow-elegant transition-smooth border hover:border-primary/20 bg-gradient-card"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 rounded-lg bg-primary text-primary-foreground group-hover:shadow-glow transition-smooth">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;