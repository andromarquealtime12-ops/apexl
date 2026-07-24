import { Button } from "@/components/ui/button";
import { ArrowRight, ShoppingBag } from "lucide-react";
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
          <div className="space-y-6 text-center md:text-start">
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
                className="text-base px-8 h-12 rounded-none bg-foreground text-background hover:bg-foreground/90"
                onClick={() => navigate("/products")}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                {t("hero.shopNow")}
                <ArrowRight className="h-4 w-4 ml-2 rtl:rotate-180" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 rounded-none"
                onClick={() => navigate("/shops")}
              >
                {t("hero.exploreShops")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 max-w-md mx-auto md:mx-0">
              <div>
                <div className="text-2xl font-bold text-foreground">30+</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("hero.countries")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">10k+</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("hero.products")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">24/7</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("hero.support")}</div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative aspect-square md:aspect-[4/5] overflow-hidden bg-muted">
            <img
              src={heroImage}
              alt={t("hero.title1")}
              width={1024}
              height={1024}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
