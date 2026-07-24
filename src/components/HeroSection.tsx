import { Button } from "@/components/ui/button";
import { ArrowRight, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import heroImage from "@/assets/hero-global.jpg";
import bgLogo from "@/assets/apexl-logo.png.asset.json";

const HeroSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="relative bg-background border-b border-border overflow-hidden">
      {/* Decorative APEXL logo background — très pâle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04] bg-repeat"
        style={{
          backgroundImage: `url(${bgLogo.url})`,
          backgroundSize: "160px 160px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/70 via-background/50 to-background/70" />
      <div className="container mx-auto px-4 py-12 md:py-20 relative">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Copy */}
          <div className="space-y-6 text-center md:text-start animate-fade-in">
            <span className="inline-block text-xs tracking-[0.2em] uppercase text-muted-foreground">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              {t("hero.title1")}<br />
              <span className="text-muted-foreground">{t("hero.title2")}</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto md:mx-0">
              {t("hero.description")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button
                size="lg"
                className="text-base px-8 h-12 rounded-none bg-foreground text-background hover:bg-foreground/90 transition-transform hover:scale-[1.03]"
                onClick={() => navigate("/products")}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                {t("hero.shopNow")}
                <ArrowRight className="h-4 w-4 ml-2 rtl:rotate-180" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 rounded-none transition-transform hover:scale-[1.03]"
                onClick={() => navigate("/shops")}
              >
                {t("hero.exploreShops")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 rounded-none transition-transform hover:scale-[1.03]"
                onClick={() => navigate("/restaurants")}
              >
                <UtensilsCrossed className="h-4 w-4 mr-2" />
                Trouver un restaurant
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 max-w-md mx-auto md:mx-0">
              {[
                { v: "30+", k: "hero.countries" },
                { v: "10k+", k: "hero.products" },
                { v: "24/7", k: "hero.support" },
              ].map((s, i) => (
                <div
                  key={s.k}
                  className="animate-fade-in"
                  style={{ animationDelay: `${150 + i * 120}ms`, animationFillMode: "both" }}
                >
                  <div className="text-2xl font-bold text-foreground">{s.v}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{t(s.k)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Image */}
          <div
            className="relative aspect-square md:aspect-[4/5] overflow-hidden bg-muted animate-scale-in"
            style={{ animationDuration: "0.6s" }}
          >
            <img
              src={heroImage}
              alt={t("hero.title1")}
              width={1024}
              height={1024}
              className="w-full h-full object-cover transition-transform duration-[6000ms] hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
