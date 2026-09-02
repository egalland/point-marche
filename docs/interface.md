# Interface Market Pulse

## Organisation

- `components/` : apparence, icônes, fenêtres, menus, saisie des dates et pagination partagés.
- `features/market-pulse/` : écrans métier et navigation principale. Les règles et calculs restent dans `lib/`.
- `app/styles/theme.css` : couleurs et variables sémantiques communes aux deux thèmes.
- `app/styles/components.css` : styles des modules du point marché, de l’édition et des imports.
- `app/styles/analyst.css` : modules analystes, graphique hebdomadaire et calendrier.
- `app/styles/workspace.css` : navigation, mise en page harmonisée et adaptations aux petits écrans.

## Apparence

La préférence clair, sombre ou système appartient au navigateur, pas au point enregistré. Le script d’amorçage applique le thème avant l’hydratation ; le fournisseur React suit ensuite les changements système et les autres onglets. Un stockage indisponible ne bloque pas le rendu.

Les couleurs personnalisées du point sont conservées. `accentTokens` en produit deux variantes de contraste pour l’interface, sans modifier la valeur sauvegardée. Les mails restent sur fond blanc.

## Volumes et interactions

Les tableaux de détail sont paginés par 100 lignes après filtrage et tri. Les statistiques utilisent toujours la sélection entière. Les activités d’une simulation sont regroupées en un passage, sans additionner le CA fourni. Les contenus HTML des mails ne sont générés que lorsque leur vue est ouverte.

Les fenêtres partagent une gestion du focus, du clavier et du verrouillage du défilement. Le clic extérieur doit commencer et finir sur le fond. Échap ne ferme que la fenêtre supérieure et respecte les opérations en cours.

## Contrôles

`npm test` compile le site puis exécute les tests métier et d’interface. Les tests couvrent notamment les thèmes, les contrastes, la pagination, le focus et le rendu des indicateurs. Ils ne remplacent pas une vérification visuelle sur appareil.

`node scripts/build-offline.mjs /chemin/market-pulse.html` regroupe les styles locaux pour le générateur portable existant. Le centre d’import, l’authentification et les sauvegardes du site conservent leurs API ; leur fonctionnement ne devient pas hors ligne.
