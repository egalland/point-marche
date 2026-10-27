export function GET(request: Request) {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${new URL("/sitemap.xml", request.url).href}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
