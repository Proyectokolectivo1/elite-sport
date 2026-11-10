/**
 * Metadatos Open Graph por tienda: /t/:slug devuelve el mismo index.html de la SPA
 * con título, descripción e imagen de esa tienda, para que WhatsApp, Instagram y Google
 * muestren su nombre y logo al compartir el enlace.
 */
interface TiendaMeta {
  nombre: string
  logo_url: string | null
  banner_url: string | null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function obtenerTienda(slug: string): Promise<TiendaMeta | null> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null
  const r = await fetch(`${base}/rest/v1/tiendas?select=nombre,logo_url,banner_url&slug=eq.${slug}&activa=eq.true&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!r.ok) return null
  const filas = (await r.json()) as TiendaMeta[]
  return filas[0] ?? null
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') ?? ''
  const base = await fetch(new URL('/index.html', url.origin))
  let html = await base.text()

  const tienda = await obtenerTienda(slug).catch(() => null)
  if (tienda) {
    const titulo = `${tienda.nombre} · Catálogo de calzado`
    const desc = `Catálogo de ${tienda.nombre}: calzado para dama, caballero y niño. Elige tu talla y haz tu pedido por WhatsApp.`
    const imagen = tienda.banner_url ?? tienda.logo_url
    const metas = [
      `<meta property="og:title" content="${esc(titulo)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:url" content="${esc(`${url.origin}/t/${slug}`)}" />`,
      ...(imagen ? [`<meta property="og:image" content="${esc(imagen)}" />`, '<meta name="twitter:card" content="summary_large_image" />'] : []),
    ].join('\n    ')
    html = html
      .replace(/<title>.*?<\/title>/, `<title>${esc(titulo)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
      .replace(/<meta property="og:(title|description)"[^>]*>\s*/g, '')
      .replace('</head>', `    ${metas}\n  </head>`)
  }

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  })
}
