# V118 — Simulations condensées dans tous les formats

Remplacement des formulaires déployés globalement par des lignes compactes, y compris pendant la modification du bloc : nom court fournisseur si disponible, statut directement modifiable pour éditeurs, deux valeurs de variation, mini courbe de 72×25 et bouton détails. Le nom complet reste accessible au survol. Les commentaires vides et les mentions d’absence d’historique ne consomment plus d’espace. Le détail d’une seule ligne ouvre nom/période/commentaire, dates et actions. La suppression manuelle reste accessible dans ce détail.

Moyennes compactées, méthode disponible via l’indicateur d’information ; marges et séparateurs réduits. Mois en colonnes : deux lignes compactes par simulation lorsque la largeur l’exige. HTML : détails repliables dans les deux formats ; mail toujours complet et déplié.

Validation : TypeScript, 407 tests, compilation Worker et vérification HTML autonome. Navigateur local à données fictives : 19 lignes, 45px par ligne dans la configuration testée, aucun textarea initial ; ouverture/fermeture du détail de la première ligne seule ; screenshot inspecté. Aucun paquet local livré, données de production non modifiées.
