# Conversion locale — état du 3 septembre 2026

## Retours de réunion intégrés

- Édition du point marché et analyste dans une fenêtre au-dessus de la présentation, avec sauvegarde et retour au point.
- Export `.eml` contenant un corps HTML, une alternative texte et la page HTML jointe. Les images du corps sont intégrées par Content-ID pour le mail. Aucun envoi automatique.
- Modes Jira et Planner manuels persistants pour le point marché. Totaux Jira manuels pour le point analyste, distincts des détails du registre et des historiques automatiques.
- Les imports et l’enrichissement Planner ne remplacent pas les saisies manuelles. Les simulations en mode manuel ne sont pas réinjectées dans le registre automatique.
- Comparaison des tickets Jira ouverts par marché, avec valeurs absentes distinctes de zéro, source et date par marché, capture enregistrée dans le point et affichage optionnel par destination.
- Les pages HTML analystes reprennent aussi les dossiers et le repère de cycle lorsqu’ils sont activés.
- Validation ciblée : 54 tests réussis, contrôle TypeScript réussi. Le rapport livré consigne les compilations et les contrôles de l’HTML autonome.

Les composants partagés sont étendus pour ces retours. La version hébergée V38 reste la référence de départ et n’est pas déployée par cette livraison locale.

## Périmètre demandé

- Application identique au site dans sa présentation et ses parcours métier ; imports effectués ensuite par l’utilisateur.
- Source de référence : production V38, commit `5b669025992454e15a02e351a00847dc974a9f6e`.
- Branche locale : `local-portable-20260902`.
- Livrable : application HTML autonome, guide et sources, sans hébergement.
- Aucun besoin de récupérer les anciens CSV ni de reconstituer intégralement le registre Jira du site.

La précision de l’utilisateur du 3 septembre remplace les anciennes consignes de reprise obligatoire : « Pas besoin d’exporter les csv, j’importerais moi même après, comme l’utilisation prévue ».

## Application livrée

L’entrée locale ouvre directement `MarketPulseApp`. Les composants, feuilles de style, polices Geist et Geist Mono, icônes et graphiques de V38 sont réutilisés. Aucun accueil obligatoire ni bandeau supérieur ne modifie la disposition du site.

Le Centre d’import conserve les parcours du site et ajoute les accès à la saisie manuelle. Son transport HTTP est remplacé par l’adaptateur local dans le HTML autonome. Aucun nom de CSV historique, total de tickets ou contrôle de correspondance avec une extraction passée n’est imposé.

Les commandes de disque sont accessibles dans « Fichier local », en bas de la navigation. Les boutons habituels de sauvegarde des points enregistrent aussi le fichier ; Ctrl+S conserve toutes les données et les brouillons, Ctrl+O rouvre un fichier. Les données Jira, Planner, les participants et les calculs utilisent les règles métier partagées.

## Données initiales et anciennes sauvegardes

Les marchés, les personnes, les points marché et analystes et les tâches Planner déjà récupérés sont conservés dans le HTML livré. Le registre Jira démarre sans tickets et sans ancien journal d’import distant ; l’utilisateur l’alimente depuis le Centre d’import. Aucune extraction Jira partielle n’est embarquée.

À l’ouverture d’une ancienne sauvegarde portant `source.pendingJira`, le magasin local retire ce marqueur, le journal distant qui décrivait des tickets jamais chargés et sa date d’import. Les données métier, brouillons et préférences sont conservés, et la modification est signalée comme à enregistrer. Un classeur sans ce marqueur, y compris ses imports déjà réalisés, reste intact.

Les anciens outils de rapprochement dans `offline/migration-data.ts` et les assembleurs sont conservés comme outils de maintenance historiques. Ils ne sont plus inclus dans l’application autonome et ne conditionnent pas les imports.

## Reconstruction

Avec les dépendances du dépôt installées :

```sh
node scripts/build-offline.mjs MARKET_PULSE_LOCAL.html DONNEES_INITIALES.marketpulse.json
```

Le deuxième argument est un classeur local validé, facultatif. Sans celui-ci, l’application crée un classeur vide. Les données initiales de la livraison sont fournies dans l’archive de sources, hors du dépôt Git. Elles ne contiennent aucun identifiant de connexion.

## Validation

Les vérifications ciblent l’import ordinaire depuis une ancienne sauvegarde, l’absence de dépendance au CSV d’origine, les totaux Jira après import et la sauvegarde/réouverture sans perte. La compilation et le typage vérifient les interfaces partagées.

`scripts/verify-offline.mjs` contrôle le HTML autonome, l’absence de ressources externes de présentation, les 11 polices et les 15 fichiers de présentation inchangés depuis V38. Les fichiers ajoutés ou étendus pour les retours sont identifiés séparément par leur empreinte. Les résultats exacts sont fournis dans le rapport et le journal de la livraison. Aucune comparaison interactive en navigateur ni ouverture dans Outlook n’a été effectuée.

Le projet en production et sa base ne sont pas modifiés.
