import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import UserTypeSection from "@/components/UserTypeSection";
import FeaturesSection from "@/components/FeaturesSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <UserTypeSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
