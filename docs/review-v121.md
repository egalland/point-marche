# V121 — Blocs mobiles et export des demandes

Supprime les limites de hauteur des corps de blocs sur mobile, sans changer les coordonnées enregistrées sur ordinateur. Le défilement de la page donne accès au contenu entier ; les blocs repliés restent masqués.

Bugs et idées : export ZIP de toutes les demandes ou du ticket ouvert, après lecture de ses détails complets. PROMPT.md, tickets.json et les captures binaires sont inclus ; aucun téléchargement partiel en cas d’erreur de lecture. Aucun envoi automatique. L’aide intégrée décrit les fonctions actuelles, la synchronisation réseau et les instantanés des points.

Validation : TypeScript, 415 tests, compilation Worker et vérification du HTML autonome. Navigateur local, données fictives, largeur 390 px : tous les corps de blocs ont une hauteur égale à leur contenu ; le bloc de 19 simulations atteint 1766 px sans découpe. Export depuis l’interface confirmé avec une capture fictive ; ZIP relu par Python dans les tests (textes, historique et octets des images).
