/** Navigable application sections. No private records or API routes are indexed. */
export const siteMapGroups = [
  { title: "Points hebdomadaires", pages: [
    { href: "/", title: "Point marché", description: "Semaine, synthèse, dossiers, opérations commerciales, activité Jira et achats." },
    { href: "/?mode=analyst", title: "Point analyste", description: "Synthèse, tickets terminés, simulations et contrôles, cycle du 20 au 20 et dossiers." },
  ] },
  { title: "Données et suivi", pages: [
    { href: "/?mode=stats", title: "Statistiques", description: "Indicateurs et analyses des activités par période." },
    { href: "/?mode=suppliers", title: "Fournisseurs", description: "Recherche, fiches et suivi des fournisseurs." },
    { href: "/?mode=imports", title: "Centre d’import", description: "Actualisation des sources et vérification des imports." },
  ] },
  { title: "Diffusion et réglages", pages: [
    { href: "/?mode=mail", title: "Mail du marché", description: "Aperçu du mail, fichier HTML et préparation de la diffusion." },
    { href: "/?mode=settings", title: "Paramètres", description: "Réglages de présentation, annuaire, sources et destinataires." },
  ] },
  { title: "Administration", pages: [
    { href: "/?mode=admin", title: "Administration", description: "Gestion des idées et bugs, notifications et journal selon les autorisations." },
    { href: "/?mode=superadmin", title: "Super admin", description: "Attribution des rôles et grille des autorisations du site." },
  ] },
  { title: "Aide et navigation", pages: [
    { href: "/aide", title: "Aide", description: "Modes opératoires et recherche documentaire." },
    { href: "/plan-du-site", title: "Plan du site", description: "Accès à toutes les rubriques de l’application." },
  ] },
];
export function siteMapXml(origin: string) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + siteMapGroups.flatMap(group => group.pages).map(page => `  <url><loc>${escape(new URL(page.href, origin).href)}</loc></url>`).join('\n') + '\n</urlset>\n';
}
