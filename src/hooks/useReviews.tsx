 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 
 export interface Review {
   id: string;
   order_id: string | null;
   reviewer_id: string;
   reviewed_user_id: string;
   rating: number;
   comment: string | null;
   review_type: string;
   is_visible: boolean;
   created_at: string;
 }
 
 export function useUserReviews(userId: string) {
   return useQuery({
     queryKey: ["user-reviews", userId],
     queryFn: async (): Promise<Review[]> => {
       const { data, error } = await supabase
         .from("reviews")
         .select("*")
         .eq("reviewed_user_id", userId)
         .eq("is_visible", true)
         .order("created_at", { ascending: false });
       
       if (error) throw error;
       return data as Review[];
     },
     enabled: !!userId
   });
 }
 
 export function useAverageRating(userId: string) {
   return useQuery({
     queryKey: ["average-rating", userId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("reviews")
         .select("rating")
         .eq("reviewed_user_id", userId)
         .eq("is_visible", true);
       
       if (error) throw error;
       
       if (!data || data.length === 0) return { average: 0, count: 0 };
       
       const sum = data.reduce((acc, r) => acc + r.rating, 0);
       return { 
         average: Math.round((sum / data.length) * 10) / 10,
         count: data.length 
       };
     },
     enabled: !!userId
   });
 }
 
 export function useCreateReview() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async ({
       orderId,
       reviewedUserId,
       rating,
       comment,
       reviewType
     }: {
       orderId: string;
       reviewedUserId: string;
       rating: number;
       comment: string;
       reviewType: "buyer_to_seller" | "buyer_to_driver" | "seller_to_buyer" | "driver_to_buyer";
     }) => {
       const { error } = await supabase
         .from("reviews")
         .insert({
           order_id: orderId,
           reviewer_id: user!.id,
           reviewed_user_id: reviewedUserId,
           rating,
           comment: comment || null,
           review_type: reviewType
         });
       
       if (error) throw error;
     },
     onSuccess: (_, { reviewedUserId }) => {
       queryClient.invalidateQueries({ queryKey: ["user-reviews", reviewedUserId] });
       queryClient.invalidateQueries({ queryKey: ["average-rating", reviewedUserId] });
     }
   });
 }
 
 export function useCreateReport() {
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async ({
       reportedUserId,
       reportedProductId,
       reportedOrderId,
       category,
       description
     }: {
       reportedUserId?: string;
       reportedProductId?: string;
       reportedOrderId?: string;
       category: string;
       description: string;
     }) => {
       const { error } = await supabase
         .from("reports")
         .insert({
           reporter_id: user!.id,
           reported_user_id: reportedUserId || null,
           reported_product_id: reportedProductId || null,
           reported_order_id: reportedOrderId || null,
           category,
           description
         });
       
       if (error) throw error;
     }
   });
 }