# Point marché — V49

## Changements

- Grille stricte à quatre colonnes : 1/4, 1/2, 3/4 et pleine largeur. Migration des anciennes largeurs 2/3 vers 3/4 à la lecture, sans toucher aux autres champs.
- Accrochage visuel bleu pendant le déplacement, menu clic droit, menu mobile et commandes clavier conservés.
- Poignée de redimensionnement. Les changements qui déplaceraient les autres blocs attendent « Appliquer et réorganiser » ; annulation disponible. Largeurs sélectionnables sur mobile.
- Sauvegarde automatique de la semaine partagée après 1,2 seconde sans saisie, en utilisant le mécanisme existant de révisions et de détection des conflits. Suppression du bouton de validation du Point marché. Les formulaires d'administration et le Point analyste conservent leur fonctionnement.
- Les textes saisis pendant une sauvegarde restent en place et déclenchent une nouvelle sauvegarde. En cas d'échec, conservation du brouillon, indication visible et bouton Réessayer ; nouvelle tentative lors du retour en ligne. Les copies concurrentes demandent toujours une résolution explicite.
- Accès direct à la semaine, boutons précédent/suivant et calendrier détaillé facultatif. Brouillons conservés par semaine lors des changements de marché ou de période.
- Structure repliée à l'ouverture pour laisser place au point. Édition ciblée et annuler/rétablir conservés.
- Export HTML sur quatre colonnes, export mail en tableaux à largeurs fixes suivant le même ordre et les mêmes rangées. Outlook peut interpréter certains détails visuels différemment ; aucun test dans Outlook réel effectué.
- Séparation du modèle et des fonctions métier, du tableau de bord et des exports. Fichier principal réduit de 1 922 à environ 1 170 lignes. Suppression des imports inutilisés et du calcul Jira dupliqué.
- Le graphique Jira réutilise les seuils par catégorie et compte correctement les synthèses contenant plusieurs tickets. Une valeur nulle ne dessine plus une barre minimale artificielle.

## Validation

- Vérification TypeScript.
- 210 tests réussis : données, imports, normalisation, exports, persistance et révisions, saisies concurrentes, sauvegarde automatique, reprise après rechargement, échec avec conservation des données, déplacements et redimensionnement bloqué puis forcé.
- Compilation Cloudflare Worker et validation de l'archive.
- Pas de test dans un navigateur réel ou sur un appareil tactile dans cette session.

## Limites conservées

- La version locale conserve les changements dans sa session ; l'écriture du fichier sur disque reste soumise aux possibilités et autorisations du navigateur.
- Le Point analyste et les formulaires d'administration ne sont pas convertis à cette nouvelle validation automatique.
