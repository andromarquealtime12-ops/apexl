import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, MapPin, Shield, Clock, MessageSquare, TrendingUp, Smartphone, Globe,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const FeaturesSection = () => {
  const { t } = useTranslation();
  const features = [
    { key: "payments", icon: CreditCard },
    { key: "geo", icon: MapPin },
    { key: "protection", icon: Shield },
    { key: "express", icon: Clock },
    { key: "chat", icon: MessageSquare },
    { key: "analytics", icon: TrendingUp },
    { key: "mobile", icon: Smartphone },
    { key: "multi", icon: Globe },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-2 rounded-none">
            {t("features.badge")}
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            {t("features.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map(({ key, icon: Icon }) => (
            <Card
              key={key}
              className="group hover:shadow-elegant transition-smooth border rounded-none"
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-3 rounded-none bg-foreground text-background">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="text-xs rounded-none">
                    {t(`features.${key}.badge`)}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-semibold">
                  {t(`features.${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {t(`features.${key}.description`)}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
