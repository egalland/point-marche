# Organisation durable de la version locale

## Dossiers permanents

| Emplacement | Rôle | Lors d’une mise à jour |
| --- | --- | --- |
| DEMARRER.html | Ouvre application/Point_Marche.html | Conserver |
| application/ | HTML autonome, notices et version.json | Remplacer par le nouveau dossier application |
| donnees/ | Classeurs .marketpulse.json ou sous-dossier dédié au journal partagé | Conserver intégralement |
| sauvegardes/ | Copies datées des classeurs et du journal complet | Conserver intégralement |

Les noms et chemins ne portent pas de numéro de version. Le numéro figure dans application/version.json et dans le nom du ZIP livré. La structure est en version 1 ; la version du moteur figure dans application/version.json. Cette réorganisation ne modifie pas le format des données.

## Première installation ou passage depuis une ancienne version

1. Depuis l’ancienne application, terminer les saisies, attendre les enregistrements et, en partage, la synchronisation sur tous les postes.
2. Télécharger une copie complète du classeur sur disque. Sauvegarder aussi le journal partagé entier. Fermer les anciennes fenêtres.
3. Extraire le paquet d’installation dans le dossier permanent souhaité. Il contient application/, donnees/, sauvegardes/ et DEMARRER.html, sans données préremplies.
4. Ouvrir DEMARRER.html dans Chrome ou Edge sur ordinateur. Le lien ouvre toujours le même HTML dans application/.
5. Dans « Fichier local », ouvrir le classeur existant ou l’enregistrer sous dans donnees/. Pour le travail à plusieurs, rejoindre le dossier partagé EXISTANT. Il peut rester à son emplacement actuel ; il n’est pas obligatoire de le déplacer. Pour un nouveau partage, sélectionner un sous-dossier dédié dans donnees/.
6. Contrôler les points, dossiers, imports et paramètres, puis actualiser les raccourcis vers DEMARRER.html. Conserver l’ancienne installation comme secours tant que cette vérification n’est pas terminée.

Le HTML ne peut pas choisir ou ouvrir automatiquement un dossier voisin sans autorisation du navigateur. Créer donnees/ organise les fichiers, mais ne déplace aucune donnée existante. Il faut sélectionner le classeur ou le dossier partagé dans l’application. La copie de récupération du navigateur peut dépendre du chemin du HTML : elle ne garantit pas le transfert vers la nouvelle structure. Les autorisations peuvent devoir être renouvelées à chaque réouverture.

## Toutes les mises à jour suivantes

1. Terminer les saisies, attendre les sauvegardes et synchronisations, puis fermer l’application sur les postes concernés.
2. Conserver une copie datée du classeur ou du dossier partagé complet dans sauvegardes/.
3. Extraire le ZIP de MISE A JOUR : il contient uniquement application/.
4. Copier ce dossier application/ au même niveau que donnees/ dans l’installation existante, en acceptant le remplacement des fichiers. Il est également possible de remplacer intégralement l’ancien dossier application/ puisque les données sont rangées à côté. Ne pas supprimer le dossier racine, donnees/ ou sauvegardes/. Ne pas utiliser de synchronisation avec suppression sur la racine.
5. Ouvrir DEMARRER.html. Reconnecter le classeur ou le dossier partagé existant si demandé ; vérifier un point connu avant de travailler.

Le paquet de mise à jour ne contient jamais donnees/, sauvegardes/, de classeur, de journal point-sync-*.json ou de base vide. Il contient seulement l’application et ses notices. Les paramètres enregistrés avec le classeur ou le journal restent avec les données ; les réglages propres au navigateur dépendent de son profil et du chemin du HTML.

## Retour à la version précédente

Conserver une copie de l’ancien dossier application/ avant remplacement. En cas de problème, fermer la nouvelle version, remettre ce dossier et reconnecter les données. Cette livraison ne change pas leur format. Une future livraison changeant le format devra documenter sa migration et sa compatibilité ; le paquet actuel n’effectue pas de migration implicite. Ne pas restaurer une ancienne sauvegarde sur des données modifiées depuis : conserver les deux copies pour comparaison.

## Préparation des prochaines livraisons depuis les sources

- Installation initiale : npm run package:offline -- /chemin/vers/un/dossier-vide install
- Mise à jour : npm run package:offline -- /chemin/vers/un/autre-dossier-vide

La commande compile le HTML sans données embarquées, puis prépare le paquet selon une liste explicite de fichiers autorisés. Le mode par défaut est la mise à jour. Un dossier non vide ou un HTML contenant un classeur embarqué est refusé. Compresser le contenu du dossier préparé ; seul le nom de l’archive change entre versions.
