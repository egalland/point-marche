# Conversion locale — reprise

## Périmètre

- Version de départ : production V38, commit `5b669025992454e15a02e351a00847dc974a9f6e`.
- Branche : `local-portable-20260902`.
- Livrable : application HTML autonome + fichier de données, sans hébergement.
- Aucun déploiement ni changement des données en production.
- Préserver les règles Jira, Planner, les points et les exports existants.
- Sauvegardes explicites sur disque et récupération locale des brouillons.

## État

- Structure et accès en lecture vérifiés.
- Connexion applicative existante utilisable pour lire les données complètes des points.
- La consultation native de la base tronque les cellules longues : ne pas les utiliser comme sauvegarde complète.
- Conversion du stockage et des imports : à faire.
- Ouverture/enregistrement de fichier : à faire.
- Export initial, tests de volumes et dossier de livraison : à faire.

## Vérifications avant livraison

- Aucun appel serveur dans le fichier autonome.
- Aller-retour du fichier sans perte, annulation et erreurs sans écrasement.
- Import Jira > 12 000 lignes, participants et exclusions des abandonnés.
- Calculs hebdomadaires sur la dernière modification Jira.
- Planner partagé, variations et CA par simulation conservés.
- Enregistrement des modifications et réouverture sans navigateur spécifique au poste.
- Données privées et secrets exclus du dépôt source.
- Version en production inchangée.
