/**
 * Datos de la empresa en la nube (tabla `datos` de Supabase): una fila por colección (productos, ventas, …).
 * Lo hecho en cualquier equipo de la empresa (computadora o celular, titular o invitado) lo ven todos:
 * - Los cambios de este equipo se suben a los ~0,8 s. Si otra persona guardó justo antes, se COMBINAN
 *   (fusión de tres vías, ver fusion.ts): ninguna venta, gasto o registro se pierde.
 * - Los cambios de los demás llegan en vivo y, por si el celular cortó la conexión, también al volver a la app,
 *   al recuperar internet y cada minuto.
 * - Lo hecho sin conexión queda en el equipo y se sube (combinado) cuando vuelve la conexión.
 */
import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { useApp, ROLES, esCuenta, type Rol } from '../store/useApp'
import { EMPRESA_BASE } from '../data/base'
import { equipoEmpresa, fotoDe, miAcceso, nombreDe, supabase, type Acceso } from './cuenta'
import { esAnterior, fusionar, igual } from './fusion'

const comoRol = (r: string): Rol | null => ((ROLES as string[]).includes(r) ? (r as Rol) : null)

const CLAVES = ['empresa', 'sucursales', 'proveedores', 'productos', 'movimientos', 'ordenes', 'auditoria', 'gastos', 'cierres', 'ventas', 'tareas', 'notas', 'clientes'] as const
type Clave = (typeof CLAVES)[number]
const vacios = (): Record<Clave, unknown> => ({ empresa: EMPRESA_BASE, sucursales: [], proveedores: [], productos: [], movimientos: [], ordenes: [], auditoria: [], gastos: [], cierres: [], ventas: [], tareas: [], notas: [], clientes: [] })

// ---------- Estado visible (ícono de nube) ----------
export type EstadoNube = 'apagada' | 'conectando' | 'al-dia' | 'guardando' | 'sin-conexion'
let estado: EstadoNube = 'apagada'
const oyentes = new Set<() => void>()
const fijar = (e: EstadoNube) => { if (e !== estado) { estado = e; oyentes.forEach((f) => f()) } }
export const useEstadoNube = () => useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, () => estado)

// Empresa cuyos datos están guardados en este navegador (para no mezclar dos empresas en un mismo equipo).
const ULTIMA = 'nexora-nube-empresa'
const leerUltima = () => { try { return localStorage.getItem(ULTIMA) } catch { return null } }
const guardarUltima = (id: string) => { try { localStorage.setItem(ULTIMA, id) } catch { /* sin almacenamiento */ } }

let empresaId: string | null = null
let miId: string | null = null
let canal: RealtimeChannel | null = null
let quitarSub: (() => void) | null = null
let remoto = false
let subiendo = false
let reloj: ReturnType<typeof setTimeout> | undefined
let relojSinc: ReturnType<typeof setTimeout> | undefined
let intervalo: ReturnType<typeof setInterval> | undefined
const pendientes = new Set<Clave>()
/** Lo último que este equipo sabe que estaba en la nube (por colección): sirve para combinar sin perder nada. */
let base: Partial<Record<Clave, unknown>> = {}
/** Fecha de la última versión de cada colección que llegó de la nube (para descargar solo lo que cambió). */
let versiones: Partial<Record<Clave, string>> = {}

const nombreBase = (id: string) => `nexora-nube-base-${id}`
let relojBase: ReturnType<typeof setTimeout> | undefined
const guardarBase = (ya = false) => {
  clearTimeout(relojBase)
  const id = empresaId, copia = base
  const escribir = () => { if (id) idbSet(nombreBase(id), copia).catch(() => undefined) }
  if (ya) escribir(); else relojBase = setTimeout(escribir, 500)
}
const leerBase = async (id: string): Promise<Partial<Record<Clave, unknown>>> => { try { return (await idbGet(nombreBase(id))) ?? {} } catch { return {} } }

const local = () => useApp.getState() as unknown as Record<Clave, unknown>

/** Aplica datos que llegan de la nube sin volver a subirlos. */
function aplicar(parcial: Partial<Record<Clave, unknown>>) {
  remoto = true
  try { useApp.setState(parcial as never) } finally { remoto = false }
}

/** Combina lo que llegó de la nube con lo de este equipo (las colecciones con cambios por subir las combina subir()). */
function combinarDesdeNube(filas: { clave: string; valor: unknown; actualizado?: string }[]) {
  const cambios: Partial<Record<Clave, unknown>> = {}
  for (const f of filas) {
    const k = f.clave as Clave
    if (!CLAVES.includes(k)) continue
    if (esAnterior(f.actualizado, versiones[k])) continue // llegó tarde una versión vieja: ya se tiene una más nueva
    if (f.actualizado) versiones[k] = f.actualizado
    if (pendientes.has(k)) continue
    const aqui = local()[k] ?? vacios()[k]
    const unido = fusionar(base[k], aqui, f.valor)
    if (!igual(unido, aqui)) cambios[k] = unido
    base[k] = f.valor
    if (!igual(unido, f.valor)) pendientes.add(k) // este equipo tenía algo que la nube no: se sube
  }
  if (Object.keys(cambios).length) aplicar(cambios)
  guardarBase()
}

/** Sube una colección combinándola con lo que haya en la nube. Si otra persona guardó a la vez, vuelve a combinar. */
async function subirClave(k: Clave): Promise<boolean> {
  for (let intento = 0; intento < 5; intento++) {
    const { data: fila, error } = await supabase.from('datos').select('valor, actualizado').eq('empresa_id', empresaId!).eq('clave', k).maybeSingle()
    if (error) return false
    const aqui = local()[k] ?? vacios()[k]
    const unido = fila ? fusionar(base[k], aqui, fila.valor) : aqui
    if (!igual(unido, aqui)) aplicar({ [k]: unido }) // llegan los cambios de las otras personas
    if (fila && igual(unido, fila.valor)) { base[k] = unido; versiones[k] = fila.actualizado; return true }
    const ahora = new Date().toISOString()
    if (fila) {
      // Solo se guarda si nadie más guardó desde que se leyó (si no, se vuelve a combinar)
      const { data: hecho, error: e } = await supabase.from('datos').update({ valor: unido, actualizado: ahora, actualizado_por: miId }).eq('empresa_id', empresaId!).eq('clave', k).eq('actualizado', fila.actualizado).select('actualizado')
      if (e) return false
      if (hecho?.length) { base[k] = unido; versiones[k] = hecho[0].actualizado; return true }
    } else {
      const { data: hecho, error: e } = await supabase.from('datos').insert({ empresa_id: empresaId, clave: k, valor: unido, actualizado: ahora, actualizado_por: miId }).select('actualizado')
      if (!e) { base[k] = unido; versiones[k] = hecho?.[0]?.actualizado ?? ahora; return true }
      if (e.code !== '23505') return false // 23505: otra persona la creó a la vez → se vuelve a combinar
    }
  }
  return false
}

async function subir() {
  clearTimeout(reloj)
  if (!empresaId || !miId || !pendientes.size) return
  if (subiendo) { programar(); return }
  subiendo = true
  fijar('guardando')
  const claves = [...pendientes]
  pendientes.clear()
  const fallidas: Clave[] = []
  for (const k of claves) if (!(await subirClave(k).catch(() => false))) fallidas.push(k)
  subiendo = false
  guardarBase()
  if (fallidas.length) { fallidas.forEach((k) => pendientes.add(k)); fijar('sin-conexion'); reloj = setTimeout(subir, 5000); return }
  if (pendientes.size) programar()
  else fijar('al-dia')
}
const programar = () => { clearTimeout(reloj); reloj = setTimeout(subir, 800) }

/** Revisa qué cambió en la nube (solo descarga esas colecciones) y sube lo pendiente. */
export function sincronizarAhora() {
  clearTimeout(relojSinc)
  relojSinc = setTimeout(async () => {
    if (!empresaId) { if (reintento) reconectar(); return }
    try {
      const { data: marcas, error } = await supabase.from('datos').select('clave, actualizado').eq('empresa_id', empresaId)
      if (error) throw error
      const cambiadas = marcas.filter((m) => versiones[m.clave as Clave] !== m.actualizado).map((m) => m.clave)
      if (cambiadas.length) {
        const { data, error: e } = await supabase.from('datos').select('clave, valor, actualizado').eq('empresa_id', empresaId).in('clave', cambiadas)
        if (e) throw e
        combinarDesdeNube(data)
      }
      if (pendientes.size) subir()
      else if (!subiendo) fijar('al-dia')
    } catch { fijar('sin-conexion') }
  }, 400)
}

// ---------- Conexión ----------
let conexion: Promise<void> | null = null
let reintento: { a: Acceso; u: User } | null = null
let relojReintento: ReturnType<typeof setTimeout> | undefined
const reconectar = () => { if (reintento) conectarNube(reintento.a, reintento.u) }
const programarReintento = () => { clearTimeout(relojReintento); relojReintento = setTimeout(reconectar, 15000) }

const alCambiarVisibilidad = () => { if (document.visibilityState === 'hidden') { subir(); guardarBase(true) } else sincronizarAhora() }
const alVolverInternet = () => { if (empresaId) { subir(); sincronizarAhora() } else reconectar() }

export function conectarNube(a: Acceso, usuario: User): Promise<void> {
  if (empresaId === a.empresaId && miId === usuario.id) return Promise.resolve()
  if (conexion) return conexion
  conexion = conectar(a, usuario).finally(() => { conexion = null })
  return conexion
}

async function conectar(a: Acceso, usuario: User) {
  desconectarNube()
  fijar('conectando')
  window.addEventListener('online', alVolverInternet)
  const { data, error } = await supabase.from('datos').select('clave, valor, actualizado').eq('empresa_id', a.empresaId)
  if (error) { fijar('sin-conexion'); reintento = { a, u: usuario }; programarReintento(); return } // se reintenta solo
  reintento = null
  clearTimeout(relojReintento)
  empresaId = a.empresaId
  miId = usuario.id
  // ¿Este equipo ya trabajó con esta empresa? Si no, la nube manda (no se mezclan datos de otra empresa o de pruebas).
  const yaConocido = leerUltima() === a.empresaId
  base = yaConocido ? await leerBase(a.empresaId) : {}
  versiones = {}
  if (!yaConocido && (data.length || !a.esDueno)) aplicar(vacios())
  if (data.length) combinarDesdeNube(data)
  else if (a.esDueno) { // primera vez de la empresa: el titular sube lo que hay en este navegador
    const e = useApp.getState().empresa
    if (!e.nombre && a.empresa) aplicar({ empresa: { ...e, nombre: a.empresa } }) // el nombre que dio al comprar
    CLAVES.forEach((k) => pendientes.add(k))
  }
  guardarUltima(a.empresaId)

  quitarSub = useApp.subscribe((s, p) => {
    if (remoto) return
    let hay = false
    for (const k of CLAVES) if (s[k] !== p[k]) { pendientes.add(k); hay = true }
    if (hay) programar()
  })
  // Cambios de cualquier equipo de la empresa (también los de esta misma cuenta en otro celular o computadora)
  canal = supabase.channel(`datos:${a.empresaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'datos', filter: `empresa_id=eq.${a.empresaId}` }, () => sincronizarAhora())
    // Roles nuevos o personas quitadas: se actualizan al instante
    .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros', filter: `empresa_id=eq.${a.empresaId}` }, () => { refrescarEquipo() })
    .subscribe((st) => { if (st === 'SUBSCRIBED') sincronizarAhora() }) // al (re)conectarse, ponerse al día
  document.addEventListener('visibilitychange', alCambiarVisibilidad)
  intervalo = setInterval(() => { sincronizarAhora(); refrescarEquipo() }, 60000) // por si el celular cortó la conexión en vivo
  if (pendientes.size) await subir()
  else fijar('al-dia')
}

export function desconectarNube() {
  if (pendientes.size) subir() // último guardado antes de salir
  guardarBase(true)
  quitarSub?.(); quitarSub = null
  if (canal) supabase.removeChannel(canal)
  canal = null
  document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  window.removeEventListener('online', alVolverInternet)
  clearInterval(intervalo)
  clearTimeout(relojSinc)
  empresaId = null
  miId = null
  fijar('apagada')
}

/** Trae el equipo de la nube a la lista de usuarios. Si a quien está usando la app lo quitaron del equipo, sale. */
export async function refrescarEquipo() {
  const id = empresaId
  if (!id) return
  try {
    const personas = await equipoEmpresa(id)
    if (!personas.length) { // ya no tiene acceso a esta empresa (lo quitaron del equipo o venció el plan)
      const a = await miAcceso()
      if (!a || a.empresaId !== id || !a.vigente) await salir()
      return
    }
    useApp.getState().sincronizarEquipo(personas.map((p) => ({ email: p.email, nombre: p.nombre, esDueno: p.es_dueno, rol: comoRol(p.rol) ?? 'Vendedor', roles: (p.roles ?? []).map(comoRol).filter((x): x is Rol => !!x) })))
    const yo = useApp.getState().usuario
    if (yo && esCuenta(yo) && !personas.some((p) => yo.id === `cuenta:${p.email.toLowerCase()}`)) await salir()
  } catch { /* sin conexión: se mantiene la lista guardada */ }
}

/** Sale de la app en este dispositivo sin tocar la nube (la sesión de la cuenta ya no es válida). */
function cerrarLocal() {
  desconectarNube()
  useApp.setState({ licencia: null })
  useApp.getState().logout()
}

// Si la sesión de la cuenta se cierra o vence (p. ej., la contraseña cambió), la app no sigue abierta "a medias":
// sin sesión la nube ignora en silencio lo que se guarda o se borra.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((ev) => {
    const yo = useApp.getState().usuario
    if (ev === 'SIGNED_OUT' && yo && esCuenta(yo)) setTimeout(cerrarLocal, 0)
  })
}

/** Cierra la sesión de la app y de la cuenta NEXORA (guardando lo pendiente). */
export async function salir() {
  await subir()
  desconectarNube()
  // Solo en este dispositivo: cerrar aquí no debe cerrar la sesión del celular ni de la otra computadora
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  useApp.getState().logout()
}

export type Resultado = { estado: 'ok' } | { estado: 'sin-plan' | 'vencida'; acceso: Acceso | null }

/** Ingresa a NEXORA con una cuenta: verifica el plan del titular, descarga los datos y abre la app. */
export async function entrarConAcceso(u: User): Promise<Resultado> {
  const a = await miAcceso()
  if (!a) return { estado: 'sin-plan', acceso: null }
  if (!a.vigente || !a.plan) return { estado: 'vencida', acceso: a }
  await conectarNube(a, u)
  const rol = comoRol(a.rol) ?? 'Vendedor'
  useApp.getState().entrarConCuenta(
    { id: u.id, email: u.email ?? '', nombre: nombreDe(u), foto: fotoDe(u) },
    { plan: a.plan, vence: a.vence, empresaId: a.empresaId, esDueno: a.esDueno },
    a.esDueno ? undefined : { rol, roles: a.roles.map(comoRol).filter((x): x is Rol => !!x) },
  )
  await refrescarEquipo()
  return { estado: 'ok' }
}

/** Al abrir la app con una sesión guardada: revisa que el plan siga vigente y reconecta la nube. */
export async function reanudar() {
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  const yo = useApp.getState().usuario
  if (!yo) return
  if (!u) { if (esCuenta(yo)) cerrarLocal(); return } // la sesión de la cuenta ya no existe: se vuelve a pedir el ingreso
  try {
    const a = await miAcceso()
    if (!a?.vigente || !a.plan) { desconectarNube(); useApp.setState({ licencia: null }); useApp.getState().logout(); return }
    useApp.setState({ licencia: { plan: a.plan, vence: a.vence, empresaId: a.empresaId, esDueno: a.esDueno } })
    await conectarNube(a, u)
    await refrescarEquipo()
  } catch { // sin internet: se sigue con los datos de este navegador y se reintenta solo
    fijar('sin-conexion')
    clearTimeout(relojReintento)
    relojReintento = setTimeout(reanudar, 15000)
  }
}
