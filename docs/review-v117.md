# V117 — Présentation des simulations

Réglages persistés Présentation et périodes : mois en colonnes adaptatives ou empilés ; cartes détaillées ou ligne par ligne, détails dépliables ; choix des moyennes GLOBAL, pondérée, avis → trame et trame → retour ; mini historique activable.

Moyennes arithmétiques des valeurs finies renseignées sur les simulations de chaque période affichée : zéro conservé, valeurs absentes exclues, dénominateur documenté. Les délais reprennent le calcul existant en jours calendaires et excluent les dates incohérentes. La moyenne des variations pondérées est une moyenne des valeurs déjà pondérées de chaque simulation, sans nouvelle pondération par achats.

Mini historique fournisseur basé sur les instantanés disponibles, dédoublonnés par mois selon la chronologie d’import existante ; courbe GLOBAL, ou pondérée si GLOBAL absente sur le dernier point. Les ruptures restent visibles et aucune valeur n’est inventée. Le détail conserve les observations numériques.

Exports regroupés par mois et moyennes choisies, présentation HTML avec mini courbe et détails dépliables en format lignes ; mail entièrement déplié avec l’historique numérique pour la compatibilité.

Validation : TypeScript, 405 tests, navigateur isolé à données fictives (moyennes 2,5 % / 1,8 %, format lignes, mini courbe, changement du placement des mois et état enregistré), build Worker, HTML autonome vérifié. Aucun paquet local livré, aucune donnée de production modifiée.
