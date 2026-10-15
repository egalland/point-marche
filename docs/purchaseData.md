# PURCHASES — V67

Importer dans Sources, rubrique PURCHASES, par collage du tableau Excel avec les en-têtes (la notice peut rester) ou fichier TXT/TSV/CSV. Les classeurs XLSX sont à copier depuis Excel.

Statistiques > PURCHASES : filtrer spécialité, fournisseur (recherche nom/code) et article. La fiche de variations d’un fournisseur propose aussi son suivi PURCHASES.

Point marché : ajouter le module Suivi PURCHASES, passer en modification, puis Ajouter une vue PURCHASES. Chaque vue a ses propres dates, filtres, granularité, indicateur et présentation. Dupliquer une vue conserve sa configuration. Leurs paramètres et un instantané pour les exports sont sauvegardés dans le point.

Dates : première extraction = première apparition connue dans les fichiers importés ; facture = date de facturation. La source ne permet pas de déduire un statut résolu. Les chiffres représentent les lignes reçues dans les extractions importées, pas un stock restant à traiter.

Identité d’une ligne : entité + code fournisseur + pièce + numéro de ligne. Un réimport ne crée pas d’occurrence supplémentaire et conserve la première date d’extraction. Une pièce est distincte par entité + fournisseur + numéro. Les totaux d’une période sont calculés sur son périmètre, jamais en additionnant les comptes distincts des sous-périodes.

Récurrence article : nombre de lignes, pièces et semaines d’apparition ; les mois facturés sont indiqués. Les semaines débutent le lundi. Les périodes vides apparaissent dans le graphique. Comparaison avec la période précédente de même durée, ou deux dates personnalisées.

Stockage Sites : lots immuables dans R2 (purchaseData-imports), fusion déterministe à la lecture ; contrôles d’accès identiques aux imports existants. La suppression/résolution d’un PURCHASES n’est pas inférée de son absence dans un lot.
