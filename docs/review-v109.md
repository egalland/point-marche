# V109 — Lecture et composition du point marché

- Priorité hebdomadaire retirée de la lecture, des contrôles et des exports ; champ historique conservé.
- Marché et semaine dans la barre supérieure, aide et apparence dans la navigation latérale.
- Boutons d’ajout des dossiers visibles seulement pendant la modification. Clic dans le bloc pour modifier, clic extérieur ou Échap pour revenir à la lecture.
- Zones de texte libre indépendantes dans la bibliothèque et les outils du point. Mise en forme, tableaux, listes et images. Choix de pleine largeur, demi-largeur ou tiers par dossier ; réorganisation et disposition du bloc conservées.
- Images raster intégrées au classeur local après redimensionnement et compression. SVG et liens exécutables refusés. Les fichiers non image restent réservés au site hébergé.
- Comparatif des simulations : hauteur du graphique bornée à 245 pixels.
- Jira : préfixe de spécialité du résumé ou catégorie reconnue prioritaire ; sinon rattachement à l’annuaire du marché, tous rôles confondus. Les spécialités sont déduites des codes courts et préfixes des tags configurés du marché. Aucun calcul ne dépend seulement du rôle chef de produit ou chef de marché.
- Délais de résolution moyens et médians mensuels, écart au mois précédent complet et ancienneté du stock en jours ouvrés. Weekends et jours fériés nationaux français exclus ; lendemain de création jusqu’au jour de résolution inclus. Dates de résolution importées exclusivement. Les dates manquantes, incohérentes, futurs résolus, agrégats et abandons ne contribuent pas aux délais.
- Instantané des KPI enregistré avec le point et exporté dans le mail et le HTML. Les tickets clos sont utilisés pour le calcul côté source et ne sont pas tous copiés dans le point. Le stock reflète la dernière extraction, sans reconstitution historique.

Validation : tests automatisés, TypeScript et contrôle de parcours sur données fictives. Rendu ordinateur et cadre mobile de 390 pixels contrôlés. Aucun accès aux données métier de production pour ces essais.

Limites : jours fériés locaux et fermetures d’entreprise non déduits. La couverture dépend de l’extraction Jira importée ; ajouter sa colonne de résolution pour les délais. Une spécialité non reconnue revient au rattachement de l’annuaire. Les images des exports Outlook doivent être vérifiées dans le client destinataire.
