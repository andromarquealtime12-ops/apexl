
## 1. Email de confirmation postulation vendeur/livreur

**Problème actuel** : quand l'utilisateur clique "Envoyer le lien", `resend({ type: "signup" })` renvoie un lien vers `EMAIL_CONFIRMATION_URL` par défaut qui pointe sur la racine, l'utilisateur ne comprend pas où atterrit le lien.

**Correctif** :
- Passer `emailRedirectTo: ${window.location.origin}/profile?verified=1` dans `resend()` et `updateUser({ email })` (fichier `useEmailVerification.tsx`).
- Sur `/profile`, si `?verified=1` est présent, afficher un toast succès + rafraîchir le profil.
- Dans les formulaires vendeur/livreur, afficher un message explicite après envoi : "Vérifie ta boîte + spams. Le lien te ramène ici".

## 2. Prioriser les produits du même pays

**Détection pays** (GPS prioritaire, profil fallback) :
- Ajouter helper `src/utils/userCountry.ts` : lit `persistentLocation` → reverse-geocode Nominatim → code pays ISO ("DO", "HT", "US"…). Cache 24h dans localStorage. Fallback sur `profiles.country`.

**Données** :
- Colonne `seller_country` déjà présente sur `products` (mémoire "Country Visibility"). Vérifier + backfill si vide via trigger sur `profiles.country`.

**Affichage** :
- `Products.tsx` et `Shops.tsx` / `Restaurants.tsx` : tri à 2 clés → (1) `seller_country === userCountry` d'abord, (2) puis distance croissante.
- Badge "🇭🇹 Local" ou drapeau pays sur chaque `ProductCard` quand pays match.

## 3. Adresse auto au checkout (GPS + confirmation)

Dans `src/pages/Checkout.tsx` :
- Au montage, si permission GPS accordée (ou déjà en localStorage via `persistentLocation`) → reverse-geocode Nominatim → pré-remplir `deliveryAddress`, `deliveryCity`, `deliveryState`, `deliveryZip`, `deliveryCountry`.
- Bouton "📍 Utiliser ma position actuelle" toujours visible pour re-déclencher.
- Case à cocher "✅ Confirmer que je suis à cette adresse" (obligatoire pour valider). Si l'utilisateur modifie manuellement, la case se décoche et un message "Adresse différente de ta position — assure-toi qu'elle est correcte" apparaît.
- Recalcul auto des frais de livraison quand adresse ou GPS change.

## 4. Distance routière réelle pour le livreur (pas ligne droite)

Dans `src/components/driver/AvailableDeliveriesTable.tsx` + `DeliveryMapPreview.tsx` :
- Utiliser `osrmRouting.ts` (déjà présent) pour calculer 2 segments :
  - **Segment 1** : position live du livreur → boutique du vendeur.
  - **Segment 2** : boutique vendeur → adresse acheteur.
- Afficher : "🚗 Toi → Vendeur : X km · Vendeur → Client : Y km · Total : Z km".
- Cache 5 min par (order_id, driver_pos_rounded) pour éviter de spammer OSRM.
- `DeliveryMapPreview` trace les 2 polylines routières (bleu = pickup, vert = delivery).

## 5. Tarifs par km selon pays (14 RD$ / 75 HTG / 1 USD)

**Migration** :
- Nettoyer/insérer les zones dans `delivery_zones` :
  - `DO` : base_fee 50, fee_per_km **14**, currency DOP.
  - `HT` : base_fee 200, fee_per_km **75**, currency HTG.
  - `US` : base_fee 5, fee_per_km **1**, currency USD.
  - `DEFAULT` (fallback global) : base_fee 5, fee_per_km 1, currency USD.
- Le fallback dur dans `deliveryPricing.ts` reste 14 DOP pour DO (conforme aux tests existants).

**Code** :
- `Checkout.tsx` : la devise de la commande = celle de la zone détectée (plus de force DOP). Wallet débité dans la devise correspondante (conversion via `currency_rates` si le wallet source diffère).
- `ProductCard.tsx` : afficher frais estimés dans la devise de la zone du vendeur.

## Fichiers modifiés

- `supabase/migrations/*.sql` (nouvelle migration : zones + trigger backfill `seller_country`).
- `src/utils/userCountry.ts` (nouveau).
- `src/hooks/useEmailVerification.tsx`.
- `src/components/auth/SellerApplicationForm.tsx`, `DriverApplicationForm.tsx`.
- `src/pages/Profile.tsx`, `Checkout.tsx`, `Products.tsx`, `Shops.tsx`, `Restaurants.tsx`.
- `src/components/ProductCard.tsx`.
- `src/components/driver/AvailableDeliveriesTable.tsx`, `DeliveryMapPreview.tsx`.
- `src/utils/deliveryPricing.ts` (helpers pays → zone).

Réponds "go" pour que je lance tout d'un coup.
