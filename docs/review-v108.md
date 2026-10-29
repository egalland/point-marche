# Revue V108 — 28 octobre 2026

## Corrections livrées

- Synthèse des blocs visibles : dossiers actifs, simulations à suivre, tickets ouverts, promotions. Une source inconnue reste inconnue.
- Liste de relecture avant diffusion : semaine choisie, priorité, fraîcheur des sources, responsables et prochaines actions, PURCHASES, destinataires et sauvegarde. Les pièces jointes déclenchent un rappel de contrôle chez les destinataires.
- Édition de la priorité accessible par un bouton explicite.
- Adresses de mail invalides signalées et fichier Outlook bloqué ; elles ne disparaissent plus silencieusement.
- Import PURCHASES dans l’application autonome, y compris le formulaire de fichier utilisé par l’interface. Données et métadonnées constituent un seul lot dans le classeur et le journal partagé. Une extraction contenant des lignes invalides conserve le registre précédent.
- Limites des fichiers Jira et de la décompression XLSX ; contrôle des en-têtes ZIP, tailles et bornes de cellules.
- Un import Jira validé reste présenté comme terminé si seule l’actualisation de l’écran échoue.
- Modèle Excel limité aux styles et structures, sans valeurs d’exemple ni cache de graphique.
- Distribution locale séparant application et données ; commande de préparation du paquet de mise à jour corrigée.

## Parcours vérifié

Un test intégré utilise exclusivement des données fictives : import Jira, filtrage par marché, import Planner, correction d’un ticket, réactualisation sans perte de la correction, import PURCHASES par fichier, refus d’une extraction incorrecte, sauvegarde, fermeture/réouverture du classeur, préparation du mail et de sa page HTML. Les exports excluent les éléments hors périmètre.

La suite vérifie aussi les conflits de points, les semaines ISO, les exports Excel, les limites de volume, les autorisations, les imports et la conservation des données lors d’une mise à jour locale. Le rendu a été contrôlé dans un environnement isolé, sur ordinateur et dans un cadre de 390 pixels de large ; aucun accès aux données de production n’a été nécessaire.

## Limites et travaux suivants

1. L’identification par identifiant déclaré n’est pas une authentification vérifiée. Le site hébergé nécessite une identité vérifiée côté serveur et une politique d’accès adaptée avant d’être considéré comme un espace confidentiel. Les droits de lecture des API doivent suivre la grille des autorisations.
2. Les images et pièces jointes hébergées doivent être contrôlées avec un destinataire réel : les liens directs ne portent pas l’en-tête applicatif d’identification. L’upload de fichiers dans les dossiers de la version locale reste indisponible et est désormais indiqué explicitement.
3. L’import Planner hébergé effectue plusieurs écritures : prévoir un lot temporaire et une bascule atomique afin de conserver intégralement le registre précédent lors d’une interruption.
4. Les rapports historiques peuvent être enrichis avec le registre actuel. Distinguer explicitement une lecture figée de l’actualisation volontaire avant d’utiliser les points comme preuve historique.
5. Découper progressivement le composant principal et les couches CSS historiques, en conservant les tests de parcours et de mise en page.
6. La vérification du fichier EML ne remplace pas un essai dans la version d’Outlook réellement utilisée ni un contrôle des restrictions de pièces jointes de l’entreprise. Le partage local doit également être essayé sur le dossier réseau réel.

Le rapport d’audit détaillé et le plan de nettoyage du dépôt public sont conservés séparément des sources du site. Une vérification de motifs ne constitue pas une garantie absolue d’absence de données confidentielles.

Validation : 382 tests automatisés réussis, TypeScript et build Worker validés. Les exemples et noms de fournisseurs des tests sont fictifs.
