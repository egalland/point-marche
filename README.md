# Point marché

Application GLOBAL pour préparer, présenter et diffuser les points hebdomadaires des marchés et des analystes : dossiers, simulations, promotions, activité Jira et variations fournisseurs.

**Version des sources : V91** · Interface en français · Ordinateur et mobile


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
| V91 | Reprise du sprite original de l’oie de Redline et de ses huit poses animées. |
| V90 | Ajout d’une oie discrète dans le footer et de sa séquence animée. |
| V89 | Point marché bord à bord sur mobile, sans padding extérieur latéral. |
| V88 | Harmonisation des alignements, des espacements, du calendrier et du menu mobile. |
| V86–V87 | Signalement des bugs et idées, destinataires configurables, captures d’écran et suivi des demandes. |

<details>
<summary>🪿 Une oie dans le footer ?</summary>

Un clic ouvre une séquence d’environ 43 secondes : danse, changements de couleurs, dédoublements, gros plan avec la main du Penseur, reprise de la danse, puis pause contemplative.

La tête reste immobile pendant dix secondes, suivies de « qu'est ce que je fais ici » pendant cinq secondes, « ... » pendant cinq secondes, puis « bref ». Une dernière danse précède le départ rapide de l’oie et le retour automatique à l’application.

La croix et la touche Échap permettent de revenir immédiatement au Point marché. La séquence conserve le travail en cours et respecte la préférence de réduction des animations.

</details>

## Structure du dépôt

| Dossier | Contenu |
| --- | --- |
| `features/market-pulse/` | Points marché et analystes, imports, fournisseurs, statistiques et gestion des demandes. |
| `components/` | Contrôles partagés, fenêtres, aide et oie cachée. |
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

Pour la V91, la compilation du site, TypeScript et les tests de chronologie de l’oie ont été validés. Le rendu visuel de cette séquence n’a pas été vérifié dans le navigateur de l’environnement de développement.

## Documentation

- [Données PURCHASES](docs/purchaseData.md)
- [Brouillons persistants et conflits](docs/site-drafts-20260908.md)
- [Historique GitHub](docs/Synchronisation_GitHub.md)
- [Aide historique V51](docs/v51.md) et [mode opératoire V51](docs/Mode_Operatoire_V51.md)

Les documents associés à une ancienne version décrivent l’état de cette version ; le code et le présent README reflètent les évolutions plus récentes.
