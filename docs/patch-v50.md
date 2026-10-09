# Point marché — V50

Les journaux de production montraient des réponses 401 sur POST /api/points, GET /api/global-users et GET /api/planner-tasks. Le serveur donnait déjà accès à un compte partagé sans connexion, mais proxy.ts exigeait encore l'ancien cookie sur ces routes. La base D1 et ses tables étaient présentes.

- Suppression de cette ancienne barrière de connexion.
- Retrait de l'écran de connexion et des parcours connexion/déconnexion de l'application.
- Compatibilité des anciens appels login/logout sans mot de passe ni création de cookie.
- Identifiant du compte partagé conservé afin de reprendre les brouillons existants.
- Un échec de sauvegarde affiche « Sauvegarde interrompue » et Réessayer. Un échec de chargement de l'espace affiche également une erreur explicite, sans formulaire de connexion.
- Version affichée V50 dans l'en-tête et la navigation.

Validation : 212 tests réussis, dont deux nouvelles vérifications traversant le Worker compilé et l'ensemble des routes, avec une base SQLite de test contenant toutes les migrations. Consultation annuaire/Planner sans cookie, ancien cookie expiré, sauvegarde d'un brouillon, validation du point et relecture des deux copies. Aucun jeu de données de test ajouté à la base de production.
