## Plan : disponibilité mondiale + filtrage pays + adresses Printful + multilingue

### 1. Filtrage produits par pays (badge "Hors pays")
- Migration : ajouter `seller_country` sur `products` (auto-rempli depuis `profiles.country` du vendeur via trigger).
- `ProductCard` : comparer `seller_country` au `profile.country` de l'acheteur.
  - Printful → toujours dispo (badge "Mondial · USD")
  - Shopify → existant
  - Local (autre pays) → badge "Hors pays" + bouton désactivé
- `useProducts` : récupérer le pays du profil acheteur et l'injecter dans le contexte.

### 2. Adresse complète au Checkout pour Printful
- Migration `orders` : ajouter `delivery_address2`, `delivery_state`, `delivery_zip`.
- `Checkout.tsx` : si le panier contient un produit Printful, afficher un bloc supplémentaire :
  - Adresse ligne 1, ligne 2 (optionnel), État/Province, Code postal, Pays (select ISO-2).
- `useCheckout` : sauvegarder ces champs sur l'order.
- `printful-create-order` : utiliser ces champs pour le `recipient`.

### 3. Affichage prix Printful (USD → devise utilisateur)
- Nouveau helper `convertDisplayPrice(price, fromCurrency, toCurrency)` utilisant `currency_rates`.
- `ProductCard` Printful : afficher `~ HTG 4 500` (converti) avec sous-titre `(débité 30 USD)`.
- Au checkout, débit en USD réel via wallet USD.

### 4. Multilingue (FR / HT / ES / EN)
- Installer `i18next` + `react-i18next` + `i18next-browser-languagedetector`.
- Créer `src/i18n/index.ts` et `src/i18n/locales/{fr,ht,es,en}.json` avec les chaînes principales (Header, Footer, ProductCard, Checkout, Cart, Profile, Auth).
- Sélecteur de langue dans `Header.tsx` (drapeau + dropdown). Langue persistée en `localStorage`.
- FR reste la langue par défaut.

### Fichiers modifiés
- Migration SQL : `products.seller_country`, `orders.delivery_address2/state/zip`, trigger auto-fill.
- `src/components/ProductCard.tsx`, `src/hooks/useProducts.tsx`, `src/hooks/useProfile.tsx`
- `src/pages/Checkout.tsx`, `src/hooks/useCheckout.tsx`
- `supabase/functions/printful-create-order/index.ts`
- `src/i18n/*` (nouveau), `src/main.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`

Implémentation en une seule passe, commit complet à la fin.