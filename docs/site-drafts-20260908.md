# Brouillons persistants — site, 8 septembre 2026

Périmètre accepté : se concentrer sur le site pendant l’indisponibilité du PC d’Emmanuel. Aucune nouvelle compilation ni livraison de l’application autonome. Les parcours sur téléphone réel et dans Outlook seront à essayer lors de la reprise utilisateur.

## Fonctionnement

- Un brouillon par compte éditeur, type de point, marché/analyste et semaine ISO, dans D1. Accès authentifié uniquement. Le compte GLOBAL actuellement commun implique des brouillons communs aux personnes connectées.
- Sauvegarde automatique après une seconde sans saisie ; file indépendante pour chaque semaine, conservée pendant les changements de vue. Une nouvelle session retrouve la copie serveur.
- Le point partagé reste une action explicite. Une sauvegarde automatique ne crée ni ne remplace un point visible dans l’historique public.
- Chaque écriture compare la révision du brouillon et celle du point dont il est issu. Une sauvegarde ancienne est refusée. L’enregistrement du point et l’avancement de son brouillon se font dans une seule transaction D1.
- Une réponse lente conserve les nouvelles saisies. Une réponse d’autosauvegarde perdue peut être rapprochée de la copie exacte déjà présente. Les erreurs restent visibles, avec reprise automatique limitée et bouton Réessayer. Le retour de connexion déclenche une synchronisation et la fermeture avertit des saisies encore en attente.
- Les conflits ouvrent une comparaison des champs modifiés. L’utilisateur choisit la copie à reprendre ou conserve la sienne. Ce choix reste soumis à une nouvelle écriture conditionnelle : une évolution pendant la comparaison est détectée aussi. Il n’y a pas de fusion automatique des contenus.
- Le bandeau des sources indique les imports effectivement copiés dans le point marché et le nombre d’éléments Jira/simulation corrigés. La saisie manuelle est identifiée ; les dates inconnues d’anciens points ne sont pas inventées. Le point analyste indique son instantané Jira et la source Planner de ses statistiques calculées.

## Organisation et migration

`db/point-store.ts` centralise les requêtes préparées et transactions. `lib/hosted-point-drafts.ts` gère la file et les réponses asynchrones. `point-sync-status.tsx` et `point-source-status.tsx` portent les composants partagés ; `lib/point-conflict.ts` prépare les différences lisibles.

Migration additive `0011_flippant_santa_claus.sql` : table `point_drafts`, deux index, colonne texte `revision` de valeur constante initiale sur les deux tables de points existantes. Aucun contenu métier n’est supprimé et aucune ancienne migration n’est modifiée. Les anciens clients sans révision reçoivent une erreur explicite et doivent recharger le site avant d’enregistrer.

Le seul ajustement de l’adaptateur local est le champ de révision exigé par le type partagé ; le fichier autonome déjà distribué n’est pas touché.

## Validation

189 tests automatiques passent. La vérification TypeScript sans cache et la compilation Sites de production réussissent ; le Worker ESM et le manifeste de publication sont validés. Les nouveaux scénarios exécutent les routes et transactions contre SQLite après toutes les migrations, ainsi que les composants réels avec un banc de hooks : sauvegarde différée, réouverture sans publication, séparation des semaines, droits d’accès, conflits sur créations et mises à jour, réponse lente/perdue, nouvelle modification pendant une sauvegarde, et choix concurrent pendant la comparaison. Les tests existants couvrent les règles métier, imports, exports de points et navigation.

Pas de test navigateur, téléphone réel ou Outlook sur cette livraison. La revue visuelle réelle reste à faire avec l’utilisateur.
