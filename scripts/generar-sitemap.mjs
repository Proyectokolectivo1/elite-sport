// Genera dist/sitemap.xml al compilar: tienda principal, productos activos y secciones de mayoristas activas.
// Si Supabase no responde, deja al menos las rutas fijas: nunca rompe la compilacion.
import { mkdirSync, writeFileSync } from 'node:fs'

const ORIGEN = (process.env.SITE_URL || 'https://teniselitesport.com').replace(/\/$/, '')
const base = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
async function leer(ruta) {
  try {
    const r = await fetch(`${base}/rest/v1/${ruta}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    return r.ok ? await r.json() : []
  } catch {
    return []
  }
}

const urls = [{ loc: `${ORIGEN}/` }, { loc: `${ORIGEN}/catalogo` }]
if (base && key) {
  const [productos, tiendas] = await Promise.all([
    leer('productos?select=slug,creado_en&activo=eq.true'),
    leer('tiendas?select=slug&activa=eq.true&es_principal=eq.false'),
  ])
  for (const p of productos) urls.push({ loc: `${ORIGEN}/producto/${encodeURIComponent(p.slug)}`, lastmod: p.creado_en?.slice(0, 10) })
  for (const t of tiendas) urls.push({ loc: `${ORIGEN}/t/${encodeURIComponent(t.slug)}` })
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
  `\n</urlset>\n`
mkdirSync('dist', { recursive: true })
writeFileSync('dist/sitemap.xml', xml)
console.log(`sitemap.xml: ${urls.length} rutas`)
