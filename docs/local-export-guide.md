# Market Pulse — utilisation locale

L’application reprend les points marché et analystes, les personnes, les imports Jira et Planner, les simulations et les statistiques fournisseurs. Elle fonctionne dans une version récente d’Edge ou de Chrome, depuis un fichier HTML, sans installation et sans serveur.

## Première ouverture : reprendre les données du site

1. Extraire tout le ZIP dans un dossier sur le PC.
2. Ouvrir `MARKET_PULSE_LOCAL.html` par double-clic.
3. Dans « Retrouver mes données du site », cliquer sur **Choisir le CSV Jira de reprise** et sélectionner le fichier **JIRA WORKSPACE 2026-08-31T09_59_36+0200.csv** déjà utilisé dans le site.
4. Après le contrôle, cliquer sur **Enregistrer** pour créer le fichier **Market-Pulse-GLOBAL.marketpulse.json** sur le PC.

Le CSV d’origine est nécessaire une seule fois pour cette reprise. Le dernier export accessible contient 10 025 tickets sur 12 491 et 10 025 participations sur 11 214. La copie complète des 4 marchés, 9 personnes, 4 points marché, 2 points analystes et 1 211 tâches Planner est incluse dans le HTML.

Le rapprochement attend les totaux exacts et compare les tickets et participants déjà récupérés. Un CSV plus récent ou différent peut être refusé. Pour cette première reprise, retrouver le fichier d’origine ; les imports habituels permettent ensuite de mettre les données à jour.

Le classeur complet n’est pas fourni dans le ZIP, car ce CSV manque encore. Si le fichier d’origine est introuvable sur le PC, le joindre à la conversation dès qu’il est retrouvé. Les données partielles conservées dans la sauvegarde de reprise ne doivent pas servir de base à des statistiques complètes.

**Créer un classeur vide** permet d’utiliser immédiatement l’application pour une nouvelle base. Cela ne récupère pas les données du site. La reprise d’origine reste accessible ensuite dans **Aide / options**.

## Utilisation quotidienne

- Ouvrir `MARKET_PULSE_LOCAL.html`, puis **Ouvrir mon fichier de données** et sélectionner le classeur `.marketpulse.json` enregistré.
- Effectuer les modifications, imports et points comme dans l’application habituelle.
- **Sauvegarder la semaine** ajoute ou actualise le point dans l’historique du classeur.
- **Enregistrer** ou **Ctrl+S** conserve tout le classeur, y compris les brouillons, dans le fichier du PC.
- **Enregistrer sous** ou **Ctrl+Maj+S** crée une autre copie.

Si le navigateur n’autorise pas l’enregistrement direct, utiliser **Aide / options → Télécharger une copie**, vérifier le téléchargement et confirmer **J’ai bien enregistré la copie**. Pour l’ouverture, le bouton **Choisir un fichier** reste disponible.

Lorsqu’un fichier a été modifié ailleurs, l’application demande d’enregistrer une autre copie. La récupération de la session précédente conserve un brouillon dans le navigateur ; le fichier sur disque reste la sauvegarde à conserver.

## Ce qui est local

Les données, calculs, imports, graphiques et exports sont traités dans le navigateur. La version locale ne synchronise pas ses modifications avec le site. Les liens vers Jira ou Planner et les actions de messagerie ouvrent les outils habituels et demandent la connexion correspondante.

Pour déplacer le travail sur un autre PC, copier l’application HTML et le classeur `.marketpulse.json`. Ce fichier contient des données métier en clair : utiliser un emplacement professionnel autorisé et éviter de modifier la même copie simultanément sur plusieurs postes.

## Contenu du ZIP

- `MARKET_PULSE_LOCAL.html` : application autonome et reprise guidée des données.
- `LIRE_MOI.txt` : démarrage rapide et état de la reprise.
- `GUIDE_UTILISATION.md` : ce guide.
- `MARKET_PULSE_SOURCES.zip` : code source pour maintenance ou reconstruction ; aucune installation n’est nécessaire pour utiliser le HTML.
- `Reprise-technique/` : extraction initiale et point de reprise vérifié, pour pouvoir poursuivre sans perdre l’avancement.

## Vérifications effectuées

La compilation locale, le contrôle TypeScript et 33 tests ciblés passent. Les tests couvrent notamment la reprise de plus de 12 000 tickets, l’import de 25 000 tickets, les participants, le refus des CSV incohérents, la relecture des classeurs et les erreurs d’enregistrement.

Le rapprochement avec le CSV réel complet et le parcours interactif dans un navigateur restent à effectuer. Le site et ses données en ligne n’ont pas été modifiés par cet export.
