import { Button } from "@/components/ui/button";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-global.jpg";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative bg-background border-b border-border">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Copy */}
          <div className="space-y-6 text-center md:text-left">
            <span className="inline-block text-xs tracking-[0.2em] uppercase text-muted-foreground">
              New season · Worldwide
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              Shop the world.<br />
              <span className="text-muted-foreground">Delivered to you.</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto md:mx-0">
              Thousands of trending products, one global marketplace. Fashion, tech, home and more — shipped fast, in any language, to any country.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button
                size="lg"
                className="text-base px-8 h-12 rounded-none bg-foreground text-background hover:bg-foreground/90"
                onClick={() => navigate("/products")}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Shop now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 rounded-none"
                onClick={() => navigate("/shops")}
              >
                Explore shops
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 max-w-md mx-auto md:mx-0">
              <div>
                <div className="text-2xl font-bold text-foreground">30+</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Countries</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">10k+</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Products</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">24/7</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Support</div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative aspect-square md:aspect-[4/5] overflow-hidden bg-muted">
            <img
              src={heroImage}
              alt="Global marketplace"
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
