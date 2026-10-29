# V115 — États des promotions et renommage des blocs

Les étapes sont visibles dans les cartes de promotion, sans ouverture du détail. Cinq états : À faire, Validée, Non réalisée, Bloquée, En cours ; icône et libellé accompagnent la couleur. Les éditeurs disposent d’un sélecteur direct ; les lecteurs voient un libellé sans contrôle d’écriture. Les cases de validation du détail restent disponibles et synchronisées avec l’état. Une validation conserve sa date ; quitter cet état retire la date. Anciennes données migrées depuis done.

Statuts globaux colorés et choix Bloqué/Annulé ajoutés. Les exports HTML/mail reprennent les libellés, icônes et couleurs. Commande Renommer le bloc directement dans le menu ⋯ ; le titre persiste via le réglage existant et suit les exports.

Validation : TypeScript ; 401 tests passés ; compilation Worker et vérification du HTML autonome. Le navigateur de contrôle était initialement indisponible (connexion au preview refusée) ; aucune revendication de contrôle visuel supplémentaire pour cette passe. Aucun paquet local livré.
