# Production et conversion locale — V41 du 4 septembre 2026

## Retours intégrés

- Édition directe du point marché derrière un interrupteur de sécurité, sans écran de préparation intermédiaire.
- Promotions séparées des simulations, avec leur propre bloc manuel et leur reprise depuis le point précédent.
- Simulations réduites au nom, au mois et à l’état métier final. La catégorie Planner prime ; une catégorie 8 ou supérieure est faite, même si la trame facultative manque. Une carte arrêtée dans une étape précoce est non finalisée.
- Corrections Jira et simulations conservées dans le point et prioritaires sur les imports suivants.
- Blocs réordonnables par glisser-déposer, largeurs 1/2, 2/3 et pleine, insertion, masquage et remise à zéro de la structure.
- Barre d’édition avec annuler/rétablir, texte de 85 à 130 %, trois densités, couleur, ajustement compact, plein écran et sauvegarde.
- Menu contextuel au clic droit et raccourcis clavier pour la sauvegarde, l’historique et la mise en page.
- Export `.eml` contenant un corps HTML, une alternative texte et la page HTML jointe. Les images du corps sont intégrées par Content-ID pour le mail. Aucun envoi automatique.
- Modes Jira et Planner manuels persistants pour le point marché. Totaux Jira manuels pour le point analyste, distincts des détails du registre et des historiques automatiques.
- Les imports et l’enrichissement Planner ne remplacent pas les saisies manuelles. Les simulations en mode manuel ne sont pas réinjectées dans le registre automatique.
- Comparaison des tickets Jira ouverts par marché, affichage optionnel et camembert interactif au survol ou au clavier.
- Les pages HTML analystes reprennent aussi les dossiers et le repère de cycle lorsqu’ils sont activés.
- Le site et l’application autonome partagent les mêmes composants et les mêmes règles métier.

Les composants partagés sont étendus pour ces retours. La V41 est destinée à être publiée sur le site existant et livrée en application autonome dans le même lot.

## Périmètre demandé

- Application identique au site dans sa présentation et ses parcours métier ; imports effectués ensuite par l’utilisateur.
- Source de référence : production V40, complétée par le lot V41.
- Branche locale : `local-portable-20260902`.
- Livrables : site de production et application HTML autonome, guide et sources.
- Aucun besoin de récupérer les anciens CSV ni de reconstituer intégralement le registre Jira du site.

La précision de l’utilisateur du 3 septembre remplace les anciennes consignes de reprise obligatoire : « Pas besoin d’exporter les csv, j’importerais moi même après, comme l’utilisation prévue ».

## Application livrée

L’entrée locale ouvre directement `MarketPulseApp`. Les composants, feuilles de style, polices Geist et Geist Mono, icônes et graphiques de V41 sont les mêmes que sur le site. Aucun accueil obligatoire ni bandeau supérieur ne modifie la disposition.

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

`scripts/verify-offline.mjs` contrôle le HTML autonome, l’absence de ressources externes, les polices embarquées et la présence des fonctions V41. Les fichiers modifiés sont consignés par empreinte dans le rapport de livraison. Aucune ouverture réelle dans Outlook n’est effectuée automatiquement.

La base de production n’est pas réinitialisée : les anciens points sont normalisés à la lecture et restent accessibles.
