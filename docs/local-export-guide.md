# Market Pulse — copie locale du site

## Démarrer

1. Extraire le ZIP dans un dossier sur le PC.
2. Ouvrir **MARKET_PULSE_LOCAL.html** par double-clic dans Edge ou Chrome récent.
3. Utiliser les menus habituels du site. Pour charger ses fichiers, ouvrir **Centre d’import**.

L’application reprend les composants, les styles, les icônes, les graphiques et les polices du site V38. Elle s’ouvre directement sur les points. Les modes clair, sombre et système restent disponibles au même endroit.

Les marchés, les personnes, les points sauvegardés et les tâches Planner déjà récupérés sont inclus. Le registre Jira est prêt pour ton premier import. Aucun CSV d’origine n’est demandé et aucun fichier CSV n’est à récupérer pour démarrer.

## Modifier pendant le point

Dans le point marché ou analyste, cliquer sur **Modifier pendant le point**. L’éditeur s’ouvre au-dessus de la présentation pour modifier les notes, les dossiers, les actions et les données du point. Cliquer sur **Sauvegarder**, puis **Revenir au point** pour poursuivre la réunion.

Dans le point marché, les boutons placés au-dessus des blocs ouvrent directement la section concernée. La priorité de la semaine a aussi son bouton de modification.

## Préparer le mail et la page jointe

Dans **Mail**, vérifier les destinataires puis cliquer sur **Préparer le mail + la page**. Un fichier **.eml** est téléchargé : il contient l’objet, les destinataires, le corps du point mis en forme et la page HTML en pièce jointe.

Ouvrir ce fichier dans Outlook sur le PC pour vérifier le message et l’envoyer. L’application prépare le fichier ; elle n’envoie pas le mail automatiquement. Le graphique inclus dans le mail est intégré comme image jointe au message.

Les commandes **Copier le corps du mail**, **Version mail** et **Télécharger la page** restent disponibles pour utiliser les éléments séparément. La version mail est un HTML statique ; la page jointe conserve les liens et les interactions.

## Continuer en mode manuel

Dans **Centre d’import**, les boutons **Saisir Jira manuellement** et **Saisir les simulations** ouvrent la saisie du marché actif. Les sections Jira et Simulations proposent aussi **Import automatique / Saisie manuelle**.

- **Point marché — Jira** : renseigner les totaux par personne et statut.
- **Point marché — Simulations** : modifier les opérations, leur état et leurs étapes.
- **Point analyste — Jira** : en préparation ou pendant le point, passer en manuel et renseigner les totaux de tickets terminés dans la semaine et encore ouverts.

Le choix est enregistré avec le point. Un nouvel import ne remplace pas ses valeurs manuelles. Le retour en automatique demande un import disponible ; il conserve la saisie si le chargement échoue. Les totaux manuels sont identifiés dans la présentation et les exports.

## Comparer les marchés

Cliquer sur **Comparer les marchés** dans le point marché. Le camembert compare les **tickets Jira ouverts**, avec le nombre et le pourcentage de chaque marché. Les lignes indiquent la source utilisée : import, saisie manuelle ou point enregistré. Un marché sans données est signalé et exclu du calcul des pourcentages.

Le graphique est consultable dans cette fenêtre sans être ajouté au point. Cocher **Afficher dans le point et ses exports** pour l’inclure ; décocher pour le retirer. Le choix est conservé à la sauvegarde. Les réglages de personnalisation permettent aussi de choisir séparément l’affichage dans le point, le mail et la page HTML.

**Actualiser les marchés** remplace la comparaison par les dernières données disponibles. La comparaison sauvegardée reste stable jusqu’à cette actualisation, sauf le total du marché actif lorsqu’il est modifié manuellement dans le point.

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
- **validation-retours.log** : résultats des tests des nouveaux parcours et des sauvegardes.
