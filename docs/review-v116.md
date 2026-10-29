# V116 — Retirer les simulations manuelles

Commande explicite Retirer cette simulation sur chaque carte manuelle, disponible aux éditeurs en lecture et en saisie. Supprime la ligne ciblée via le callback de suppression existant ; événements arrêtés pour éviter l’activation du bloc lors du clic. Commande non exposée aux lecteurs et absente sur les simulations importées. Style autonome pour garder le bouton lisible et éviter les dimensions héritées d’autres contrôles.

Validation : TypeScript, tests du callback ciblé et de son absence sur les imports/profils lecteurs, suite complète et compilation Worker.
