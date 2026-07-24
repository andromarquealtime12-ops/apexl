import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import InstallAppModal from "./InstallAppModal";

const CTASection = () => {
  const [showInstall, setShowInstall] = useState(false);
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-foreground text-background">
      <div className="container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t("cta.title")}
            </h2>
            <p className="text-xl text-background/80 max-w-2xl mx-auto">
              {t("cta.description")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="text-base px-8 h-12 rounded-none bg-background text-foreground hover:bg-background/90"
              onClick={() => setShowInstall(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("cta.download")}
              <ArrowRight className="h-4 w-4 ml-2 rtl:rotate-180" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 h-12 rounded-none border-background/40 bg-transparent text-background hover:bg-background hover:text-foreground"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <Smartphone className="h-4 w-4 mr-2" />
              {t("cta.web")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold">🚀</div>
              <div className="font-medium">{t("cta.fast")}</div>
              <div className="text-background/60 text-sm">{t("cta.fastDesc")}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold">💰</div>
              <div className="font-medium">{t("cta.commission")}</div>
              <div className="text-background/60 text-sm">{t("cta.commissionDesc")}</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold">🤝</div>
              <div className="font-medium">{t("cta.support")}</div>
              <div className="text-background/60 text-sm">{t("cta.supportDesc")}</div>
            </div>
          </div>
        </div>
      </div>

      <InstallAppModal open={showInstall} onOpenChange={setShowInstall} />
    </section>
  );
};

export default CTASection;
