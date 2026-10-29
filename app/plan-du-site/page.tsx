import { siteMapGroups } from "@/lib/site-map";
import { APP_VERSION } from "@/lib/app-version";
export const metadata = { title: "Plan du site · Market Plus", description: "Toutes les rubriques de Market Plus : points, statistiques, fournisseurs, imports et diffusion." };
export default function SiteMapPage() {
  return <main className="site-map-page"><a href="/">← Revenir à l’application</a><h1>Plan du site</h1><p>Market Plus · {APP_VERSION} — retrouve les rubriques et leurs principaux contenus.</p><nav aria-label="Plan du site">{siteMapGroups.map(group => <section key={group.title}><h2>{group.title}</h2><ul>{group.pages.map(page => <li key={page.href}><a href={page.href}>{page.title}</a><p>{page.description}</p></li>)}</ul></section>)}</nav><footer><a href="/sitemap.xml">Télécharger le sitemap XML</a></footer></main>;
}
