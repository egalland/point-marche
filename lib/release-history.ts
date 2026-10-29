/** User-facing notes curated from the saved version history, not raw requests or commit logs. */
export type ReleaseNote = { version: number; date: string; title: string; changes: string[] };
export const releaseHistory: ReleaseNote[] = [
  {version:127,date:"2026-10-29",title:"Stock Jira à la date choisie",changes:["Comparaison du stock ouvert à la fin de chaque période à partir des dates de création et de résolution.","Vue dédiée au stock avec filtres, camemberts et détail ; tickets indéterminés signalés séparément."]},
  {version:126,date:"2026-10-29",title:"Activité Jira et catégories",changes:["Tickets terminés dans la semaine rétablis dans le point marché, avec détail des dates utilisées.","Catégories et sous-catégories Jira filtrables ; qualification de l’impact métier et du travail attendu.","Nouvel onglet Jira dans Activité analystes : KPI, comparaison de périodes, quatre camemberts filtrables et tableau triable."]},
  {version:125,date:"2026-10-29",title:"Fiche technique téléchargeable",changes:["Fiche technique V124 disponible en PDF depuis Affichage et compte sur le site."]},
  {version:124,date:"2026-10-29",title:"Profils datés et vigilances PURCHASES",changes:["Plusieurs marchés par personne, rôles métier personnalisables et historique des affectations avec dates de validité.","Création du profil Vente corrigée et USERCODE des signalements lié au compte connecté.","Vigilances PURCHASES configurables et conservées avec les données du point enregistré."]},
  {version:123,date:"2026-10-29",title:"Dossier de projet téléchargeable",changes:["Ajout du dossier de référence V122 au format PDF dans Affichage et compte sur le site."]},
  {
    "version": 122,
    "date": "2026-10-29",
    "title": "Historique des versions et rôle Vente",
    "changes": [
      "Changelog recherchable depuis la première version ; accès Vente limité à la lecture et aux exports, dans le site et la version locale."
    ]
  },
  {
    "version": 121,
    "date": "2026-10-29",
    "title": "Blocs mobiles et export des demandes",
    "changes": [
      "Affichage intégral des blocs sur téléphone ; export ZIP des bugs et idées avec texte, historique et captures ; aide actualisée."
    ]
  },
  {
    "version": 120,
    "date": "2026-10-29",
    "title": "Points enregistrés conservés après import",
    "changes": [
      "Les nouveaux imports ne remplacent plus les données des points sauvegardés ; actualisation explicite depuis le point."
    ]
  },
  {
    "version": 119,
    "date": "2026-10-29",
    "title": "Icône de synchronisation dans le menu",
    "changes": [
      "Accès à l’état du dossier partagé depuis la barre latérale."
    ]
  },
  {
    "version": 118,
    "date": "2026-10-28",
    "title": "Simulations condensées",
    "changes": [
      "Réduction des espacements et affichage des détails à la demande."
    ]
  },
  {
    "version": 117,
    "date": "2026-10-28",
    "title": "Présentation des simulations",
    "changes": [
      "Choix de la disposition des mois, affichage ligne par ligne, moyennes KPI et mini historique."
    ]
  },
  {
    "version": 116,
    "date": "2026-10-28",
    "title": "Retrait des simulations manuelles",
    "changes": [
      "Suppression d’une simulation ajoutée manuellement depuis ses détails."
    ]
  },
  {
    "version": 115,
    "date": "2026-10-28",
    "title": "Statuts de promotion et titres de blocs",
    "changes": [
      "Étapes visibles, états colorés et possibilité de renommer les blocs."
    ]
  },
  {
    "version": 114,
    "date": "2026-10-28",
    "title": "Blocs KPI libres",
    "changes": [
      "Ajout de blocs de synthèse déplaçables et duplicables dans le point."
    ]
  },
  {
    "version": 113,
    "date": "2026-10-28",
    "title": "Étapes, périodes et pièces jointes",
    "changes": [
      "Ordre et validation des étapes de promotion ; choix des périodes de simulation ; fichiers joints et mise en forme des dossiers."
    ]
  },
  {
    "version": 112,
    "date": "2026-10-28",
    "title": "Market Plus et promotions",
    "changes": [
      "Évolution de l’identité de l’application et du suivi des promotions."
    ]
  },
  {
    "version": 111,
    "date": "2026-10-28",
    "title": "Modification fluide et partage des blocs",
    "changes": [
      "Répartition en parts égales, réduction des modes de modification et accès explicite aux détails des tickets."
    ]
  },
  {
    "version": 110,
    "date": "2026-10-28",
    "title": "Menu adaptable et composition libre",
    "changes": [
      "Menu réduit ou développé, éditeur intégré, disposition libre et détails dans des fenêtres dédiées."
    ]
  },
  {
    "version": 109,
    "date": "2026-10-28",
    "title": "Lecture du point et délais Jira",
    "changes": [
      "En-tête allégé, contenu prioritaire et indicateurs de résolution par spécialité."
    ]
  },
  {
    "version": 108,
    "date": "2026-10-28",
    "title": "Préparation du point et imports locaux",
    "changes": [
      "Amélioration du contrôle des données avant diffusion."
    ]
  },
  {
    "version": 107,
    "date": "2026-10-27",
    "title": "Espace analystes regroupé",
    "changes": [
      "Onglets dédiés aux points analystes, à leur activité, aux PURCHASES et aux variations."
    ]
  },
  {
    "version": 106,
    "date": "2026-10-27",
    "title": "Version PC autonome",
    "changes": [
      "Préparation d’un build portable avec les ressources nécessaires à son fonctionnement local."
    ]
  },
  {
    "version": 105,
    "date": "2026-10-27",
    "title": "Droits dans l’annuaire",
    "changes": [
      "Cases Admin et Super admin directement sur les personnes."
    ]
  },
  {
    "version": 104,
    "date": "2026-10-27",
    "title": "Super admin et vues restreintes",
    "changes": [
      "Réglage des autorisations et possibilité de passer en vue lecteur."
    ]
  },
  {
    "version": 103,
    "date": "2026-10-27",
    "title": "Profils et journal d’activité",
    "changes": [
      "Gestion des accès et consultation des actions dans l’administration."
    ]
  },
  {
    "version": 102,
    "date": "2026-10-27",
    "title": "Création des dossiers simplifiée",
    "changes": [
      "Commandes d’édition et de configuration contextualisées."
    ]
  },
  {
    "version": 101,
    "date": "2026-10-27",
    "title": "Retours et suivi des tickets",
    "changes": [
      "Regroupement des demandes et clarification de leur suivi."
    ]
  },
  {
    "version": 100,
    "date": "2026-10-27",
    "title": "Synchronisation par dossier partagé",
    "changes": [
      "Synchronisation des classeurs locaux au moyen d’un journal commun."
    ]
  },
  {
    "version": 99,
    "date": "2026-10-27",
    "title": "Fenêtres et défilement stabilisés",
    "changes": [
      "Corrections des interactions entre les fenêtres et la page."
    ]
  },
  {
    "version": 98,
    "date": "2026-10-27",
    "title": "Édition du point analyste",
    "changes": [
      "Harmonisation de la modification et mise à jour du plan du site."
    ]
  },
  {
    "version": 97,
    "date": "2026-10-26",
    "title": "Surfaces du point harmonisées",
    "changes": [
      "Réduction des cadres imbriqués pour faciliter la lecture."
    ]
  },
  {
    "version": 96,
    "date": "2026-10-26",
    "title": "Choix de semaine compact",
    "changes": [
      "Allègement du sélecteur et outils affichés selon le contexte."
    ]
  },
  {
    "version": 95,
    "date": "2026-10-26",
    "title": "PURCHASES par période et spécialité",
    "changes": [
      "Synthèse centrée sur les décomptes utiles au point."
    ]
  },
  {
    "version": 94,
    "date": "2026-10-26",
    "title": "Synthèse PURCHASES et exports",
    "changes": [
      "Harmonisation du rendu PURCHASES entre le point web et le mail."
    ]
  },
  {
    "version": 93,
    "date": "2026-10-23",
    "title": "Interface allégée",
    "changes": [
      "Retrait de l’animation décorative."
    ]
  },
  {
    "version": 92,
    "date": "2026-10-22",
    "title": "Gestes de placement des blocs",
    "changes": [
      "Amélioration des chevauchements, de l’accrochage aux bords et du défilement pendant les déplacements."
    ]
  },
  {
    "version": 91,
    "date": "2026-10-22",
    "title": "Présentation de l’animation",
    "changes": [
      "Ajustement de son apparence visuelle."
    ]
  },
  {
    "version": 90,
    "date": "2026-10-22",
    "title": "Animation décorative",
    "changes": [
      "Ajout d’une animation ludique dans l’interface."
    ]
  },
  {
    "version": 89,
    "date": "2026-10-22",
    "title": "Point marché en pleine largeur mobile",
    "changes": [
      "Utilisation de la largeur disponible sur téléphone."
    ]
  },
  {
    "version": 88,
    "date": "2026-10-22",
    "title": "Alignements et espacements",
    "changes": [
      "Harmonisation des marges et de l’affichage sur mobile."
    ]
  },
  {
    "version": 87,
    "date": "2026-10-22",
    "title": "Boîte de réception des demandes",
    "changes": [
      "Enregistrement des bugs et idées avec captures et suivi de statut."
    ]
  },
  {
    "version": 86,
    "date": "2026-10-22",
    "title": "Signalement des bugs et idées",
    "changes": [
      "Préparation des demandes et réglage des contacts de notification."
    ]
  },
  {
    "version": 85,
    "date": "2026-10-20",
    "title": "Actualisation centralisée",
    "changes": [
      "Regroupement des sources dans un panneau de mise à jour avec saisie manuelle disponible."
    ]
  },
  {
    "version": 84,
    "date": "2026-10-20",
    "title": "Sélection des sources d’import",
    "changes": [
      "Contrôles du fichier, de son emplacement et de la feuille à importer."
    ]
  },
  {
    "version": 83,
    "date": "2026-10-20",
    "title": "Filtres par colonne",
    "changes": [
      "Ouverture d’un panneau de filtre depuis les colonnes des tableaux."
    ]
  },
  {
    "version": 82,
    "date": "2026-10-20",
    "title": "Tri et filtres des tableaux",
    "changes": [
      "Commandes de recherche et de tri pour les données fournisseurs et PURCHASES."
    ]
  },
  {
    "version": 81,
    "date": "2026-10-20",
    "title": "Liste des fournisseurs sans filtre",
    "changes": [
      "Affichage de la liste complète lorsque la recherche est vide."
    ]
  },
  {
    "version": 80,
    "date": "2026-10-20",
    "title": "Recherche fournisseur unifiée",
    "changes": [
      "Regroupement du choix et de la recherche dans une seule commande."
    ]
  },
  {
    "version": 79,
    "date": "2026-10-20",
    "title": "Suivi des trames fournisseurs",
    "changes": [
      "Ajustement du périmètre du suivi des envois et retours."
    ]
  },
  {
    "version": 78,
    "date": "2026-10-20",
    "title": "Navigation entre les onglets",
    "changes": [
      "Conservation de l’onglet dans l’adresse et prise en compte des boutons précédent et suivant."
    ]
  },
  {
    "version": 77,
    "date": "2026-10-20",
    "title": "Regroupement par code fournisseur",
    "changes": [
      "Consolidation des observations autour de l’identifiant du fournisseur."
    ]
  },
  {
    "version": 76,
    "date": "2026-10-20",
    "title": "Fiches fournisseurs",
    "changes": [
      "Page dédiée aux informations et au suivi d’un fournisseur."
    ]
  },
  {
    "version": 75,
    "date": "2026-10-20",
    "title": "Parcours d’import progressif",
    "changes": [
      "Amélioration de la disposition du Centre d’import et du chargement PURCHASES."
    ]
  },
  {
    "version": 74,
    "date": "2026-10-19",
    "title": "Suivi du cycle des simulations",
    "changes": [
      "Dates et détails Planner, suivi des trames, exports et améliorations du chargement."
    ]
  },
  {
    "version": 73,
    "date": "2026-10-19",
    "title": "Redimensionnement par les bords",
    "changes": [
      "Ajustement des dimensions et de l’alignement des blocs."
    ]
  },
  {
    "version": 72,
    "date": "2026-10-19",
    "title": "Composition du point allégée",
    "changes": [
      "Simplification de la présentation et de l’organisation du canevas."
    ]
  },
  {
    "version": 71,
    "date": "2026-10-19",
    "title": "Disposition initiale des fenêtres",
    "changes": [
      "Amélioration de la position et des dimensions par défaut."
    ]
  },
  {
    "version": 70,
    "date": "2026-10-19",
    "title": "Composition et diffusion modulaires",
    "changes": [
      "Évolution des blocs, des dossiers, du canevas libre et du rendu PURCHASES dans les exports."
    ]
  },
  {
    "version": 69,
    "date": "2026-10-19",
    "title": "Présentation des variations fournisseurs",
    "changes": [
      "Ajustement des graphiques et des commandes du tableau de bord."
    ]
  },
  {
    "version": 68,
    "date": "2026-10-16",
    "title": "Import PURCHASES complet",
    "changes": [
      "Lecture des fichiers CSV et Excel, sélection de feuilles et statistiques de volumes."
    ]
  },
  {
    "version": 67,
    "date": "2026-10-15",
    "title": "Module PURCHASES",
    "changes": [
      "Ajout du suivi PURCHASES dans le tableau de bord et des calculs associés."
    ]
  },
  {
    "version": 66,
    "date": "2026-10-15",
    "title": "Import Planner renforcé",
    "changes": [
      "Corrections du traitement et du registre des tâches importées."
    ]
  },
  {
    "version": 65,
    "date": "2026-10-15",
    "title": "Numéro de version unifié",
    "changes": [
      "Même version affichée dans les menus, l’aide et les exports."
    ]
  },
  {
    "version": 64,
    "date": "2026-10-15",
    "title": "Fiabilisation de l’export Excel",
    "changes": [
      "Corrections complémentaires de la génération du classeur."
    ]
  },
  {
    "version": 63,
    "date": "2026-10-15",
    "title": "Classeur Excel amélioré",
    "changes": [
      "Ajustement du modèle et de l’export des graphiques fournisseurs."
    ]
  },
  {
    "version": 62,
    "date": "2026-10-15",
    "title": "Graphiques de variations ajustés",
    "changes": [
      "Amélioration de la présentation des courbes et du tableau de bord fournisseur."
    ]
  },
  {
    "version": 61,
    "date": "2026-10-15",
    "title": "Métriques Planner fiabilisées",
    "changes": [
      "Corrections des imports et des calculs de variations fournisseurs."
    ]
  },
  {
    "version": 60,
    "date": "2026-10-15",
    "title": "Observations fournisseurs harmonisées",
    "changes": [
      "Fiabilisation de la sélection des données affichées dans les indicateurs."
    ]
  },
  {
    "version": 59,
    "date": "2026-10-15",
    "title": "Dernière intégration par fournisseur",
    "changes": [
      "Sélection de la dernière observation intégrée pour un fournisseur et un mois."
    ]
  },
  {
    "version": 58,
    "date": "2026-10-15",
    "title": "Export des graphiques vers Excel",
    "changes": [
      "Génération d’un classeur avec un modèle de graphique."
    ]
  },
  {
    "version": 57,
    "date": "2026-10-15",
    "title": "Export des graphiques en image",
    "changes": [
      "Téléchargement des graphiques au format PNG."
    ]
  },
  {
    "version": 56,
    "date": "2026-10-15",
    "title": "Courbes pondérées distinctes",
    "changes": [
      "Couleur dédiée aux variations pondérées dans les graphiques et mini historiques."
    ]
  },
  {
    "version": 55,
    "date": "2026-10-15",
    "title": "Recherche dans l’aide",
    "changes": [
      "Recherche dans les titres, étapes et notes des chapitres."
    ]
  },
  {
    "version": 54,
    "date": "2026-10-15",
    "title": "Recherche fournisseur améliorée",
    "changes": [
      "Liste de sélection recherchable, tri et sélection au clavier."
    ]
  },
  {
    "version": 53,
    "date": "2026-10-15",
    "title": "Variations mensuelles fournisseurs",
    "changes": [
      "Colonnes par mois, moyennes et distinction entre valeurs nulles et données absentes."
    ]
  },
  {
    "version": 52,
    "date": "2026-10-13",
    "title": "Procédures d’aide illustrées",
    "changes": [
      "Présentation des parcours d’aide en étapes courtes."
    ]
  },
  {
    "version": 51,
    "date": "2026-10-13",
    "title": "Canevas libre et aide intégrée",
    "changes": [
      "Déplacement et redimensionnement des blocs ; grille et aimantation ; éditeur flottant ; aide et export HTML autonome."
    ]
  },
  {
    "version": 50,
    "date": "2026-10-07",
    "title": "Accès et sessions simplifiés",
    "changes": [
      "Harmonisation de l’identification, de la session et du changement d’utilisateur."
    ]
  },
  {
    "version": 49,
    "date": "2026-10-07",
    "title": "Disposition des modules",
    "changes": [
      "Déplacement, largeurs des blocs, exports et indication de synchronisation."
    ]
  },
  {
    "version": 48,
    "date": "2026-10-07",
    "title": "Outils de modification contextualisés",
    "changes": [
      "Simplification de la navigation et des commandes de mise en forme."
    ]
  },
  {
    "version": 47,
    "date": "2026-10-07",
    "title": "Dossiers modifiables sur place",
    "changes": [
      "Édition du contenu directement dans la zone du dossier."
    ]
  },
  {
    "version": 46,
    "date": "2026-10-07",
    "title": "Comparaison des périodes d’activité",
    "changes": [
      "Amélioration des statistiques analystes et de la navigation dans les résultats."
    ]
  },
  {
    "version": 45,
    "date": "2026-10-07",
    "title": "Dossiers enrichis et comparatifs",
    "changes": [
      "Évolution de l’éditeur de dossiers, des pièces visuelles, des imports Jira et des comparaisons de simulations."
    ]
  },
  {
    "version": 44,
    "date": "2026-09-07",
    "title": "Sauvegarde automatique et conflits",
    "changes": [
      "Sauvegarde des brouillons et protection contre les modifications concurrentes."
    ]
  },
  {
    "version": 43,
    "date": "2026-09-07",
    "title": "Protection des brouillons",
    "changes": [
      "Harmonisation de l’édition directe et des exports portables."
    ]
  },
  {
    "version": 42,
    "date": "2026-09-05",
    "title": "Adaptation mobile du site",
    "changes": [
      "Ajustement des écrans et des commandes aux petits formats."
    ]
  },
  {
    "version": 41,
    "date": "2026-09-04",
    "title": "Édition directe harmonisée",
    "changes": [
      "Finalisation du parcours de saisie et de lecture du point."
    ]
  },
  {
    "version": 40,
    "date": "2026-09-04",
    "title": "Édition directe du point",
    "changes": [
      "Refonte de la modification du contenu sur le point marché."
    ]
  },
  {
    "version": 39,
    "date": "2026-09-03",
    "title": "Modification en réunion et comparaison",
    "changes": [
      "Saisies manuelles, préparation des mails et comparaison des marchés."
    ]
  },
  {
    "version": 38,
    "date": "2026-09-02",
    "title": "Graphiques fournisseurs compacts",
    "changes": [
      "Amélioration du contraste des simulations et ajout de mini courbes."
    ]
  },
  {
    "version": 37,
    "date": "2026-09-02",
    "title": "Thèmes clair et sombre",
    "changes": [
      "Refonte visuelle et amélioration des contrastes de l’interface."
    ]
  },
  {
    "version": 36,
    "date": "2026-09-02",
    "title": "Dates des tickets terminés",
    "changes": [
      "Allègement de l’affichage des tickets analystes clôturés."
    ]
  },
  {
    "version": 35,
    "date": "2026-09-02",
    "title": "Totaux et moyennes Jira",
    "changes": [
      "Totaux de période, moyennes hebdomadaires et comparaison avec la semaine précédente."
    ]
  },
  {
    "version": 34,
    "date": "2026-09-02",
    "title": "Achats par simulation",
    "changes": [
      "Affichage du chiffre d’affaires fournisseur importé pour chaque simulation, sans agrégation."
    ]
  },
  {
    "version": 33,
    "date": "2026-09-02",
    "title": "Activité analyste et calendrier",
    "changes": [
      "Tendances des tickets terminés et navigation hebdomadaire simplifiée."
    ]
  },
  {
    "version": 32,
    "date": "2026-09-02",
    "title": "Tickets Jira abandonnés",
    "changes": [
      "Exclusion des tickets abandonnés des points et des compteurs d’activité."
    ]
  },
  {
    "version": 31,
    "date": "2026-09-01",
    "title": "Registres Jira volumineux",
    "changes": [
      "Lecture des grands imports et reconnaissance du statut Fini comme terminé."
    ]
  },
  {
    "version": 30,
    "date": "2026-09-01",
    "title": "Activité Jira hebdomadaire",
    "changes": [
      "Correction du calcul de l’activité sur les périodes sélectionnées."
    ]
  },
  {
    "version": 29,
    "date": "2026-08-31",
    "title": "Alimentation des résolutions Jira",
    "changes": [
      "Fiabilisation des totaux de tickets résolus par semaine."
    ]
  },
  {
    "version": 28,
    "date": "2026-08-31",
    "title": "Attribution et participation Jira",
    "changes": [
      "Distinction entre responsable d’un ticket et participation à son traitement."
    ]
  },
  {
    "version": 27,
    "date": "2026-08-31",
    "title": "Résolutions Jira hebdomadaires",
    "changes": [
      "Ajout des tickets résolus dans le suivi par semaine."
    ]
  },
  {
    "version": 26,
    "date": "2026-08-31",
    "title": "Attribution Jira globale",
    "changes": [
      "Correction des correspondances entre tickets, personnes et marchés."
    ]
  },
  {
    "version": 25,
    "date": "2026-08-31",
    "title": "Import Jira centralisé",
    "changes": [
      "Unification de l’entrée et du traitement des tickets importés."
    ]
  },
  {
    "version": 24,
    "date": "2026-08-31",
    "title": "Centre d’import Jira et Planner",
    "changes": [
      "Regroupement des parcours d’import."
    ]
  },
  {
    "version": 23,
    "date": "2026-08-27",
    "title": "Fiabilisation des points analystes",
    "changes": [
      "Corrections du traitement Planner et du point analyste."
    ]
  },
  {
    "version": 22,
    "date": "2026-08-27",
    "title": "Point marché alimenté par Planner",
    "changes": [
      "Harmonisation des informations utilisées dans les blocs de simulations."
    ]
  },
  {
    "version": 21,
    "date": "2026-08-27",
    "title": "Simulations Planner dans le point marché",
    "changes": [
      "Rapprochement des simulations et des informations du point."
    ]
  },
  {
    "version": 20,
    "date": "2026-08-27",
    "title": "Point analyste et variations fournisseurs",
    "changes": [
      "Ajout d’un point dédié aux analystes et du suivi des variations."
    ]
  },
  {
    "version": 19,
    "date": "2026-08-27",
    "title": "Paramètres, alertes Jira et diffusion",
    "changes": [
      "Amélioration des réglages et du partage du point."
    ]
  },
  {
    "version": 18,
    "date": "2026-08-27",
    "title": "Simulations et délais Planner",
    "changes": [
      "Regroupement des simulations et affichage des délais issus de Planner."
    ]
  },
  {
    "version": 17,
    "date": "2026-08-27",
    "title": "Import Planner et statistiques analystes",
    "changes": [
      "Ajout des tâches Planner et du suivi de l’activité des analystes."
    ]
  },
  {
    "version": 16,
    "date": "2026-08-26",
    "title": "Radar Jira et kit Outlook",
    "changes": [
      "Refonte de la synthèse des tickets et de la préparation du mail."
    ]
  },
  {
    "version": 15,
    "date": "2026-08-26",
    "title": "Parcours et fenêtres simplifiés",
    "changes": [
      "Clarification des rôles Jira et des interactions dans les fenêtres."
    ]
  },
  {
    "version": 14,
    "date": "2026-08-25",
    "title": "Import Jira détaillé et tendances",
    "changes": [
      "Requêtes par identifiant et suivi de l’évolution de l’activité."
    ]
  },
  {
    "version": 13,
    "date": "2026-08-25",
    "title": "Annuaire et reprise hebdomadaire",
    "changes": [
      "Association des personnes aux marchés ; préparation Jira et mail ; reprise sélective du point précédent."
    ]
  },
  {
    "version": 12,
    "date": "2026-08-25",
    "title": "Identification des éditeurs",
    "changes": [
      "Accès à la saisie avec l’identifiant professionnel."
    ]
  },
  {
    "version": 11,
    "date": "2026-08-25",
    "title": "Un point par marché et par semaine",
    "changes": [
      "Simplification du registre et de la sélection du point enregistré."
    ]
  },
  {
    "version": 10,
    "date": "2026-08-25",
    "title": "Sélecteur de semaine visuel",
    "changes": [
      "Remplacement du champ de semaine par un calendrier."
    ]
  },
  {
    "version": 9,
    "date": "2026-08-25",
    "title": "Navigation de lecture simplifiée",
    "changes": [
      "Amélioration de l’accès au point et aux rubriques de consultation."
    ]
  },
  {
    "version": 8,
    "date": "2026-08-25",
    "title": "Navigation lecteur et édition protégée",
    "changes": [
      "Séparation des parcours de lecture et de modification ; rapprochement Jira hebdomadaire."
    ]
  },
  {
    "version": 7,
    "date": "2026-08-25",
    "title": "Prévisualisation de l’import Jira",
    "changes": [
      "Sélection des tickets à retenir pour chaque marché."
    ]
  },
  {
    "version": 6,
    "date": "2026-08-25",
    "title": "Import Jira par personne et marché",
    "changes": [
      "Récapitulatif des tickets importés pour alimenter le point."
    ]
  },
  {
    "version": 5,
    "date": "2026-08-24",
    "title": "Marchés et années ISO",
    "changes": [
      "Gestion dynamique des marchés et des semaines selon le calendrier ISO."
    ]
  },
  {
    "version": 4,
    "date": "2026-08-24",
    "title": "Accès au registre en ligne",
    "changes": [
      "Correction de l’ouverture du registre partagé."
    ]
  },
  {
    "version": 3,
    "date": "2026-08-24",
    "title": "Registre hebdomadaire et versions",
    "changes": [
      "Enregistrement des points par semaine et échanges au format JSON."
    ]
  },
  {
    "version": 2,
    "date": "2026-08-20",
    "title": "Saisie du point marché dans le navigateur",
    "changes": [
      "Transformation du tableau de bord en outil de préparation et de saisie."
    ]
  },
  {
    "version": 1,
    "date": "2026-08-07",
    "title": "Première version du tableau de bord marché 2026",
    "changes": [
      "Présentation animée du point et des indicateurs de suivi."
    ]
  }
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function findReleases(query: string): ReleaseNote[] {
  const term = normalize(query.trim());
  const version = /^v?(\d+)$/.exec(term);
  return releaseHistory.filter(entry => version ? entry.version === Number(version[1]) : normalize(`V${entry.version} ${entry.date} ${entry.title} ${entry.changes.join(" ")}`).includes(term));
}
