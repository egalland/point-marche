## V137 — 30 octobre 2026

- Dans les marchés, un code seul (MEN) reconnaît l’étiquette MEN et les variantes MEN-AA, MEN-BB, etc. Une étiquette complète reste exacte.
- Même règle pour le point marché, l’aperçu d’import Planner, les comparaisons, les variations fournisseurs et l’activité analystes.
- Les étiquettes importées restent intactes. Les paramètres des marchés restent à modifier par l’administrateur ; aucun point enregistré n’est actualisé automatiquement.

## V136 — 30 octobre 2026

- Dates d’activité, statuts, délais ouvrés et spécialités préparés une fois par import ; JSON privé conservé côté site, cache dérivé inclus dans le classeur portable.
- Résultats de sélection mémorisés, indépendamment du tri, de la page ou de la période du tableau détaillé.
- Nouvel import et actualisation forcée renouvellent la préparation ; annuaire et marchés font partie de l’identité des résultats.
- Frise indexée par semaine, avec ensembles d’affectations réutilisés sur les périodes stables de l’annuaire.
- Stockage du cache borné ; un cache manquant ou inexploitable est reconstruit sans modifier les points enregistrés.

## V135 — 30 octobre 2026

- Sélection de plusieurs marchés pour les analyses Jira, avec total global dédupliqué.
- Moyenne de résolution par semaine et marché en jours ouvrés, accompagnée des nombres de tickets datés et exclus.
- Graphiques de volume et de délai séparés, mêmes semaines et mêmes couleurs ; valeur de synthèse affichable ou masquable.
- La moyenne de la période utilise les tickets de la sélection, sans moyenne de moyennes hebdomadaires.
- Délai de la semaine dans la synthèse Jira du point marché et les exports ; anciens instantanés conservés jusqu’à actualisation explicite.

## V134 — 30 octobre 2026

- Graphiques Jira interactifs : curseur de lecture, valeurs au survol ou au clavier, épinglage, surbrillance et légendes pour masquer des séries.
- Choix de courbes, aires, bâtons, anneaux ou camemberts selon le type de données ; zoom local sur les dernières périodes.
- Un clic sur la courbe épingle une valeur. Le filtre de semaine s’applique uniquement avec un bouton explicite.
- Répartitions des tickets interactives et comparaison principale/référence conservée ; les changements de format ne relisent pas le registre.
- Fiche fournisseur depuis le nom ou la courbe d’une simulation, avec indicateurs et historique du point sauvegardé.

## V133 — 29 octobre 2026

- Distribution finale des comparaisons Jira et des dates de fin, avec contrôle des fichiers de démonstration avant compilation.

## V132 — 29 octobre 2026

- Comparaisons Jira regroupées : chiffres principaux en grand, référence en petit, camembert de référence en miniature.
- Courbes hebdomadaires colorées par marché, avec référence en pointillés ; détails chiffrés repliés.
- Import des dates Terminée, Résolue, Date de fin et équivalents ; repli sur une autre colonne de date lorsque Résolution contient un libellé.
- Moyenne et médiane en jours ouvrés calculées sur les dates de fin de la période, y compris dans la vue Stock ; diagnostic des dates absentes ou incohérentes.
- Les anciens imports ayant ignoré la colonne doivent être réimportés. Les points sauvegardés conservent leur instantané.

## V131 — 29 octobre 2026

- Compilation depuis un dossier de sortie propre : les anciens fichiers supprimés du projet ne restent plus dans la distribution.

## V130 — 29 octobre 2026

- Page Jira dédiée dans le menu latéral : tout le registre, personnes, catégories, comparaisons, stock historique et frise.
- Vue des tickets des analystes conservée dans leur activité.
- Frise calculée sans répéter les KPI, les délais et les tris ; périodes identiques réutilisées.
- Cache serveur borné de 15 secondes, renouvelé par import ou par le bouton Actualiser.

# Historique des versions

## V127 · 2026-10-29

- Activité Jira : stock ouvert calculable à la fin des périodes A et B, indépendamment des modifications pendant la période.
- Vue Stock ouvert avec filtres, camemberts et tickets ; fermetures sans résolution, dates incohérentes et réouvertures connues signalées comme indéterminées.

## V126 · 2026-10-29

- Jira du point marché : terminés de la semaine et détails, sans augmenter le stock ouvert ; résolution prioritaire, modification identifiée si la résolution manque.
- Catégories et sous-catégories : filtres, volumes, impact métier et implication qualifiés dans les règles du point ; exports HTML et mail enrichis.
- Activité analystes : onglet Jira, comparaison A/B, KPI et délais ouvrés, camemberts catégorie/sous-catégorie/statut/analyste, filtres et tableau triable paginé.

## V125 · 2026-10-29

- Fiche technique V124 téléchargeable depuis Affichage et compte sur le site.

## V124 · 2026-10-29

- Annuaire : plusieurs marchés par période, création de rôles métier et historique daté des affectations.
- Profil Vente : création avec USERCODE de connexion et droits de lecture seule.
- Bugs et idées : USERCODE renseigné depuis le compte connecté.
- Vigilances PURCHASES : ancienneté, récurrence article et seuil d’écart configurables ; alertes figées avec le point sauvegardé.
- Une personne sans affectation active reste en lecture seule.

## V123 · 2026-10-29

Dossier de projet téléchargeable

- Ajout du PDF de référence V122 dans Affichage et compte sur le site.

## V122 · 2026-10-29

Historique des versions et rôle Vente

- Changelog recherchable depuis la première version ; accès Vente limité à la lecture et aux exports, dans le site et la version locale.

## V121 · 2026-10-29

Blocs mobiles et export des demandes

- Affichage intégral des blocs sur téléphone ; export ZIP des bugs et idées avec texte, historique et captures ; aide actualisée.

## V120 · 2026-10-29

Points enregistrés conservés après import

- Les nouveaux imports ne remplacent plus les données des points sauvegardés ; actualisation explicite depuis le point.

## V119 · 2026-10-29

Icône de synchronisation dans le menu

- Accès à l’état du dossier partagé depuis la barre latérale.

## V118 · 2026-10-28

Simulations condensées

- Réduction des espacements et affichage des détails à la demande.

## V117 · 2026-10-28

Présentation des simulations

- Choix de la disposition des mois, affichage ligne par ligne, moyennes KPI et mini historique.

## V116 · 2026-10-28

Retrait des simulations manuelles

- Suppression d’une simulation ajoutée manuellement depuis ses détails.

## V115 · 2026-10-28

Statuts de promotion et titres de blocs

- Étapes visibles, états colorés et possibilité de renommer les blocs.

## V114 · 2026-10-28

Blocs KPI libres

- Ajout de blocs de synthèse déplaçables et duplicables dans le point.

## V113 · 2026-10-28

Étapes, périodes et pièces jointes

- Ordre et validation des étapes de promotion ; choix des périodes de simulation ; fichiers joints et mise en forme des dossiers.

## V112 · 2026-10-28

Market Plus et promotions

- Évolution de l’identité de l’application et du suivi des promotions.

## V111 · 2026-10-28

Modification fluide et partage des blocs

- Répartition en parts égales, réduction des modes de modification et accès explicite aux détails des tickets.

## V110 · 2026-10-28

Menu adaptable et composition libre

- Menu réduit ou développé, éditeur intégré, disposition libre et détails dans des fenêtres dédiées.

## V109 · 2026-10-28

Lecture du point et délais Jira

- En-tête allégé, contenu prioritaire et indicateurs de résolution par spécialité.

## V108 · 2026-10-28

Préparation du point et imports locaux

- Amélioration du contrôle des données avant diffusion.

## V107 · 2026-10-27

Espace analystes regroupé

- Onglets dédiés aux points analystes, à leur activité, aux PURCHASES et aux variations.

## V106 · 2026-10-27

Version PC autonome

- Préparation d’un build portable avec les ressources nécessaires à son fonctionnement local.

## V105 · 2026-10-27

Droits dans l’annuaire

- Cases Admin et Super admin directement sur les personnes.

## V104 · 2026-10-27

Super admin et vues restreintes

- Réglage des autorisations et possibilité de passer en vue lecteur.

## V103 · 2026-10-27

Profils et journal d’activité

- Gestion des accès et consultation des actions dans l’administration.

## V102 · 2026-10-27

Création des dossiers simplifiée

- Commandes d’édition et de configuration contextualisées.

## V101 · 2026-10-27

Retours et suivi des tickets

- Regroupement des demandes et clarification de leur suivi.

## V100 · 2026-10-27

Synchronisation par dossier partagé

- Synchronisation des classeurs locaux au moyen d’un journal commun.

## V99 · 2026-10-27

Fenêtres et défilement stabilisés

- Corrections des interactions entre les fenêtres et la page.

## V98 · 2026-10-27

Édition du point analyste

- Harmonisation de la modification et mise à jour du plan du site.

## V97 · 2026-10-26

Surfaces du point harmonisées

- Réduction des cadres imbriqués pour faciliter la lecture.

## V96 · 2026-10-26

Choix de semaine compact

- Allègement du sélecteur et outils affichés selon le contexte.

## V95 · 2026-10-26

PURCHASES par période et spécialité

- Synthèse centrée sur les décomptes utiles au point.

## V94 · 2026-10-26

Synthèse PURCHASES et exports

- Harmonisation du rendu PURCHASES entre le point web et le mail.

## V93 · 2026-10-23

Interface allégée

- Retrait de l’animation décorative.

## V92 · 2026-10-22

Gestes de placement des blocs

- Amélioration des chevauchements, de l’accrochage aux bords et du défilement pendant les déplacements.

## V91 · 2026-10-22

Présentation de l’animation

- Ajustement de son apparence visuelle.

## V90 · 2026-10-22

Animation décorative

- Ajout d’une animation ludique dans l’interface.

## V89 · 2026-10-22

Point marché en pleine largeur mobile

- Utilisation de la largeur disponible sur téléphone.

## V88 · 2026-10-22

Alignements et espacements

- Harmonisation des marges et de l’affichage sur mobile.

## V87 · 2026-10-22

Boîte de réception des demandes

- Enregistrement des bugs et idées avec captures et suivi de statut.

## V86 · 2026-10-22

Signalement des bugs et idées

- Préparation des demandes et réglage des contacts de notification.

## V85 · 2026-10-20

Actualisation centralisée

- Regroupement des sources dans un panneau de mise à jour avec saisie manuelle disponible.

## V84 · 2026-10-20

Sélection des sources d’import

- Contrôles du fichier, de son emplacement et de la feuille à importer.

## V83 · 2026-10-20

Filtres par colonne

- Ouverture d’un panneau de filtre depuis les colonnes des tableaux.

## V82 · 2026-10-20

Tri et filtres des tableaux

- Commandes de recherche et de tri pour les données fournisseurs et PURCHASES.

## V81 · 2026-10-20

Liste des fournisseurs sans filtre

- Affichage de la liste complète lorsque la recherche est vide.

## V80 · 2026-10-20

Recherche fournisseur unifiée

- Regroupement du choix et de la recherche dans une seule commande.

## V79 · 2026-10-20

Suivi des trames fournisseurs

- Ajustement du périmètre du suivi des envois et retours.

## V78 · 2026-10-20

Navigation entre les onglets

- Conservation de l’onglet dans l’adresse et prise en compte des boutons précédent et suivant.

## V77 · 2026-10-20

Regroupement par code fournisseur

- Consolidation des observations autour de l’identifiant du fournisseur.

## V76 · 2026-10-20

Fiches fournisseurs

- Page dédiée aux informations et au suivi d’un fournisseur.

## V75 · 2026-10-20

Parcours d’import progressif

- Amélioration de la disposition du Centre d’import et du chargement PURCHASES.

## V74 · 2026-10-19

Suivi du cycle des simulations

- Dates et détails Planner, suivi des trames, exports et améliorations du chargement.

## V73 · 2026-10-19

Redimensionnement par les bords

- Ajustement des dimensions et de l’alignement des blocs.

## V72 · 2026-10-19

Composition du point allégée

- Simplification de la présentation et de l’organisation du canevas.

## V71 · 2026-10-19

Disposition initiale des fenêtres

- Amélioration de la position et des dimensions par défaut.

## V70 · 2026-10-19

Composition et diffusion modulaires

- Évolution des blocs, des dossiers, du canevas libre et du rendu PURCHASES dans les exports.

## V69 · 2026-10-19

Présentation des variations fournisseurs

- Ajustement des graphiques et des commandes du tableau de bord.

## V68 · 2026-10-16

Import PURCHASES complet

- Lecture des fichiers CSV et Excel, sélection de feuilles et statistiques de volumes.

## V67 · 2026-10-15

Module PURCHASES

- Ajout du suivi PURCHASES dans le tableau de bord et des calculs associés.

## V66 · 2026-10-15

Import Planner renforcé

- Corrections du traitement et du registre des tâches importées.

## V65 · 2026-10-15

Numéro de version unifié

- Même version affichée dans les menus, l’aide et les exports.

## V64 · 2026-10-15

Fiabilisation de l’export Excel

- Corrections complémentaires de la génération du classeur.

## V63 · 2026-10-15

Classeur Excel amélioré

- Ajustement du modèle et de l’export des graphiques fournisseurs.

## V62 · 2026-10-15

Graphiques de variations ajustés

- Amélioration de la présentation des courbes et du tableau de bord fournisseur.

## V61 · 2026-10-15

Métriques Planner fiabilisées

- Corrections des imports et des calculs de variations fournisseurs.

## V60 · 2026-10-15

Observations fournisseurs harmonisées

- Fiabilisation de la sélection des données affichées dans les indicateurs.

## V59 · 2026-10-15

Dernière intégration par fournisseur

- Sélection de la dernière observation intégrée pour un fournisseur et un mois.

## V58 · 2026-10-15

Export des graphiques vers Excel

- Génération d’un classeur avec un modèle de graphique.

## V57 · 2026-10-15

Export des graphiques en image

- Téléchargement des graphiques au format PNG.

## V56 · 2026-10-15

Courbes pondérées distinctes

- Couleur dédiée aux variations pondérées dans les graphiques et mini historiques.

## V55 · 2026-10-15

Recherche dans l’aide

- Recherche dans les titres, étapes et notes des chapitres.

## V54 · 2026-10-15

Recherche fournisseur améliorée

- Liste de sélection recherchable, tri et sélection au clavier.

## V53 · 2026-10-15

Variations mensuelles fournisseurs

- Colonnes par mois, moyennes et distinction entre valeurs nulles et données absentes.

## V52 · 2026-10-13

Procédures d’aide illustrées

- Présentation des parcours d’aide en étapes courtes.

## V51 · 2026-10-13

Canevas libre et aide intégrée

- Déplacement et redimensionnement des blocs ; grille et aimantation ; éditeur flottant ; aide et export HTML autonome.

## V50 · 2026-10-07

Accès et sessions simplifiés

- Harmonisation de l’identification, de la session et du changement d’utilisateur.

## V49 · 2026-10-07

Disposition des modules

- Déplacement, largeurs des blocs, exports et indication de synchronisation.

## V48 · 2026-10-07

Outils de modification contextualisés

- Simplification de la navigation et des commandes de mise en forme.

## V47 · 2026-10-07

Dossiers modifiables sur place

- Édition du contenu directement dans la zone du dossier.

## V46 · 2026-10-07

Comparaison des périodes d’activité

- Amélioration des statistiques analystes et de la navigation dans les résultats.

## V45 · 2026-10-07

Dossiers enrichis et comparatifs

- Évolution de l’éditeur de dossiers, des pièces visuelles, des imports Jira et des comparaisons de simulations.

## V44 · 2026-09-07

Sauvegarde automatique et conflits

- Sauvegarde des brouillons et protection contre les modifications concurrentes.

## V43 · 2026-09-07

Protection des brouillons

- Harmonisation de l’édition directe et des exports portables.

## V42 · 2026-09-05

Adaptation mobile du site

- Ajustement des écrans et des commandes aux petits formats.

## V41 · 2026-09-04

Édition directe harmonisée

- Finalisation du parcours de saisie et de lecture du point.

## V40 · 2026-09-04

Édition directe du point

- Refonte de la modification du contenu sur le point marché.

## V39 · 2026-09-03

Modification en réunion et comparaison

- Saisies manuelles, préparation des mails et comparaison des marchés.

## V38 · 2026-09-02

Graphiques fournisseurs compacts

- Amélioration du contraste des simulations et ajout de mini courbes.

## V37 · 2026-09-02

Thèmes clair et sombre

- Refonte visuelle et amélioration des contrastes de l’interface.

## V36 · 2026-09-02

Dates des tickets terminés

- Allègement de l’affichage des tickets analystes clôturés.

## V35 · 2026-09-02

Totaux et moyennes Jira

- Totaux de période, moyennes hebdomadaires et comparaison avec la semaine précédente.

## V34 · 2026-09-02

Achats par simulation

- Affichage du chiffre d’affaires fournisseur importé pour chaque simulation, sans agrégation.

## V33 · 2026-09-02

Activité analyste et calendrier

- Tendances des tickets terminés et navigation hebdomadaire simplifiée.

## V32 · 2026-09-02

Tickets Jira abandonnés

- Exclusion des tickets abandonnés des points et des compteurs d’activité.

## V31 · 2026-09-01

Registres Jira volumineux

- Lecture des grands imports et reconnaissance du statut Fini comme terminé.

## V30 · 2026-09-01

Activité Jira hebdomadaire

- Correction du calcul de l’activité sur les périodes sélectionnées.

## V29 · 2026-08-31

Alimentation des résolutions Jira

- Fiabilisation des totaux de tickets résolus par semaine.

## V28 · 2026-08-31

Attribution et participation Jira

- Distinction entre responsable d’un ticket et participation à son traitement.

## V27 · 2026-08-31

Résolutions Jira hebdomadaires

- Ajout des tickets résolus dans le suivi par semaine.

## V26 · 2026-08-31

Attribution Jira globale

- Correction des correspondances entre tickets, personnes et marchés.

## V25 · 2026-08-31

Import Jira centralisé

- Unification de l’entrée et du traitement des tickets importés.

## V24 · 2026-08-31

Centre d’import Jira et Planner

- Regroupement des parcours d’import.

## V23 · 2026-08-27

Fiabilisation des points analystes

- Corrections du traitement Planner et du point analyste.

## V22 · 2026-08-27

Point marché alimenté par Planner

- Harmonisation des informations utilisées dans les blocs de simulations.

## V21 · 2026-08-27

Simulations Planner dans le point marché

- Rapprochement des simulations et des informations du point.

## V20 · 2026-08-27

Point analyste et variations fournisseurs

- Ajout d’un point dédié aux analystes et du suivi des variations.

## V19 · 2026-08-27

Paramètres, alertes Jira et diffusion

- Amélioration des réglages et du partage du point.

## V18 · 2026-08-27

Simulations et délais Planner

- Regroupement des simulations et affichage des délais issus de Planner.

## V17 · 2026-08-27

Import Planner et statistiques analystes

- Ajout des tâches Planner et du suivi de l’activité des analystes.

## V16 · 2026-08-26

Radar Jira et kit Outlook

- Refonte de la synthèse des tickets et de la préparation du mail.

## V15 · 2026-08-26

Parcours et fenêtres simplifiés

- Clarification des rôles Jira et des interactions dans les fenêtres.

## V14 · 2026-08-25

Import Jira détaillé et tendances

- Requêtes par identifiant et suivi de l’évolution de l’activité.

## V13 · 2026-08-25

Annuaire et reprise hebdomadaire

- Association des personnes aux marchés ; préparation Jira et mail ; reprise sélective du point précédent.

## V12 · 2026-08-25

Identification des éditeurs

- Accès à la saisie avec l’identifiant professionnel.

## V11 · 2026-08-25

Un point par marché et par semaine

- Simplification du registre et de la sélection du point enregistré.

## V10 · 2026-08-25

Sélecteur de semaine visuel

- Remplacement du champ de semaine par un calendrier.

## V9 · 2026-08-25

Navigation de lecture simplifiée

- Amélioration de l’accès au point et aux rubriques de consultation.

## V8 · 2026-08-25

Navigation lecteur et édition protégée

- Séparation des parcours de lecture et de modification ; rapprochement Jira hebdomadaire.

## V7 · 2026-08-25

Prévisualisation de l’import Jira

- Sélection des tickets à retenir pour chaque marché.

## V6 · 2026-08-25

Import Jira par personne et marché

- Récapitulatif des tickets importés pour alimenter le point.

## V5 · 2026-08-24

Marchés et années ISO

- Gestion dynamique des marchés et des semaines selon le calendrier ISO.

## V4 · 2026-08-24

Accès au registre en ligne

- Correction de l’ouverture du registre partagé.

## V3 · 2026-08-24

Registre hebdomadaire et versions

- Enregistrement des points par semaine et échanges au format JSON.

## V2 · 2026-08-20

Saisie du point marché dans le navigateur

- Transformation du tableau de bord en outil de préparation et de saisie.

## V1 · 2026-08-07

Première version du tableau de bord marché 2026

- Présentation animée du point et des indicateurs de suivi.
