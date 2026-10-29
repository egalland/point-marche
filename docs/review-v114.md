# V114 — Résumé / KPI mobile et répétable

Le résumé fixe est retiré du haut du point et des exports. Ajouter un module ou Outils du point propose désormais Ajouter un résumé / KPI. Chaque instance conserve ses propres indicateurs, ordre et note ; les compteurs sont calculés sur les données du point. Placement et redimensionnement utilisent le canevas habituel. Dupliquer conserve un bloc dynamique, avec réglages indépendants ; retirer masque uniquement cette instance. Les exports HTML/mail suivent les blocs et l’ordre du point.

Validation : TypeScript, 399 tests existants et test supplémentaire de conservation de deux configurations indépendantes, compilation Worker et vérification HTML autonome. Aucun paquet local livré.
