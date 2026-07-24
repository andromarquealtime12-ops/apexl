import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Store, Truck, CheckCircle, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const UserTypeSection = () => {
  const { t } = useTranslation();
  const userTypes = [
    { id: "buyer", icon: ShoppingCart },
    { id: "seller", icon: Store },
    { id: "driver", icon: Truck },
  ] as const;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            {t("userTypes.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("userTypes.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {userTypes.map(({ id, icon: Icon }) => (
            <Card key={id} className="group hover:shadow-elegant transition-smooth border rounded-none">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-4 rounded-full bg-foreground text-background w-fit mb-4">
                  <Icon className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  {t(`userTypes.${id}.title`)}
                </CardTitle>
                <CardDescription className="text-base">
                  {t(`userTypes.${id}.description`)}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {["f1", "f2", "f3", "f4"].map((k) => (
                    <li key={k} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{t(`userTypes.${id}.${k}`)}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full rounded-none bg-foreground text-background hover:bg-foreground/90">
                  {t(`userTypes.${id}.cta`)}
                  <ArrowRight className="h-4 w-4 ml-2 rtl:rotate-180" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UserTypeSection;
