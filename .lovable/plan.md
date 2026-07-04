
# Géolocalisation ouverte — plan d'intégration

Aucune clé API ni compte externe. Tout basé sur OSM/Nominatim/OSRM (déjà utilisés partiellement).

## 1. Autocomplete d'adresse Nominatim

**Nouveau composant** `src/components/ui/address-autocomplete.tsx`
- Input contrôlé + dropdown de suggestions
- Debounce 400ms sur `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=do,ht&q=...`
- Header `Accept-Language: fr` + User-Agent respectueux (usage policy Nominatim)
- Retourne `{ address, lat, lng, city }` au parent
- Cache local (Map) pour éviter les requêtes répétées

**Intégration dans :**
- `src/pages/Checkout.tsx` — remplace le champ adresse manuel, sauvegarde lat/lng dans `orders.delivery_lat/delivery_lng`
- `src/pages/Profile.tsx` (LocationCard) — permet de fixer l'adresse principale
- `src/components/auth/SellerApplicationForm.tsx` — géocode la boutique à l'inscription

**Migration légère :**
- Ajouter `delivery_lat float8`, `delivery_lng float8` sur `orders` (si absent)

## 2. Itinéraires OSRM tracés

**Nouveau util** `src/utils/osrmRouting.ts`
- `getRoute(from, to)` → `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`
- Retourne `{ coordinates: [[lat,lng]…], distanceKm, durationMin }`
- Fallback ligne droite + Haversine si OSRM down

**Mise à jour composants existants :**
- `DeliveryMapPreview.tsx` — remplace polyline droite par tracé OSRM
- `LiveOrderTracking.tsx` — trace la route restante du livreur → acheteur
- Affichage distance/ETA réels sur la carte

## 3. Zones de livraison avec tarifs

**Nouvelle table** `delivery_zones`
- `name`, `country` (DO/HT), `city`, `base_fee` numeric, `fee_per_km` numeric, `active` bool
- Optionnel: `center_lat/lng` + `radius_km` (pas de PostGIS pour rester simple)
- RLS: lecture publique (anon/auth), écriture admin
- Seed avec Santo Domingo, Santiago, Port-au-Prince (defaults actuels 30 RD$/km)

**Nouveau util** `src/utils/deliveryPricing.ts`
- `getZoneForPoint(lat, lng, zones)` → matche la zone (distance au centre ≤ radius)
- `calculateFee(distanceKm, zone)` → `base_fee + distanceKm * fee_per_km`
- Fallback tarif global (30 RD$/km) si aucune zone

**Manager admin** `src/components/admin/DeliveryZonesManager.tsx`
- CRUD table + toggle active
- Ajouté à `src/pages/Admin.tsx` (onglet "Zones")

**Refactor** `src/pages/Checkout.tsx` — utilise le nouveau util au lieu du calcul hardcodé.

## 4. Vue admin live des livreurs

**Nouveau composant** `src/components/admin/LiveDriversMap.tsx`
- Charge `driver_locations WHERE is_online = true` avec profil (nom, téléphone)
- Abonnement realtime `postgres_changes` sur `driver_locations`
- Marqueur par livreur (icône moto), popup avec info + livraisons en cours
- Auto-refresh toutes les 3s via realtime (pas de polling)
- Filtre par ville / statut

**Ajouté à `src/pages/Admin.tsx`** dans un nouvel onglet "Carte livreurs".

## Détails techniques

### Contraintes Nominatim/OSRM
- Nominatim: max 1 req/sec — géré par debounce
- OSRM public: usage raisonnable, cache côté client des routes calculées
- Aucun secret nécessaire — endpoints publics

### Migration DB
```sql
-- orders: coords de livraison
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat float8;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng float8;

-- delivery_zones
CREATE TABLE delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,        -- 'DO' | 'HT'
  city text,
  center_lat float8,
  center_lng float8,
  radius_km numeric DEFAULT 15,
  base_fee numeric NOT NULL DEFAULT 50,
  fee_per_km numeric NOT NULL DEFAULT 30,
  active bool NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON delivery_zones TO anon, authenticated;
GRANT ALL ON delivery_zones TO service_role;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read zones" ON delivery_zones FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage zones" ON delivery_zones FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
```

### Ce qui **n'est pas** créé
- Tables `positions` / `deliveries` — remplacées par `driver_locations` + `orders` existantes
- WebSocket custom — Supabase Realtime déjà en place
- Edge function `update-location` — le client update directement `driver_locations` (RLS déjà OK)

## Fichiers modifiés / créés

**Créés**
- `src/components/ui/address-autocomplete.tsx`
- `src/utils/osrmRouting.ts`
- `src/utils/deliveryPricing.ts`
- `src/components/admin/DeliveryZonesManager.tsx`
- `src/components/admin/LiveDriversMap.tsx`
- 1 migration SQL

**Modifiés**
- `src/pages/Checkout.tsx`, `src/pages/Profile.tsx`, `src/pages/Admin.tsx`
- `src/components/auth/SellerApplicationForm.tsx`
- `src/components/driver/DeliveryMapPreview.tsx`
- `src/components/tracking/LiveOrderTracking.tsx`

Confirme et je lance l'implémentation.
