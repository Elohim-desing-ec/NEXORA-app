/**
 * Datos de la empresa en la nube (tabla `datos` de Supabase): una fila por colección (productos, ventas, …).
 * - Al ingresar se descargan; si la empresa aún no tiene datos, el titular sube lo que hay en este navegador.
 * - Cada cambio local se sube a los ~0,8 s; los cambios de otras personas llegan en vivo (Realtime).
 * - Si dos personas editan la MISMA colección a la vez, gana el último cambio guardado.
 */
import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { useApp, ROLES, esCuenta, type Rol } from '../store/useApp'
import { EMPRESA_BASE } from '../data/base'
import { equipoEmpresa, fotoDe, miAcceso, nombreDe, supabase, type Acceso } from './cuenta'

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
let reloj: ReturnType<typeof setTimeout> | undefined
const pendientes = new Set<Clave>()

/** Aplica datos que llegan de la nube sin volver a subirlos. */
function aplicar(parcial: Partial<Record<Clave, unknown>>) {
  remoto = true
  try { useApp.setState(parcial as never) } finally { remoto = false }
}

async function subir() {
  clearTimeout(reloj)
  if (!empresaId || !miId || !pendientes.size) return
  const s = useApp.getState() as unknown as Record<Clave, unknown>
  const claves = [...pendientes]
  pendientes.clear()
  fijar('guardando')
  const ahora = new Date().toISOString()
  const { error } = await supabase.from('datos').upsert(claves.map((clave) => ({ empresa_id: empresaId, clave, valor: s[clave] ?? vacios()[clave], actualizado: ahora, actualizado_por: miId })))
  if (error) { claves.forEach((k) => pendientes.add(k)); fijar('sin-conexion'); reloj = setTimeout(subir, 5000); return }
  fijar(pendientes.size ? 'guardando' : 'al-dia')
  if (pendientes.size) programar()
}
const programar = () => { clearTimeout(reloj); reloj = setTimeout(subir, 800) }
const alOcultar = () => { if (document.visibilityState === 'hidden') subir() }

export async function conectarNube(a: Acceso, usuario: User) {
  if (empresaId === a.empresaId && miId === usuario.id) return
  desconectarNube()
  fijar('conectando')
  const { data, error } = await supabase.from('datos').select('clave, valor').eq('empresa_id', a.empresaId)
  if (error) { fijar('sin-conexion'); return } // sin datos de la nube no se sube nada: evita pisar información
  empresaId = a.empresaId
  miId = usuario.id
  const anterior = leerUltima()
  if (data.length) aplicar({ ...vacios(), ...Object.fromEntries(data.map((r) => [r.clave, r.valor])) })
  // Nube vacía: un invitado empieza en blanco (espera los datos del titular); el titular no hereda datos de otra empresa.
  else if (!a.esDueno || (anterior && anterior !== a.empresaId)) aplicar(vacios())
  if (!data.length && a.esDueno) { // primera vez: sube lo de este navegador
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
  canal = supabase.channel(`datos:${a.empresaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'datos', filter: `empresa_id=eq.${a.empresaId}` }, (ev) => {
      const r = ev.new as { clave?: Clave; valor?: unknown; actualizado_por?: string }
      if (!r?.clave || !CLAVES.includes(r.clave) || r.actualizado_por === miId || pendientes.has(r.clave)) return
      aplicar({ [r.clave]: r.valor })
    })
    // Roles nuevos o personas quitadas: se actualizan al instante
    .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros', filter: `empresa_id=eq.${a.empresaId}` }, () => { refrescarEquipo() })
    .subscribe()
  document.addEventListener('visibilitychange', alOcultar)
  if (pendientes.size) await subir()
  else fijar('al-dia')
}

export function desconectarNube() {
  if (pendientes.size) subir() // último guardado antes de salir
  quitarSub?.(); quitarSub = null
  if (canal) supabase.removeChannel(canal)
  canal = null
  document.removeEventListener('visibilitychange', alOcultar)
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
    if (!personas.length) return
    useApp.getState().sincronizarEquipo(personas.map((p) => ({ email: p.email, nombre: p.nombre, esDueno: p.es_dueno, rol: comoRol(p.rol) ?? 'Vendedor', roles: (p.roles ?? []).map(comoRol).filter((x): x is Rol => !!x) })))
    const yo = useApp.getState().usuario
    if (yo && esCuenta(yo) && !personas.some((p) => yo.id === `cuenta:${p.email.toLowerCase()}`)) await salir()
  } catch { /* sin conexión: se mantiene la lista guardada */ }
}

/** Cierra la sesión de la app y de la cuenta NEXORA (guardando lo pendiente). */
export async function salir() {
  await subir()
  desconectarNube()
  await supabase.auth.signOut().catch(() => undefined)
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
  if (!u || !useApp.getState().usuario) return
  try {
    const a = await miAcceso()
    if (!a?.vigente || !a.plan) { desconectarNube(); useApp.setState({ licencia: null }); useApp.getState().logout(); return }
    useApp.setState({ licencia: { plan: a.plan, vence: a.vence, empresaId: a.empresaId, esDueno: a.esDueno } })
    await conectarNube(a, u)
    await refrescarEquipo()
  } catch { fijar('sin-conexion') } // sin internet: se sigue con los datos de este navegador
}
