// Altas y claves de usuarios, solo para el administrador de Elite Sport.
// Se despliega como Edge Function con verify_jwt = true: Supabase ya exige una sesion valida,
// y aqui ademas se comprueba que quien llama sea un administrador aprobado.
// La clave de servicio (SUPABASE_SERVICE_ROLE_KEY) vive solo en el entorno de la funcion, nunca en el navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ROLES = ['mayorista', 'mayorista_sector', 'bodeguero', 'auxiliar_bodega', 'cajero', 'vendedor'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS = ['aprobado', 'pendiente', 'suspendido', 'rechazado'] as const

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fallo = (mensaje: string, status = 400) => responder({ error: mensaje }, status)
const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fallo('Método no permitido', 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !servicio) return fallo('La función no está configurada', 500)

  // 1. Quien llama: sesion valida y rol de administrador aprobado.
  const auth = req.headers.get('Authorization') ?? ''
  const quien = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: sesion, error: errSesion } = await quien.auth.getUser()
  if (errSesion || !sesion.user) return fallo('Sesión no válida', 401)

  const admin = createClient(url, servicio, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: perfil } = await admin.from('perfiles').select('rol, estado').eq('id', sesion.user.id).maybeSingle()
  if (!perfil || perfil.rol !== 'admin' || perfil.estado !== 'aprobado') return fallo('Solo el administrador puede hacer esto', 403)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return fallo('Solicitud no válida')
  }

  // 2a. Cambiar la clave de alguien.
  if (cuerpo.accion === 'contrasena') {
    const id = texto(cuerpo.id, 60)
    const clave = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : ''
    if (!id) return fallo('Falta la persona')
    if (clave.length < 8) return fallo('La contraseña debe tener al menos 8 caracteres.')
    const { data: destino } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (!destino) return fallo('No encontramos a esa persona', 404)
    if (destino.rol === 'admin') return fallo('La clave del administrador se cambia desde su propia cuenta.', 403)
    const { error } = await admin.auth.admin.updateUserById(id, { password: clave })
    if (error) return fallo(error.message)
    return responder({ ok: true })
  }

  // 2c. Eliminar a una persona. Su historial se conserva (los pedidos quedan sin nombre), pero no puede tener nada abierto.
  if (cuerpo.accion === 'eliminar') {
    const id = texto(cuerpo.id, 60)
    if (!UUID.test(id)) return fallo('Falta la persona')
    if (id === sesion.user.id) return fallo('No puedes eliminar tu propia cuenta.', 403)
    const { data: destino } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle()
    if (!destino) return fallo('No encontramos a esa persona', 404)
    if (destino.rol === 'admin') return fallo('No se puede eliminar al administrador.', 403)
    const { count } = await admin
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('solicitante_id', id)
      .or('and(tipo.eq.consignacion,estado.in.(nuevo,entregado)),and(tipo.eq.mostrador,estado.eq.nuevo)')
    if ((count ?? 0) > 0) {
      return fallo('Tiene entregas de bodega o ventas abiertas. Ciérralas antes de eliminarla; si solo quieres que no entre, suspéndela.', 409)
    }
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return fallo(error.message)
    return responder({ ok: true })
  }

  // 2b. Crear un usuario con acceso.
  if (cuerpo.accion === 'crear') {
    const correo = texto(cuerpo.correo, 120).toLowerCase()
    const clave = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : ''
    const nombre = texto(cuerpo.nombre, 120)
    const rol = texto(cuerpo.rol, 30)
    const estado = texto(cuerpo.estado, 20) || 'aprobado'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return fallo('El correo no es válido.')
    if (clave.length < 8) return fallo('La contraseña debe tener al menos 8 caracteres.')
    if (!nombre) return fallo('Falta el nombre.')
    if (!(ROLES as readonly string[]).includes(rol)) return fallo('El rol no es válido.')
    if (!(ESTADOS as readonly string[]).includes(estado)) return fallo('El estado no es válido.')
    // El vendedor pertenece a un local (Élite, KZ, Mega Moda...).
    const local = texto(cuerpo.local_id, 60)
    if (rol === 'vendedor' && !UUID.test(local)) return fallo('Elige el local del vendedor.')
    if (rol === 'vendedor') {
      const { data: existe } = await admin.from('locales').select('id').eq('id', local).eq('activo', true).maybeSingle()
      if (!existe) return fallo('Ese local no existe o está desactivado.')
    }

    const datos = {
      nombre,
      negocio: texto(cuerpo.negocio, 120),
      telefono: texto(cuerpo.telefono, 30),
      cedula_ruc: texto(cuerpo.cedula_ruc, 20),
      ciudad: texto(cuerpo.ciudad, 80),
      direccion: texto(cuerpo.direccion, 200),
    }
    const { data: nuevo, error } = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true, user_metadata: datos })
    if (error || !nuevo.user) {
      const yaExiste = /already|registered|exists/i.test(error?.message ?? '')
      return fallo(yaExiste ? 'Ese correo ya tiene una cuenta.' : (error?.message ?? 'No se pudo crear la cuenta'), yaExiste ? 409 : 400)
    }
    // El alta crea el perfil como "mayorista pendiente": aqui se le da su rol y se aprueba.
    const { error: errPerfil } = await admin
      .from('perfiles')
      .update({ rol, estado, local_id: rol === 'vendedor' ? local : null })
      .eq('id', nuevo.user.id)
    if (errPerfil) {
      await admin.auth.admin.deleteUser(nuevo.user.id)
      return fallo('No se pudo asignar el rol: ' + errPerfil.message, 500)
    }
    return responder({ ok: true, id: nuevo.user.id })
  }

  return fallo('Acción no válida')
})
