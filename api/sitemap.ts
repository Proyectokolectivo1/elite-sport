/** sitemap.xml dinámico: tienda principal, productos activos y secciones de mayoristas activas. */
interface Fila {
  slug: string
  creado_en?: string
}

async function leer(base: string, key: string, ruta: string): Promise<Fila[]> {
  const r = await fetch(`${base}/rest/v1/${ruta}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) return []
  return (await r.json()) as Fila[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET(request: Request): Promise<Response> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  const origin = new URL(request.url).origin
  const urls: { loc: string; lastmod?: string }[] = [{ loc: `${origin}/` }, { loc: `${origin}/catalogo` }]

  if (base && key) {
    const [productos, tiendas] = await Promise.all([
      leer(base, key, 'productos?select=slug,creado_en&activo=eq.true'),
      leer(base, key, 'tiendas?select=slug&activa=eq.true&es_principal=eq.false'),
    ])
    for (const p of productos) urls.push({ loc: `${origin}/producto/${encodeURIComponent(p.slug)}`, lastmod: p.creado_en?.slice(0, 10) })
    for (const t of tiendas) urls.push({ loc: `${origin}/t/${encodeURIComponent(t.slug)}` })
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>\n`

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
