# Synchronisation du build local

La version HTML autonome peut travailler à plusieurs dans un dossier réseau, sans serveur applicatif. Les données restent dans le dossier choisi et dans la copie de récupération du navigateur.

## Première mise en place

1. Ouvrir le nouveau HTML local dans Chrome ou Edge sur ordinateur.
2. Dans **Fichier local**, ouvrir le classeur `.marketpulse.json` à partager. Vérifier les données affichées.
3. Créer un dossier réseau dédié, accessible en lecture et écriture aux personnes concernées.
4. Dans **Fichier local → Travail à plusieurs**, cliquer sur **Rejoindre / créer un dossier partagé**, sélectionner ce dossier et autoriser son accès.
5. Si le dossier est vide, l’application y enregistre les données actuellement ouvertes. S’il contient déjà un journal, l’application charge les données partagées. Conserver une copie du classeur original.
6. Les autres personnes ouvrent le même nouveau HTML, puis rejoignent le même dossier. Elles n’initialisent pas une autre copie dans un autre dossier.

L’accès au dossier est soumis aux possibilités du navigateur et aux restrictions de l’entreprise. Si le sélecteur est absent ou refusé, l’application l’indique et conserve le mode fichier classique. Un téléchargement ou un simple champ « Choisir un fichier » ne donne pas un accès permanent au dossier et n’active pas la synchronisation.

## Pendant le travail

Le journal est vérifié toutes les trois secondes lorsque la page s’exécute. Le navigateur peut ralentir les onglets en arrière-plan : ce délai n’est pas une garantie temps réel. La synchronisation attend la sortie d’un champ et la validation des fiches en cours pour préserver les saisies. Les changements intégrés déclenchent un rechargement de la vue de l’application, sans recharger le HTML.

Les brouillons sont partagés, en plus des points enregistrés. Les choix de navigation propres à chaque session restent locaux. Les modifications de points différents se réunissent. Les éditions concurrentes d’un même point ou brouillon restent sous forme de versions à départager dans **Détails**. Une résolution est elle-même une nouvelle modification ; les versions précédentes restent dans le journal.

Les imports Jira et Planner sont traités chacun comme un lot indivisible pour éviter de mélanger deux imports concurrents.

## En cas de problème

- Un bandeau indique les conflits ou les erreurs d’accès au réseau. **Réessayer / actualiser** relance la vérification.
- En cas de coupure, garder la page ouverte : les saisies non transmises restent locales et sont reprises au retour du réseau. La récupération navigateur reste disponible, selon ses capacités. Pour une copie indépendante sur disque, utiliser **Télécharger une copie**.
- Après fermeture du HTML, rouvrir l’application puis reconnecter le dossier. Ne pas supposer qu’une autorisation donnée dans une autre session reste valable.
- **Enregistrer sous** vers un classeur quitte le partage. **Télécharger une copie** fournit un instantané sans quitter le partage. **Déconnecter le dossier** garde les données en cours dans une session indépendante.
- Ne pas modifier, supprimer ni remplacer les fichiers `point-sync-*.json` pendant le travail. Ils constituent ensemble le journal et les versions concurrentes. Sauvegarder le dossier entier.
- À 10 000 fichiers, l’application demande une rotation : résoudre les conflits, exporter un classeur complet, prévenir les participants et initialiser ensemble un nouveau dossier dédié.

## Fonctionnement et limites

Chaque enregistrement crée un fichier au nom unique, contrôlé par une empreinte d’intégrité et relu après écriture. Les sessions n’écrivent donc pas simultanément dans un même fichier partagé. Chaque modification cite les versions qu’elle remplace : des changements simultanés deviennent des versions concurrentes, plutôt qu’un remplacement silencieux fondé sur l’heure du PC.

Ce mode ne remplace pas une base de données transactionnelle. La disponibilité et les droits du partage réseau restent déterminants ; les suppressions ou modifications externes du journal suspendent la synchronisation. Les validations automatisées couvrent deux sessions, les conflits, les écritures simultanées, les coupures et les saisies arrivant pendant une écriture. Le dossier réseau réel de l’organisation doit être essayé avec deux postes avant généralisation.
