# V74 — revue transversale du 19 octobre 2026

Base : V73 (c6730cf). Registre de production consulté en lecture seule : 1 238 simulations ; aucun import ni enregistrement métier déclenché pendant la revue.

## Simulations et trames

- Règles partagées pour l’avis, la trame envoyée et la réception fournisseur, indépendamment de la numérotation des étapes.
- Une date valide confirme une trame envoyée ; OUI, NON ou un modèle de date seul ne constituent pas une date exploitable.
- Réception : la date dédiée « réception/retour trame fournisseur » prime. À défaut, « Tarif fournisseur » sert de référence, explicitement indiqué dans l’interface et les statistiques.
- Deux mesures supplémentaires : avis → trame envoyée ; trame envoyée → réception fournisseur. Jours calendaires, zéro accepté, dates absentes/inversées/impossibles exclues.
- Moyenne, médiane, nombre de dossiers et comparaison disponibles dans Statistiques. Tableau paginé des dates et délais utilisés pour vérifier les calculs.
- Conservation de la checklist datée dans les points, y compris après sérialisation JSON. Les anciennes étapes « Fait » ne sont jamais converties en dates inventées.
- Carte de simulation : statut de trame, trois dates, deux délais, indicateurs fournisseur, étapes dépliables et mini-graphe. Commentaire modifiable directement dans le point.

## Cohérence et performance

- Édition limitée au module choisi. Suppression de la double construction du contenu des modules et d’un ancien composant d’insertion inutilisé.
- Ajouts Planner dédoublonnés par identifiant source, sans fusionner des simulations distinctes du même fournisseur.
- Calculs PURCHASES et comparatifs mémorisés indépendamment de la saisie dans les autres blocs.
- Préparation des exports différée de 120 ms pour permettre l’affichage du chargement et regrouper les modifications rapides. Téléchargement indisponible tant que le résultat n’est pas courant ; erreurs explicites.
- Chargements indéterminés pour les sources, le point, Planner et les exports, sans pourcentage fictif.
- Bibliothèque : ouvrir un module existant le fait défiler dans la vue et lui donne le focus. Menu au clavier (Maj+F10), fermeture par Échap.
- Styles mobiles chargés en dernier ; détails des simulations adaptatifs, défilement intérieur contenu, focus visible et respect du mouvement réduit.

## Exports

- Même source de dates et de délais que le point. Mail sans scripts, HTML autonome avec filtres et détails.
- Ordre des fenêtres trié par position verticale puis horizontale ; mode fluide conservant l’ordre choisi. Largeurs reprises sur la grille, hauteur adaptée au contenu pour éviter de couper les informations.
- Titres de bloc conservés sans répéter le titre intérieur. Contraste corrigé des panneaux HTML.
- Commande pour reprendre les modules du point dans les deux exports ; personnalisation distincte conservée. La visibilité de la comparaison des marchés suit le point.
- Impression : ouverture de tous les détails (dont sous-sections), puis restauration de leur état après impression.

## Vérification et limites

275 tests réussis : métier, sérialisation, rendu React serveur, exports et sauvegarde/relecture via les routes du Worker. Compilation TypeScript/Worker réussie. Construction Worker et HTML autonome réussies ; contrôle du JavaScript, des styles, des polices embarquées et des composants partagés du HTML autonome réussi.

Aucun navigateur de test pris en charge disponible dans cette session : interactions visuelles, ouverture réelle dans Outlook et rendu navigateur non certifiés. Le mail utilise une présentation verticale compatible messagerie ; ce n’est pas une reproduction pixel à pixel des fenêtres du point. Les positions libres deviennent un ordre de lecture et des largeurs adaptées dans les exports.
