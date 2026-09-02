# Market Pulse — copie locale du site

## Ouvrir l’application

1. Extraire le ZIP dans un dossier sur le PC.
2. Ouvrir **MARKET_PULSE_LOCAL.html** par double-clic, dans Edge ou Chrome récent.
3. Le point marché s’ouvre directement avec les données déjà récupérées. La session précédente est reprise automatiquement si elle existe dans ce navigateur.

L’application utilise les mêmes composants d’interface, feuilles de style, icônes et graphiques que le site V38. Les polices Geist et Geist Mono sont intégrées au HTML et restent disponibles hors connexion. L’écran d’accueil ajouté dans le premier export et la barre supérieure locale ont été retirés.

Les menus Point marché, Préparer le point, Point analyste, Statistiques, Centre d’import, Mail du marché et Paramètres gardent leur présentation habituelle. Les modes clair, sombre et système restent disponibles au même endroit.

## Enregistrer son travail

Le bouton **Sauvegarder** du point marché et **Sauvegarder la semaine** du point analyste enregistrent le point, puis proposent de conserver le fichier complet sur disque. À la première sauvegarde, choisir l’emplacement du fichier `.marketpulse.json`.

**Fichier local**, en bas du menu, permet aussi de :

- enregistrer toutes les données et les brouillons : **Ctrl+S** ;
- enregistrer une autre copie : **Ctrl+Maj+S** ;
- ouvrir un fichier de données : **Ctrl+O**.

Ce panneau remplace l’action de connexion/déconnexion du site : l’application locale ne se connecte pas au serveur. Il n’ajoute aucune barre au-dessus de l’espace de travail.

Si le navigateur ne permet pas l’enregistrement direct, l’application télécharge une copie. Vérifier le téléchargement puis cliquer sur **J’ai bien enregistré la copie**. L’option **Choisir un fichier** permet l’ouverture sans accès direct au disque.

La copie conservée par le navigateur permet de reprendre la session. Le fichier enregistré reste nécessaire pour transférer les données sur un autre PC ou se protéger d’un nettoyage des données du navigateur. Copier ensemble le HTML et le fichier `.marketpulse.json`.

Si une ancienne session vide s’affiche, utiliser **Fichier local → Autres options → Rouvrir la copie du site**. Les changements non enregistrés doivent être conservés avant de changer de fichier.

## Historique Jira encore à compléter

Les **4 marchés, 9 personnes, 4 points marché, 2 points analystes et 1 211 tâches Planner** récupérés sont inclus. Ils sont accessibles dès l’ouverture.

L’extraction Jira ne contient encore que **10 025 tickets sur 12 491** et **10 025 participations sur 11 214**. Les lignes manquantes ne sont pas inventées. Les tableaux Jira contenus dans les points marché déjà sauvegardés sont conservés ; les recalculs analystes attendent le registre complet et signalent cette limite. Un total indisponible n’est pas présenté comme zéro.

Pour retrouver l’intégralité de l’historique, sélectionner le fichier d’origine :

**JIRA WORKSPACE 2026-08-31T09_59_36+0200.csv**

Dans **Centre d’import**, déposer ce CSV comme dans le site, vérifier la prévisualisation puis cliquer sur **Importer**. Le bouton **Choisir le CSV Jira de reprise** dans **Fichier local** permet la même opération.

Le contrôle compare les totaux et toutes les lignes déjà récupérées. Il refuse un fichier incohérent sans modifier les données ouvertes. Une reprise réussie complète uniquement Jira : les dossiers, marchés, préférences, personnes et brouillons modifiés entre-temps sont conservés. Enregistrer ensuite le fichier complet.

Une fois cette reprise terminée, les imports Jira habituels redeviennent disponibles. Aucun fichier de données complet n’est présenté comme final dans ce ZIP tant que le CSV d’origine manque.

## Ce que contient le ZIP

- **MARKET_PULSE_LOCAL.html** : application autonome, polices et données de reprise intégrées.
- **LIRE_MOI.txt** : démarrage rapide.
- **GUIDE_UTILISATION.md** : ce guide.
- **MARKET_PULSE_SOURCES.zip** : sources nécessaires à la maintenance et à la reconstruction.
- **Reprise-technique/** : copie initiale et checkpoint vérifié, conservés pour terminer la reprise.
- **VERIFICATION.json** : contrôles de l’export et limites restantes.

Les liens Jira/Planner et la messagerie ouvrent les outils habituels et nécessitent leur connexion. Les modifications locales ne sont pas synchronisées avec le site. Les données du fichier sont en clair : conserver le fichier dans un emplacement professionnel approprié.

## Vérifications et limites

La compilation autonome, le typage et les 145 tests de l’application passent, notamment pour la sauvegarde, les imports et la conservation des modifications pendant la reprise Jira. Les ressources de présentation du site sont conservées et les polices intégrées sont comparées aux fichiers du site.

Aucune comparaison visuelle interactive dans un navigateur n’a été exécutée. La parité intégrale des données Jira ne peut pas être validée sans le CSV d’origine. Le site V38 et sa base en ligne restent inchangés.
