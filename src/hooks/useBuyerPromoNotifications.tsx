import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getLastPosition } from "@/utils/persistentLocation";

const STORAGE_KEY = "apexl_promo_notifs_v1";
const MIN_INTERVAL_MS = 1000 * 60 * 60 * 6; // au plus une salve toutes les 6h
const MAX_PER_DAY = 3;
const RADIUS_KM = 60;

interface PromoState {
  lastRun: number;
  day: string;
  sentToday: number;
  recentKeys: string[];
}

function readState(): PromoState {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as PromoState;
      if (s.day === today) return s;
      return { lastRun: s.lastRun ?? 0, day: today, sentToday: 0, recentKeys: s.recentKeys ?? [] };
    }
  } catch {}
  return { lastRun: 0, day: today, sentToday: 0, recentKeys: [] };
}

function writeState(s: PromoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface Candidate {
  key: string;
  score: number;
  title: string;
  message: string;
  actionUrl: string;
}

/**
 * Algorithme de notifications publicitaires pour les acheteurs.
 * - 2 à 3 notifications max par jour, jamais plus d'une salve toutes les 6h
 * - Contenu classé par pertinence : panier abandonné > boutique/restaurant proche > nouveautés
 * - Textes générés dans la langue configurée sur le compte
 */
export function useBuyerPromoNotifications() {
  const { user, isSeller, isDriver, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const cart = useCart() as any;

  useEffect(() => {
    if (!user || isSeller || isDriver || isAdmin) return;

    const timer = setTimeout(() => {
      run().catch((e) => console.error("promo notifications", e));
    }, 8000);

    async function run() {
      const state = readState();
      if (Date.now() - state.lastRun < MIN_INTERVAL_MS) return;
      if (state.sentToday >= MAX_PER_DAY) return;

      const pos = getLastPosition();
      const candidates: Candidate[] = [];

      // 1) Panier abandonné (signal le plus fort)
      const items = cart?.items ?? cart?.cartItems ?? [];
      const count = Array.isArray(items)
        ? items.reduce((n: number, it: any) => n + (it.quantity ?? 1), 0)
        : 0;
      if (count > 0) {
        candidates.push({
          key: "cart",
          score: 100,
          title: t("buyerx.promo.cartTitle"),
          message: t("buyerx.promo.cartMsg", { count }),
          actionUrl: "/checkout",
        });
      }

      if (pos) {
        // 2) Boutiques proches
        const { data: shops } = await supabase.rpc("get_public_seller_shops", { p_user_id: null });
        const nearShop = (shops ?? [])
          .map((s: any) => ({
            s,
            km: s.shop_latitude && s.shop_longitude
              ? distanceKm(pos.latitude, pos.longitude, s.shop_latitude, s.shop_longitude)
              : s.latitude && s.longitude
              ? distanceKm(pos.latitude, pos.longitude, s.latitude, s.longitude)
              : null,
          }))
          .filter((x: any) => x.km !== null && x.km <= RADIUS_KM)
          .sort((a: any, b: any) => a.km - b.km)[0];

        if (nearShop) {
          const name = nearShop.s.shop_name ?? nearShop.s.full_name ?? "Boutique";
          candidates.push({
            key: `shop:${nearShop.s.id ?? name}`,
            score: 80 - Math.min(nearShop.km, 60),
            title: t("buyerx.promo.nearShopTitle", { name }),
            message: t("buyerx.promo.nearShopMsg", { km: nearShop.km.toFixed(1) }),
            actionUrl: "/shops",
          });
        }

        // 3) Restaurants proches
        const { data: restos } = await supabase
          .from("restaurants")
          .select("id, name, latitude, longitude")
          .eq("is_active", true)
          .eq("is_approved", true);
        const nearResto = (restos ?? [])
          .filter((r) => r.latitude && r.longitude)
          .map((r) => ({ r, km: distanceKm(pos.latitude, pos.longitude, r.latitude!, r.longitude!) }))
          .filter((x) => x.km <= RADIUS_KM)
          .sort((a, b) => a.km - b.km)[0];

        if (nearResto) {
          candidates.push({
            key: `resto:${nearResto.r.id}`,
            score: 70 - Math.min(nearResto.km, 60),
            title: t("buyerx.promo.nearRestoTitle", { name: nearResto.r.name }),
            message: t("buyerx.promo.nearRestoMsg", { km: nearResto.km.toFixed(1) }),
            actionUrl: `/restaurants/${nearResto.r.id}`,
          });
        }
      }

      // 4) Nouveautés (7 derniers jours)
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
      const { count: newCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("created_at", since);
      if (newCount && newCount > 0) {
        candidates.push({
          key: "new-products",
          score: 40,
          title: t("buyerx.promo.dealTitle"),
          message: t("buyerx.promo.dealMsg", { count: newCount }),
          actionUrl: "/products",
        });
      }

      const remaining = Math.min(MAX_PER_DAY - state.sentToday, 3);
      const picked = candidates
        .filter((c) => !state.recentKeys.includes(c.key))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(2, remaining) === 0 ? 0 : Math.min(remaining, 3));

      if (!picked.length) return;

      const rows = picked.map((c) => ({
        user_id: user!.id,
        title: c.title,
        message: c.message,
        type: "promo",
        action_url: c.actionUrl,
      }));

      const { error } = await supabase.from("notifications").insert(rows);
      if (error) return;

      writeState({
        lastRun: Date.now(),
        day: new Date().toISOString().slice(0, 10),
        sentToday: state.sentToday + picked.length,
        recentKeys: [...state.recentKeys, ...picked.map((c) => c.key)].slice(-12),
      });
    }

    return () => clearTimeout(timer);
    // i18n.language en dépendance : les textes suivent la langue du compte
  }, [user, isSeller, isDriver, isAdmin, i18n.language]);
}

export default function BuyerPromoNotifications() {
  useBuyerPromoNotifications();
  return null;
}
