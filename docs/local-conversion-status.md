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

## Reprise guidée du 2 septembre 2026

- Le HTML autonome contient maintenant une sauvegarde de reprise contrôlée par SHA-256. Cette sauvegarde ne peut pas être ouverte comme un classeur complet.
- L’accueil propose « Choisir le CSV Jira de reprise ». Aucun serveur ni installation n’est nécessaire pour compléter l’export sur le PC de l’utilisateur.
- Fichier identifié dans l’import terminé : `JIRA WORKSPACE 2026-08-31T09_59_36+0200.csv` ; 12 491 tickets, 11 214 participations, aucune ligne rejetée lors de l’import initial.
- Le rapprochement compare les champs des 10 025 tickets récupérés et les 10 025 participations récupérées, ainsi que les totaux du CSV. Il refuse une extraction incomplète, des doublons, des dates invalides ou un fichier dont le contenu connu a changé.
- L’application conserve les champs et dates récupérés, complète les tickets et participants manquants depuis le CSV, puis ouvre le classeur complet avec l’état « à enregistrer ». Les autres données et métadonnées des imports sont conservées.
- Un CSV refusé laisse le classeur courant intact. La sauvegarde initiale demeure disponible dans le HTML.
- 33 tests ciblés réussis (8 nouveaux tests de reprise, 18 tests du classeur local et 7 tests CSV) ; contrôle TypeScript sans émission et compilation du HTML réussis.
- Le classeur réel complet n’a pas encore été produit : le CSV d’origine n’est pas disponible dans la conversation. Aucune vérification interactive dans un navigateur n’a été exécutée.

## Blocage à résoudre avant livraison finale

- La lecture native s’arrête à l’offset 10 000 (25 lignes à cet offset). `has_more: false` ne signifie donc pas que les deux tables ont été exportées intégralement.
- Une demande à l’offset 10 025 est rejetée par validation des arguments. Ne pas tenter de dépasser cette limite par un contournement.
- Le site actuel ne propose pas d’endpoint applicatif d’export intégral du registre. Le site et la base doivent rester inchangés.
- La recherche du CSV d’origine dans les fichiers disponibles n’a pas trouvé de fichier Jira complet.
- Solution prête : sélectionner le CSV d’origine identifié ci-dessus dans le HTML livré, ou le joindre à la conversation pour finaliser le classeur ici. Le contrôle de correspondance est obligatoire avant l’activation des données.
- Il manque 2 466 tickets et 1 189 lignes de participants dans l’extraction native ; il ne faut ni extrapoler ni fabriquer ces lignes.
- Aucune vérification interactive en navigateur n’a été exécutée. Les vérifications effectuées sont des tests Node, la compilation, le typage et les contrôles statiques.

## Reprise technique

- Le premier état de code est déjà conservé sur la branche distante `local-portable-20260902` (commit `276ada7`).
- Ne pas publier cette branche ni modifier la base distante.
- Les pages natives récupérées sont complètes jusqu’à l’offset autorisé ; conserver ces pages. L’assembleur refuse un nombre de tickets ou de participants différent des totaux attendus.
- Les données métier exportées restent hors du dépôt Git. Les identifiants de connexion ne doivent jamais entrer dans les livrables.
- Fournir l’application, le classeur complet, les sources et un guide en français, puis enregistrer le ZIP téléchargeable de manière durable.

## Reproduire la reprise guidée

Depuis le dépôt, avec ses dépendances installées :

```sh
node scripts/prepare-local-recovery.mjs DOSSIER_EXPORT REPRISE.json
node scripts/build-offline.mjs MARKET_PULSE_LOCAL.html REPRISE.json
```

Le dossier d’export conserve `application-data.json`, `export-status.json` et les pages natives dans `raw/`. Il reste hors du dépôt. Le fichier de reprise et le HTML qui l’embarque contiennent des données métier ; ils ne doivent jamais être ajoutés au dépôt source.

Une fois le CSV d’origine disponible, le même rapprochement peut être exécuté sans navigateur :

```sh
node scripts/assemble-local-recovery.mjs REPRISE.json JIRA_ORIGINE.csv Market_Pulse_GLOBAL.marketpulse.json
```

Les assembleurs refusent d’écraser un fichier de destination existant. `scripts/assemble-local-workbook.mjs` reste réservé à une extraction native intégrale.

## Vérifications avant livraison

- Aucun appel serveur dans le fichier autonome.
- Aller-retour du fichier sans perte, annulation et erreurs sans écrasement.
- Import Jira > 12 000 lignes, participants et exclusions des abandonnés.
- Calculs hebdomadaires sur la dernière modification Jira.
- Planner partagé, variations et CA par simulation conservés.
- Enregistrement des modifications et réouverture sans navigateur spécifique au poste.
- Données privées et secrets exclus du dépôt source.
- Version en production inchangée.
