# Projet Point marché

Application de préparation, présentation et diffusion des points hebdomadaires GLOBAL. Le site et l’application HTML autonome utilisent les mêmes composants React, styles et règles métier.

## Dossier de projet


Sources de la version hébergée V50, récupérées au commit `eaef774b438a5cb96ed9f6abb3e229c6d29ca969`. La cible HTML autonome sur le réseau interne et les adaptations restantes sont décrites dans le dossier. PURCHASES et la synchronisation multi-utilisateur sur fichiers réseau ne constituent pas des fonctions livrées de cette cible.

Le répertoire technique historique `features/market-pulse/` est conservé pour préserver les imports du code. Le nom du projet est « Projet Point marché ».

## Utilisation

1. Importer Jira et Planner dans le Centre d’import, puis vérifier l’annuaire et les marchés.
2. Choisir le marché ou l’analyste et la semaine.
3. Activer « Modifier le point » pour modifier les blocs directement pendant la réunion.
4. Enregistrer le point, puis préparer le mail avec sa page HTML jointe.

Les corrections apportées aux données importées restent dans le point. Une nouvelle semaine utilise les sources importées ; la reprise du point précédent reste une action explicite. La trame facultative ne bloque pas une simulation dont le contrôle est fait ou dont la catégorie dépasse l’étape 6 ; la catégorie d’abandon 11 reste non finalisée.

Sur le site, les brouillons marché et analyste se sauvegardent automatiquement sur le serveur après une seconde sans saisie. Ils sont repris après réouverture et restent distincts du point partagé, mis à jour avec « Enregistrer ». Les copies concurrentes sont comparées avant tout remplacement. Un état persistant signale les erreurs de connexion et les conflits ; quitter la page avertit si des saisies restent à synchroniser.

Le compte GLOBAL est commun : les personnes connectées partagent les brouillons du compte. Les brouillons ne sont jamais affichés dans la lecture publique. Les dates du bandeau indiquent les imports effectivement utilisés dans le point ; une date historique inconnue reste inconnue.

L’export autonome reste à la livraison du 8 septembre antérieure à cette évolution du site. Il n’est pas recompilé pendant cette phase. Les fichiers `.marketpulse.json` et la récupération locale conservent leur fonctionnement.

## Structure

- `features/market-pulse/` : points marché et analystes, imports, statistiques, graphiques.
- `components/` : contrôles partagés, fenêtres, thèmes, disposition.
- `lib/` : règles métier, normalisation, exports, transport, file de sauvegarde automatique et comparaison des copies.
- `app/api/`, `db/`, `drizzle/` : API du site, base D1 et migrations.
- `offline/` : application autonome, fichier de données et adaptateur des mêmes API.
- `tests/` : tests métier, sauvegardes et scénarios de navigation asynchrone.

## Développement et validation

Utiliser les dépendances verrouillées du dépôt et Node 22.13 ou supérieur.

```sh
npm run dev
npm run build
node --test tests/*.test.mjs
npx tsc --noEmit --incremental false
npm run build:offline -- MARKET_PULSE_LOCAL.html
node scripts/verify-offline.mjs MARKET_PULSE_LOCAL.html VERIFICATION.json
```

L’export sans données initiales ouvre une application vide, prête pour les imports ou l’ouverture d’un fichier existant. Aucun CSV historique n’est nécessaire. Le script de vérification contrôle le JavaScript, les styles, les polices intégrées et les composants communs ; il ne prétend pas effectuer une comparaison visuelle dans un navigateur ni une ouverture dans Outlook.

Voir `docs/review-20260908.md` pour les corrections de la revue complète.

Voir `docs/site-drafts-20260908.md` pour le fonctionnement des brouillons persistants et des conflits.
