import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Shops from "./pages/Shops";
import SellerShop from "./pages/SellerShop";
import Wallet from "./pages/Wallet";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import Admin from "./pages/Admin";
import SellerDashboard from "./pages/SellerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TrackOrder from "./pages/TrackOrder";
import OrderSearch from "./pages/OrderSearch";
import ResetPassword from "./pages/ResetPassword";
import Restaurants from "./pages/Restaurants";
import RestaurantDetail from "./pages/RestaurantDetail";
import AgentDashboard from "./pages/AgentDashboard";
import SupportChatWidget from "./components/support/SupportChatWidget";
import AIAssistantWidget from "./components/ai/AIAssistantWidget";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
              <Route path="/product/:productId" element={<ProductDetail />} />
              <Route path="/shops" element={<Shops />} />
              <Route path="/shop/:sellerId" element={<SellerShop />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/driver" element={<DriverDashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/track/:orderId" element={<TrackOrder />} />
              <Route path="/search-order" element={<OrderSearch />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/restaurants" element={<Restaurants />} />
              <Route path="/restaurant/:restaurantId" element={<RestaurantDetail />} />
              <Route path="/agent" element={<AgentDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIAssistantWidget />
            <SupportChatWidget />
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
