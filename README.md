# Point marché

Application pour préparer, présenter et diffuser les points hebdomadaires des marchés et des analystes : dossiers, simulations, promotions, activité Jira et variations fournisseurs.

**Version des sources : V94** · Interface en français · Ordinateur et mobile



## Fonctionnalités

| Espace | Fonctionnement |
| --- | --- |
| Point marché | Sélection du marché et de la semaine, calendrier, reprise sélective du point précédent et édition directe des blocs. |
| Mise en page | Placement et redimensionnement des modules, aide à l’alignement, réglages de densité et de taille du texte. |
| Point analyste | Suivi individuel des activités et préparation des points à partir des données importées. |
| Centre d’import | Imports Jira, Planner et PURCHASES, suivi des sources et des dates d’actualisation. |
| Fournisseurs | Recherche, profils, simulations, variations, trames et consultation des données PURCHASES. |
| Statistiques | Indicateurs d’activité, délais, tendances et comparaisons de périodes. |
| Diffusion | Préparation du mail Outlook et de sa page HTML jointe, exports et téléchargements. |
| Bugs et idées | Boîte de réception, USERCODE du déclarant, captures d’écran, statuts et dates de suivi. |

L’interface propose les thèmes clair, sombre et système. Le menu latéral peut afficher les textes ou uniquement les pictogrammes. Sur mobile, le point marché utilise toute la largeur disponible.

Le module achats du point présente une synthèse du périmètre sélectionné : volumes, évolution, fournisseurs les plus représentés et articles récurrents. Les réglages et le tableau détaillé restent accessibles en édition. Les nouvelles vues utilisent une période basée sur la semaine du point.

La page HTML jointe reprend les titres, l’ordre, les largeurs et les positions des blocs du point ; son contenu reste dépliable et imprimable. Le mail affiche directement les données et les détails nécessaires, avec une présentation verticale compatible avec les clients de messagerie. Les commentaires Jira et la synthèse achats sont conservés dans les deux formats.

## Parcours d’utilisation

1. Vérifier les marchés et l’annuaire dans les paramètres.
2. Charger les sources nécessaires dans le Centre d’import.
3. Choisir le marché ou l’analyste, puis la semaine du point.
4. Ajouter, organiser et modifier les blocs ; reprendre si nécessaire les éléments du point précédent.
5. Contrôler les indicateurs et les dates des sources, puis préparer le mail et sa page HTML.

Les modifications bénéficient d’une sauvegarde automatique avec un état de synchronisation visible. Les erreurs de connexion et les conflits de copies sont signalés dans l’interface. La reprise d’un point précédent reste une action explicite.

Les corrections des données importées sont conservées dans le point concerné. Les dates des sources correspondent aux imports effectivement utilisés ; une date historique inconnue n’est pas inventée.

## Signaler un bug ou proposer une idée

Les entrées **Signaler un bug**, **Soumettre une idée** et **Boîte Bugs & idées** sont accessibles dans la navigation.

Une demande contient un titre, une description, le USERCODE du déclarant et, si nécessaire, des captures d’écran. Son statut et ses dates permettent de suivre son traitement.

Dans **Paramètres → Bugs et idées**, renseigner les destinataires de notification, séparés par des points-virgules, dans la limite de dix adresses. La case **Signaler par mail** prépare un message dans la messagerie par défaut, notamment Outlook si configuré. L’utilisateur vérifie et envoie le message ; il ne s’agit pas d’un envoi automatique en arrière-plan.

## Site et version HTML autonome

Le site et la cible HTML autonome réutilisent les composants React, les styles et les règles métier. L’adaptateur local remplace les appels aux API du site pour les usages hors hébergement.

La version autonome se génère depuis les sources. Sans données initiales, elle ouvre un espace vide, prêt à importer des données ou à ouvrir un fichier existant. Les fichiers de travail utilisent notamment le format `.marketpulse.json`.

Le stockage partagé dépend du mode d’exécution : un simple dossier réseau ne fournit pas les API ni les services serveur du site hébergé.

## Dernières mises à jour

| Version | Évolution |
| --- | --- |
| V94 | Retrait de l’animation cachée du pied de page. |
| V92 | Placement bord contre bord, suppression de l’espace obligatoire et aimantation sans déplacement des voisins au contact. |
| V89 | Point marché bord à bord sur mobile, sans padding extérieur latéral. |
| V88 | Harmonisation des alignements, des espacements, du calendrier et du menu mobile. |
| V86–V87 | Signalement des bugs et idées, destinataires configurables, captures d’écran et suivi des demandes. |

## Structure du dépôt

| Dossier | Contenu |
| --- | --- |
| `features/market-pulse/` | Points marché et analystes, imports, fournisseurs, statistiques et gestion des demandes. |
| `components/` | Contrôles partagés, fenêtres et aide. |
| `app/styles/` | Styles des modules, thèmes et adaptations responsive. |
| `lib/` | Règles métier, normalisation, calculs, exports et sauvegardes. |
| `app/api/`, `db/`, `drizzle/` | API du site, accès aux données et migrations. |
| `offline/` | Application autonome et adaptateur des API locales. |
| `scripts/` | Compilation, préparation et vérification des livrables. |
| `tests/` | Tests métier, données, sauvegardes, dialogues et séquences. |
| `docs/` | Dossier de projet, modes opératoires et notes techniques historiques. |

Le chemin technique historique `features/market-pulse/` est conservé pour la compatibilité des imports.

## Développement

Node.js **22.13 ou supérieur** et dépendances verrouillées du dépôt.

```sh
npm run install:ci
npm run dev
```

Compilation et contrôles :

```sh
npm run build
node --test tests/*.test.mjs
npx tsc --noEmit --incremental false
```

Génération et vérification du HTML autonome :

```sh
npm run build:offline -- MARKET_PULSE_LOCAL.html
node scripts/verify-offline.mjs MARKET_PULSE_LOCAL.html VERIFICATION.json
```

Le vérificateur du HTML autonome contrôle notamment les scripts, les styles, les polices intégrées et les composants communs. Il ne remplace pas une vérification visuelle dans un navigateur ou une ouverture du mail dans Outlook.

La compilation et les vérifications adaptées sont réalisées avant publication.

## Documentation

- [Données PURCHASES](docs/purchaseData.md)
- [Brouillons persistants et conflits](docs/site-drafts-20260908.md)
- [Historique GitHub](docs/Synchronisation_GitHub.md)
- [Aide historique V51](docs/v51.md) et [mode opératoire V51](docs/Mode_Operatoire_V51.md)

Les documents associés à une ancienne version décrivent l’état de cette version ; le code et le présent README reflètent les évolutions plus récentes.
