# Market Pulse — copie locale du site

## Démarrer

1. Extraire le ZIP dans un dossier sur le PC.
2. Ouvrir **MARKET_PULSE_LOCAL.html** par double-clic dans Edge ou Chrome récent.
3. Utiliser les menus habituels du site. Pour charger ses fichiers, ouvrir **Centre d’import**.

L’application reprend les composants, les styles, les icônes, les graphiques et les polices du site V38. Elle s’ouvre directement sur les points. Les modes clair, sombre et système restent disponibles au même endroit.

Les marchés, les personnes, les points sauvegardés et les tâches Planner déjà récupérés sont inclus. Le registre Jira est prêt pour ton premier import. Aucun CSV d’origine n’est demandé et aucun fichier CSV n’est à récupérer pour démarrer.

## Importer ses données

Dans **Centre d’import**, utiliser les mêmes commandes que sur le site :

- **Jira** : choisir ou déposer son CSV, vérifier la prévisualisation, puis cliquer sur **Importer**. Le nom du fichier et le nombre de tickets ne sont pas imposés par l’export de l’application. Les contrôles habituels des colonnes et des dates restent actifs.
- **Planner** : utiliser la zone d’import Planner habituelle pour charger ses simulations.

Les imports alimentent les points marché, les points analystes et les statistiques. Après un import, enregistrer le fichier local pour conserver les données sur disque.

Une sauvegarde issue de l’ancien export s’ouvre aussi : l’ancienne obligation de reprise Jira est retirée automatiquement. Les modifications des points, les brouillons, les personnes, les marchés, Planner et les préférences restent conservés. Les imports Jira déjà effectués dans un classeur normal restent disponibles.

## Enregistrer et rouvrir

Les boutons **Sauvegarder** du point marché et **Sauvegarder la semaine** du point analyste enregistrent le point puis proposent de conserver le fichier complet sur disque. À la première sauvegarde, choisir l’emplacement du fichier `.marketpulse.json`.

**Fichier local**, en bas du menu, donne accès à :

- **Enregistrer** : Ctrl+S ;
- **Enregistrer sous** : Ctrl+Maj+S ;
- **Ouvrir un fichier** : Ctrl+O.

Si le navigateur télécharge une copie, vérifier le téléchargement puis cliquer sur **J’ai bien enregistré la copie**. **Choisir un fichier** permet de rouvrir une sauvegarde téléchargée.

La dernière session se rouvre automatiquement dans ce navigateur. Pour transférer le travail sur un autre PC, conserver ensemble le HTML et le fichier `.marketpulse.json`. Le fichier enregistré permet aussi de reprendre son travail après un nettoyage des données du navigateur.

Les liens Jira, Planner et la messagerie ouvrent les outils habituels. Les modifications locales sont enregistrées sur le PC et ne sont pas synchronisées avec le site.

## Contenu du ZIP

- **MARKET_PULSE_LOCAL.html** : application autonome prête à l’emploi.
- **LIRE_MOI.txt** : démarrage rapide.
- **GUIDE_UTILISATION.md** : ce guide.
- **MARKET_PULSE_SOURCES.zip** : sources de l’application et données initiales pour sa reconstruction.
- **VERIFICATION.json** : contrôles de l’export.
- **validation-imports.log** : résultats des tests des imports et sauvegardes.
