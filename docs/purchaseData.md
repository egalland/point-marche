# PURCHASES — V68

## Importer une extraction complète

Sources > PURCHASES propose deux modes : fichier (XLSX, CSV, TSV, TXT) ou collage Excel. Pour un XLSX, choisir explicitement l’onglet PURCHASES après sélection du classeur. Seul cet onglet est analysé. Les anciens XLS et les classeurs chiffrés nécessitent un enregistrement en XLSX ou CSV dans Excel.

L’analyse affiche lignes détectées, uniques, doublons internes, lignes rejetées, pièces distinctes et aperçu de cinq lignes. Le texte n’a pas de maxlength ni de limite à 5 000 lignes. Limites explicites : 100 000 enregistrements source, 32 Mio de texte UTF-8, fichier source de 64 Mio maximum, partie XLSX décompressée de 96 Mio maximum. Une extraction avec des lignes invalides est bloquée et indique les premières erreurs ; aucune troncature silencieuse.

« Remplacer le registre PURCHASES » remplace toutes les données actives, toutes spécialités confondues. Il faut donc fournir le tableau complet et non un seul fournisseur filtré. Les lignes absentes sont retirées du registre courant sans déduire leur statut métier. Les instantanés d’export enregistrés dans les anciens points sont conservés.

L’enregistrement écrit des fragments de 1 000 lignes, puis bascule un manifeste courant uniquement une fois tous les fragments enregistrés. Les imports historiques ne sont plus cumulés dès le premier remplacement réussi. Un échec conserve le manifeste précédent ; les anciennes données et les fragments de préparation ne sont pas supprimés par ce patch. Les contrôles d’accès restent identiques aux autres imports.

CSV : séparateurs tabulation, point-virgule ou virgule, guillemets échappés et retours à la ligne dans une cellule ; décodage UTF-8, UTF-16 avec BOM et Windows-1252. XLSX : archive stockée ou Deflate, chaînes partagées ou inline, valeurs de formules mises en cache (aucun calcul), dates Excel 1900/1904 ; aucun chargement de macro ni de dépendance distante. Le lecteur utilise DecompressionStream dans un navigateur récent ; si indisponible, utiliser un CSV.

## Lire les statistiques

Statistiques > PURCHASES permet les filtres spécialité, fournisseur et article ; vues semaine, mois, année et périodes personnalisées. La fiche de variations fournisseur propose aussi son suivi PURCHASES. Les boutons ont des états survol, focus clavier, désactivé et sélection du regroupement. Les tableaux sont paginés par 50 lignes. La récurrence par article est calculée en une passe et son détail n’est rendu qu’à l’ouverture.

## Point marché

Ajouter le module Suivi PURCHASES et passer en modification pour ajouter plusieurs vues indépendantes ou les dupliquer. Paramètres et instantané d’export sont sauvegardés avec le point. Les vues interactives utilisent le registre actif ; les exports utilisent l’instantané enregistré dans la configuration.

Une ligne est identifiée par entité + fournisseur + pièce + numéro de ligne. Une pièce distincte par entité + fournisseur + pièce. Les doublons internes de l’extraction sont fusionnés sans addition des lignes de facture. La date « Première extraction » est la première date connue à l’intérieur de la nouvelle extraction complète. Les semaines débutent le lundi et les périodes vides restent visibles.
