# Conversion locale — reprise

## Périmètre

- Version de départ : production V38, commit `5b669025992454e15a02e351a00847dc974a9f6e`.
- Branche : `local-portable-20260902`.
- Livrable : application HTML autonome + fichier de données, sans hébergement.
- Aucun déploiement ni changement des données en production.
- Préserver les règles Jira, Planner, les points et les exports existants.
- Sauvegardes explicites sur disque et récupération locale des brouillons.

## État

- Structure et accès en lecture vérifiés.
- Connexion applicative existante utilisable pour lire les données complètes des points.
- La consultation native de la base tronque les cellules longues : ne pas les utiliser comme sauvegarde complète.
- Conversion du stockage et des imports : adaptateur local et registre commun implémentés ; aucun appel serveur en mode local.
- Ouverture/enregistrement de fichier : fichier `.marketpulse.json`, SHA-256, sauvegarde directe ou copie téléchargée, détection des changements externes, récupération IndexedDB.
- Brouillons : conservés par propriétaire et semaine ; apparence et analyste sélectionné conservés dans le classeur.
- Export initial : 4 marchés, 9 personnes, 4 points marché, 2 points analystes et 1 211 tâches Planner récupérés sans troncature. Export Jira PARTIEL : 10 025 tickets sur 12 491 et 10 025 participations sur 11 214.
- Tests ciblés : 25 tests passent, dont import/relecture de 25 000 tickets, participants, statut Fini, exclusion des abandonnés, dates de modification et transactions de fichier.
- Correctif découvert : le parseur CSV choisissait deux chiffres avant quatre pour l’année. Ordre corrigé et tests de dates complètes/courtes ajoutés. Aucun changement des dates déjà enregistrées dans le registre exporté.
- Vérification TypeScript : réussie après ces changements.
- Compilation du site et du HTML autonome : réussie. Aucun déploiement.
- Suite complète : 133 tests réussis ; contrôle TypeScript réussi ; contrôle des espaces de diff réussi.
- Rapprochement final avec les données complètes et fichier de données utilisable : bloqués par l’export Jira incomplet. Ne pas livrer les données partielles comme un classeur final.

## Blocage à résoudre avant livraison finale

- La lecture native s’arrête à l’offset 10 000 (25 lignes à cet offset). `has_more: false` ne signifie donc pas que les deux tables ont été exportées intégralement.
- Une demande à l’offset 10 025 est rejetée par validation des arguments. Ne pas tenter de dépasser cette limite par un contournement.
- Le site actuel ne propose pas d’endpoint applicatif d’export intégral du registre. Le site et la base doivent rester inchangés.
- La recherche du CSV d’origine dans les fichiers disponibles n’a pas trouvé de fichier Jira complet.
- Solution à demander : joindre le dernier CSV Jira complet déjà utilisé dans le site. Vérifier sa correspondance avec les données récupérées avant de finaliser le classeur.
- Il manque 2 466 tickets et 1 189 lignes de participants dans l’extraction native ; il ne faut ni extrapoler ni fabriquer ces lignes.
- Aucune vérification interactive en navigateur n’a été exécutée. Les vérifications effectuées sont des tests Node, la compilation, le typage et les contrôles statiques.

## Reprise technique

- Le premier état de code est déjà conservé sur la branche distante `local-portable-20260902` (commit `276ada7`).
- Ne pas publier cette branche ni modifier la base distante.
- Les pages natives récupérées sont complètes jusqu’à l’offset autorisé ; conserver ces pages. L’assembleur refuse un nombre de tickets ou de participants différent des totaux attendus.
- Les données métier exportées restent hors du dépôt Git. Les identifiants de connexion ne doivent jamais entrer dans les livrables.
- Fournir l’application, le classeur complet, les sources et un guide en français, puis enregistrer le ZIP téléchargeable de manière durable.

## Vérifications avant livraison

- Aucun appel serveur dans le fichier autonome.
- Aller-retour du fichier sans perte, annulation et erreurs sans écrasement.
- Import Jira > 12 000 lignes, participants et exclusions des abandonnés.
- Calculs hebdomadaires sur la dernière modification Jira.
- Planner partagé, variations et CA par simulation conservés.
- Enregistrement des modifications et réouverture sans navigateur spécifique au poste.
- Données privées et secrets exclus du dépôt source.
- Version en production inchangée.
