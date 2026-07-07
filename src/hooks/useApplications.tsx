import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SellerApplication {
  id: string;
  user_id: string;
  shop_name: string;
  shop_description: string | null;
  shop_address: string;
  shop_city: string;
  shop_phone: string;
  business_type: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface DriverApplication {
  id: string;
  user_id: string;
  vehicle_type: "motorcycle" | "car" | "bicycle" | "truck";
  vehicle_brand: string;
  vehicle_model: string | null;
  vehicle_year: string | null;
  license_plate: string;
  driver_license_number: string;
  phone: string;
  city: string;
  availability: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export function useMySellerApplication() {
  return useQuery({
    queryKey: ["my-seller-application"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as SellerApplication | null;
    },
  });
}

export function useMyDriverApplication() {
  return useQuery({
    queryKey: ["my-driver-application"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("driver_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DriverApplication | null;
    },
  });
}

export function useSubmitSellerApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      shop_name: string;
      shop_description?: string;
      shop_address: string;
      shop_city: string;
      shop_phone: string;
      business_type?: string;
      latitude?: number | null;
      longitude?: number | null;
      id_document_front_url?: string | null;
      id_document_back_url?: string | null;
      selfie_url?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      
      const { error } = await supabase
        .from("seller_applications")
        .insert({
          user_id: user.id,
          ...(data as any),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-seller-application"] });
      toast.success("Demande soumise avec succès !");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useSubmitDriverApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      vehicle_type: "motorcycle" | "car" | "bicycle" | "truck";
      vehicle_brand: string;
      vehicle_model?: string;
      vehicle_year?: string;
      license_plate: string;
      driver_license_number: string;
      phone: string;
      city: string;
      availability?: string;
      driver_license_front_url?: string | null;
      driver_license_back_url?: string | null;
      vehicle_registration_url?: string | null;
      selfie_url?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      
      const { error } = await supabase
        .from("driver_applications")
        .insert({
          user_id: user.id,
          ...(data as any),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-driver-application"] });
      toast.success("Demande soumise avec succès !");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}


// Admin hooks
export function usePendingSellerApplications() {
  return useQuery({
    queryKey: ["pending-seller-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*, profiles!seller_applications_user_id_fkey(full_name, phone)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) {
        // Fallback without join if foreign key doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("seller_applications")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
  });
}

export function usePendingDriverApplications() {
  return useQuery({
    queryKey: ["pending-driver-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_applications")
        .select("*, profiles!driver_applications_user_id_fkey(full_name, phone)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) {
        // Fallback without join if foreign key doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("driver_applications")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
  });
}

export function useApproveSellerApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase
        .rpc("approve_seller_application", { application_id: applicationId });
      
      if (error) throw error;
      if (!data) throw new Error("Échec de l'approbation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-seller-applications"] });
      toast.success("Vendeur approuvé !");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useApproveDriverApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase
        .rpc("approve_driver_application", { application_id: applicationId });
      
      if (error) throw error;
      if (!data) throw new Error("Échec de l'approbation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-driver-applications"] });
      toast.success("Livreur approuvé !");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ type, id }: { type: "seller" | "driver"; id: string }) => {
      const table = type === "seller" ? "seller_applications" : "driver_applications";
      
      const { error } = await supabase
        .from(table)
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ 
        queryKey: [type === "seller" ? "pending-seller-applications" : "pending-driver-applications"] 
      });
      toast.success("Demande rejetée");
    },
    onError: (error: Error) => {
      toast.error("Erreur: " + error.message);
    },
  });
}
