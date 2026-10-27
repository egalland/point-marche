import { siteMapXml } from "@/lib/site-map";
export function GET(request: Request) {
  return new Response(siteMapXml(new URL(request.url).origin), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
