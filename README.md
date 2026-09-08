# Market Pulse — points marché et analystes

Application de préparation, présentation et diffusion des points hebdomadaires GLOBAL. Le site et l’application HTML autonome utilisent les mêmes composants React, styles et règles métier.

## Utilisation

1. Importer Jira et Planner dans le Centre d’import, puis vérifier l’annuaire et les marchés.
2. Choisir le marché ou l’analyste et la semaine.
3. Activer « Modifier le point » pour modifier les blocs directement pendant la réunion.
4. Enregistrer le point, puis préparer le mail avec sa page HTML jointe.

Les corrections apportées aux données importées restent dans le point. Une nouvelle semaine utilise les sources importées ; la reprise du point précédent reste une action explicite. La trame facultative ne bloque pas une simulation dont le contrôle est fait ou dont la catégorie dépasse l’étape 6 ; la catégorie d’abandon 11 reste non finalisée.

Sur le site, les brouillons suivent la navigation dans l’onglet. « Enregistrer » les conserve sur le serveur. Dans l’application locale, les commandes de sauvegarde écrivent un fichier `.marketpulse.json` ; une copie de récupération locale protège aussi le travail en cours.

## Structure

- `features/market-pulse/` : points marché et analystes, imports, statistiques, graphiques.
- `components/` : contrôles partagés, fenêtres, thèmes, disposition.
- `lib/` : règles métier, normalisation, exports, transport et brouillons de session.
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
