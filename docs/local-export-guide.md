# Market Pulse — copie locale du site

## Démarrer

1. Extraire le ZIP dans un dossier sur le PC.
2. Ouvrir **MARKET_PULSE_LOCAL.html** par double-clic dans Edge ou Chrome récent.
3. Utiliser les menus habituels du site. Pour charger ses fichiers, ouvrir **Centre d’import**.

L’application reprend exactement l’interface et les fonctions du site V41. Elle s’ouvre directement sur les points. Les modes clair, sombre et système restent disponibles au même endroit.

Les marchés, les personnes, les points sauvegardés et les tâches Planner déjà récupérés sont inclus. Le registre Jira est prêt pour ton premier import. Aucun CSV d’origine n’est demandé et aucun fichier CSV n’est à récupérer pour démarrer.

## Modifier pendant le point

Dans l’en-tête du point marché, activer **Modifier le point**. Il n’y a plus d’écran de préparation intermédiaire : les champs deviennent directement modifiables dans les cartes. Les corrections d’une simulation ou d’un ticket importé sont enregistrées dans le point et restent prioritaires lors d’une nouvelle synchronisation.

La barre d’édition permet d’annuler/rétablir, régler le texte de 85 à 130 %, choisir une densité, changer la couleur, ajuster le point, passer en plein écran et enregistrer. La poignée **⋮⋮** déplace un bloc ; les boutons **1/2**, **2/3** et **1/1** règlent sa largeur. Un clic droit ouvre les mêmes commandes. Les boutons **+ Ajouter un bloc ici** réaffichent un bloc masqué.

Raccourcis : **Ctrl+S** enregistrer, **Ctrl+Z / Ctrl+Y** annuler/rétablir, **Ctrl+Maj+E** activer ou couper l’édition, **Alt+↑/↓** déplacer le bloc sélectionné, **Alt+←/→** changer sa largeur, **Suppr** masquer le bloc sélectionné et **Échap** le désélectionner.

## Préparer le mail et la page jointe

Dans **Mail**, vérifier les destinataires puis cliquer sur **Préparer le mail + la page**. Un fichier **.eml** est téléchargé : il contient l’objet, les destinataires, le corps du point mis en forme et la page HTML en pièce jointe.

Ouvrir ce fichier dans Outlook sur le PC pour vérifier le message et l’envoyer. L’application prépare le fichier ; elle n’envoie pas le mail automatiquement. Le graphique inclus dans le mail est intégré comme image jointe au message.

Les commandes **Copier le corps du mail**, **Version mail** et **Télécharger la page** restent disponibles pour utiliser les éléments séparément. La version mail est un HTML statique ; la page jointe conserve les liens et les interactions.

## Continuer en mode manuel

Dans **Centre d’import**, les boutons **Saisir Jira manuellement** et **Saisir les simulations** ouvrent la saisie du marché actif. Les sections Jira et Simulations proposent aussi **Import automatique / Saisie manuelle**.

- **Point marché — Jira** : renseigner les totaux par personne et statut.
- **Point marché — Simulations** : modifier uniquement le nom, le mois et l’état métier final utile au point.
- **Point marché — Promotions** : renseigner séparément le nom, la période, la promotion achat, l’état vente, l’action et le commentaire.
- **Point analyste — Jira** : en préparation ou pendant le point, passer en manuel et renseigner les totaux de tickets terminés dans la semaine et encore ouverts.

Le choix est enregistré avec le point. Un nouvel import ne remplace pas ses valeurs manuelles. Le retour en automatique demande un import disponible ; il conserve la saisie si le chargement échoue. Les totaux manuels sont identifiés dans la présentation et les exports.

## Comparer les marchés

Cliquer sur **Comparer les marchés** dans le point marché. Le camembert compare les **tickets Jira ouverts**, avec le nombre et le pourcentage de chaque marché. Les lignes indiquent la source utilisée : import, saisie manuelle ou point enregistré. Un marché sans données est signalé et exclu du calcul des pourcentages.

Le graphique est consultable dans cette fenêtre sans être ajouté au point. Survoler une part ou sa légende affiche immédiatement le marché, le nombre de tickets et le pourcentage. Le clavier fonctionne aussi par tabulation. Cocher **Afficher dans le point et ses exports** pour l’inclure ; décocher pour le retirer. Le choix est conservé à la sauvegarde.

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
