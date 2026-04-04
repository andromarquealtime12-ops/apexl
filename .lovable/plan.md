

## Diagnostic

**Probleme principal identifie** : Apres le checkout, les commandes ne s'affichent pas pour l'acheteur ni le vendeur, meme si l'argent est debite et les commandes existent bien en base de donnees.

**Cause racine** : Incompatibilite des cles de cache (query keys).

- Le hook `useCheckout` invalide la cle `["orders"]` apres le checkout
- Mais `BuyerOrdersTracker` ecoute sur `["buyer-orders", user.id]`
- Et `useSellerOrders` ecoute sur `["seller-orders", user.id]`
- Resultat : les donnees ne se rafraichissent jamais cote UI apres un achat

## Plan de correction

### Etape 1 : Corriger l'invalidation du cache dans useCheckout

Dans `src/hooks/useCheckout.tsx`, modifier le `onSuccess` pour invalider les bonnes cles :
- `["buyer-orders"]` au lieu de `["orders"]`
- Ajouter `["seller-orders"]` pour que le vendeur voie aussi la commande
- Garder `["wallet"]` et `["wallet-transactions"]`

### Etape 2 : Redirection automatique vers les commandes

Apres une commande reussie sur la page Checkout, au lieu de montrer juste un ecran de succes statique, s'assurer que le bouton "Voir mes commandes" fonctionne et qu'on invalide aussi `["buyer-orders"]` dans le composant Checkout.

### Etape 3 : Corriger l'invalidation dans les autres hooks

Verifier que `useDriverActions` et `OrderReadyButton` invalident aussi les bonnes cles (`["seller-orders"]`, `["buyer-orders"]`) quand le statut d'une commande change, pour que les mises a jour soient visibles en temps reel.

---

### Detail technique

**Fichier** : `src/hooks/useCheckout.tsx`
```
// Remplacer:
queryClient.invalidateQueries({ queryKey: ["orders"] });
// Par:
queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
```

C'est une correction simple mais critique qui resout le probleme de visibilite des commandes.

