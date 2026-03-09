import { Navigate, useParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import LiveOrderTracking from "@/components/tracking/LiveOrderTracking";

const TrackOrder = () => {
  const { user, loading } = useAuth();
  const { orderId } = useParams<{ orderId: string }>();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!orderId) return <Navigate to="/orders" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-6 max-w-lg mx-auto">
        <LiveOrderTracking orderId={orderId} />
      </main>
      <Footer />
    </div>
  );
};

export default TrackOrder;
