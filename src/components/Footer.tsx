import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBag,
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-background p-2 rounded-none">
                <ShoppingBag className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-bold">APEX</h3>
                <p className="text-sm text-background/70 uppercase tracking-[0.2em] text-[10px]">
                  {t("footer.tagline")}
                </p>
              </div>
            </div>
            <p className="text-background/80 text-sm leading-relaxed">
              {t("footer.about")}
            </p>
            <div className="flex gap-2">
              <a href="https://www.facebook.com/APEXRD" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="h-8 w-8 border-background/30 bg-transparent text-background hover:bg-background hover:text-foreground">
                  <Facebook className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://www.instagram.com/apex" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="h-8 w-8 border-background/30 bg-transparent text-background hover:bg-background hover:text-foreground">
                  <Instagram className="h-4 w-4" />
                </Button>
              </a>
              <a href="https://x.com/APEX" target="_blank" rel="noopener noreferrer">
                <Button size="icon" variant="outline" className="h-8 w-8 border-background/30 bg-transparent text-background hover:bg-background hover:text-foreground">
                  <Twitter className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">{t("footer.quickLinks")}</h4>
            <div className="space-y-2 text-sm">
              <Link to="/about" className="block text-background/70 hover:text-background transition-smooth">{t("footer.aboutLink")}</Link>
              <Link to="/how-it-works" className="block text-background/70 hover:text-background transition-smooth">{t("footer.howItWorks")}</Link>
              <Link to="/terms" className="block text-background/70 hover:text-background transition-smooth">{t("footer.terms")}</Link>
              <Link to="/privacy" className="block text-background/70 hover:text-background transition-smooth">{t("footer.privacy")}</Link>
              <Link to="/settings" className="block text-background/70 hover:text-background transition-smooth">{t("footer.help")}</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">{t("footer.business")}</h4>
            <div className="space-y-2 text-sm">
              <Link to="/shops" className="block text-background/70 hover:text-background transition-smooth">{t("footer.becomeSeller")}</Link>
              <Link to="/products" className="block text-background/70 hover:text-background transition-smooth">{t("footer.seeProducts")}</Link>
              <Link to="/restaurants" className="block text-background/70 hover:text-background transition-smooth">{t("footer.restaurants")}</Link>
              <Link to="/about" className="block text-background/70 hover:text-background transition-smooth">{t("footer.solutions")}</Link>
              <Link to="/settings" className="block text-background/70 hover:text-background transition-smooth">{t("footer.affiliate")}</Link>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">{t("footer.connected")}</h4>
            <div className="space-y-3">
              <a href="mailto:contact@apex.com" className="flex items-center gap-2 text-sm text-background/70 hover:text-background">
                <Mail className="h-4 w-4" />
                <span>contact@apex.com</span>
              </a>
              <a href="tel:+18296999294" className="flex items-center gap-2 text-sm text-background/70 hover:text-background">
                <Phone className="h-4 w-4" />
                <span>+1 (829) 699-9294</span>
              </a>
              <div className="flex items-center gap-2 text-sm text-background/70">
                <MapPin className="h-4 w-4" />
                <span>Worldwide</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-background/70">{t("footer.newsletter")}</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t("footer.emailPlaceholder")}
                  className="bg-background/10 border-background/20 text-background placeholder:text-background/50"
                />
                <Button variant="outline" size="sm" className="border-background/30 bg-transparent text-background hover:bg-background hover:text-foreground">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="mb-8 bg-background/20" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/70">
          <p>{t("footer.rights")}</p>
          <div className="flex gap-6">
            <Link to="/legal" className="hover:text-background transition-smooth">{t("footer.legal")}</Link>
            <Link to="/cookies" className="hover:text-background transition-smooth">{t("footer.cookies")}</Link>
            <Link to="/about" className="hover:text-background transition-smooth">{t("footer.sitemap")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
