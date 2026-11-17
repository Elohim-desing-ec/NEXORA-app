/**
 * Cuentas de NEXORA (Supabase Auth): correo + contraseña, Google, Facebook y recuperación de contraseña.
 * Sin un plan vigente del titular (licencia o prueba de 14 días) no se puede ingresar. El pago es simulado: no cobra dinero.
 */
import { useSyncExternalStore } from 'react'
import { createClient, type User } from '@supabase/supabase-js'

// Clave publicable: está hecha para ir en el navegador; los datos se protegen con RLS en la base.
const URL_SUPABASE = 'https://loldipdbreouzvdciuic.supabase.co'
const CLAVE_PUBLICA = 'sb_publishable_fbBB3EOKcRj0s5P2pegH4Q_ozdAhCG2'

// PKCE: Supabase vuelve con ?code=… en la URL y no choca con las rutas por # de la app.
export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })

/** Planes que se pagan en línea con Payphone (emprendimientos y negocios en crecimiento). */
export const PLANES_COMPRABLES = ['Emprende', 'Emprende Plus', 'Crece'] as const
export type PlanComprable = (typeof PLANES_COMPRABLES)[number]
export const esComprable = (p: string): p is PlanComprable => (PLANES_COMPRABLES as readonly string[]).includes(p)

/** Correo de la empresa NEXORA (Elohim): contacto y remitente de los correos. */
export const CORREO_NEXORA = 'modacristiana2025@gmail.com'
export const DIAS_PRUEBA = 14

export interface Licencia { id?: string; plan: string; precio: string; empresa: string; creada: string; vence?: string | null }
/** Lo que puede hacer la cuenta: su empresa, su rol en ella y el plan del titular. */
export interface Acceso { empresaId: string; empresa: string; esDueno: boolean; rol: string; roles: string[]; plan: string | null; vence: string | null; vigente: boolean }
export interface Compra { id: string; plan: string; precio: string; empresa: string; titular: string; tarjeta_ultimos: string; estado: string; creada: string }
export interface Miembro { email: string; nombre: string; rol: string; roles: string[]; creado: string }

export const diasRestantes = (vence: string | null | undefined) => (vence ? Math.max(0, Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000)) : null)

/** Dirección a la que vuelven Google, Facebook y los correos (sin # ni parámetros). */
export const urlRetorno = () => location.origin + location.pathname

// A dónde llevar a la persona cuando vuelve de Google, Facebook o del enlace del correo.
const DESTINO = 'nexora-destino'
export type Destino = 'login' | `comprar:${string}`
export const guardarDestino = (d: Destino) => { try { localStorage.setItem(DESTINO, d) } catch { /* sin almacenamiento */ } }
export function tomarDestino(): Destino | null {
  try { const d = localStorage.getItem(DESTINO); localStorage.removeItem(DESTINO); return d as Destino | null } catch { return null }
}
/** Ruta (#…) que corresponde a un destino. */
export const rutaDe = (d: Destino) => (d === 'login' ? '#/login' : `#/comprar?plan=${encodeURIComponent(d.slice(8))}`)

/** ¿Está activado Google/Facebook en Supabase? (si no, Supabase mostraría una página de error). */
async function proveedorActivo(proveedor: 'google' | 'facebook') {
  try {
    const r = await fetch(`${URL_SUPABASE}/auth/v1/settings`, { headers: { apikey: CLAVE_PUBLICA } })
    return !!(await r.json())?.external?.[proveedor]
  } catch { return true } // sin respuesta: se intenta igual
}

export async function entrarCon(proveedor: 'google' | 'facebook', destino: Destino) {
  if (!(await proveedorActivo(proveedor))) return { error: new Error('provider is not enabled') }
  guardarDestino(destino)
  return supabase.auth.signInWithOAuth({ provider: proveedor, options: { redirectTo: urlRetorno() } })
}

export const enviarRecuperacion = (email: string) => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetorno() })

export async function miAcceso(): Promise<Acceso | null> {
  const { data, error } = await supabase.rpc('mi_acceso')
  if (error) throw error
  const r = data?.[0]
  return r ? { empresaId: r.empresa_id, empresa: r.empresa, esDueno: r.es_dueno, rol: r.rol, roles: r.roles ?? [], plan: r.plan, vence: r.vence, vigente: r.vigente } : null
}

export interface Pago { id: string; plan: string; periodo: 'mensual' | 'anual'; monto: number; empresa: string; tarjeta: string; autorizacion: string; desde: string; vence: string; confirmado: string }

async function payphone<T>(cuerpo: Record<string, unknown>): Promise<T & { ok: boolean; motivo?: string; mensaje?: string }> {
  const { data, error } = await supabase.functions.invoke('payphone', { body: cuerpo })
  if (error) {
    // Las respuestas con error (4xx/5xx) también traen el motivo en el cuerpo.
    const r = (error as { context?: Response }).context
    const d = r ? await r.json().catch(() => null) : null
    return d ?? { ok: false, motivo: 'red', mensaje: error.message }
  }
  return data
}

/** Prepara el cobro y devuelve la dirección del formulario de Payphone (la persona paga allá y vuelve a NEXORA). */
export async function prepararPago(plan: PlanComprable, periodo: 'mensual' | 'anual', empresa: string) {
  const r = await payphone<{ url?: string }>({ accion: 'preparar', plan, periodo, empresa })
  if (!r.ok || !r.url) throw new Error(r.motivo === 'pagos-no-configurados' ? 'pagos-no-configurados' : r.mensaje || r.motivo || 'No se pudo preparar el pago')
  return r.url
}

/** Al volver de Payphone: confirma el pago (Payphone da 5 minutos) y activa el plan. */
export async function confirmarPago(id: string, clientTxId: string): Promise<Pago> {
  const r = await payphone<{ pago?: Pago }>({ accion: 'confirmar', id, clientTxId })
  if (!r.ok || !r.pago) throw new Error(r.mensaje || 'El pago no fue aprobado')
  return r.pago
}

export async function historialPagos(): Promise<Pago[]> {
  const { data, error } = await supabase.from('pagos').select('id, plan, periodo, monto, empresa, tarjeta, autorizacion, desde, vence, confirmado').eq('estado', 'aprobado').order('confirmado', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function iniciarPrueba(empresa: string): Promise<Licencia> {
  const { data, error } = await supabase.rpc('iniciar_prueba', { p_empresa: empresa })
  if (error) throw error
  const r = data[0]
  return { plan: 'Prueba', precio: '$ 0', empresa: r.empresa, creada: r.inicio, vence: r.vence }
}

export async function pruebaUsada(): Promise<boolean> {
  const { data, error } = await supabase.rpc('prueba_usada')
  if (error) throw error
  return !!data
}

export async function cancelarPlan() { const { error } = await supabase.rpc('cancelar_plan'); if (error) throw error }

export async function historialCompras(): Promise<Compra[]> {
  const { data, error } = await supabase.from('licencias').select('id, plan, precio, empresa, titular, tarjeta_ultimos, estado, creada').order('creada', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ---------- Equipo ----------
/** Titular + invitados de la empresa (para mostrarlos en toda la app). */
export async function equipoEmpresa(empresaId: string): Promise<{ email: string; nombre: string; rol: string; roles: string[]; es_dueno: boolean }[]> {
  const { data, error } = await supabase.rpc('equipo_empresa', { p_empresa: empresaId })
  if (error) throw error
  return data ?? []
}
export async function listarMiembros(empresaId: string): Promise<Miembro[]> {
  const { data, error } = await supabase.from('miembros').select('email, nombre, rol, roles, creado').eq('empresa_id', empresaId).order('creado')
  if (error) throw error
  return data ?? []
}
/** Los cambios del equipo necesitan la sesión de la cuenta abierta (sin ella la nube los ignora en silencio). */
async function exigirSesion() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('sin-sesion')
}
export async function guardarMiembro(empresaId: string, m: { email: string; nombre: string; rol: string; roles?: string[] }) {
  await exigirSesion()
  const { data, error } = await supabase.from('miembros').upsert({ empresa_id: empresaId, email: m.email.trim().toLowerCase(), nombre: m.nombre.trim(), rol: m.rol, roles: m.roles ?? [] }).select('email')
  if (error) throw error
  if (!data?.length) throw new Error('solo-titular')
}
/** Quita a una persona del equipo y confirma que la nube de verdad la quitó. */
export async function quitarMiembro(empresaId: string, email: string) {
  await exigirSesion()
  const { data, error } = await supabase.from('miembros').delete().eq('empresa_id', empresaId).eq('email', email.trim().toLowerCase()).select('email')
  if (error) throw error
  if (!data?.length) throw new Error('solo-titular')
}

/** Correo desde el Gmail de NEXORA (función `correo` en Supabase). false si aún no está configurado. */
export async function enviarCorreo(pedido: { tipo: 'recibo' } | { tipo: 'invitacion'; email: string }): Promise<boolean> {
  try { const { data, error } = await supabase.functions.invoke('correo', { body: pedido }); return !error && !!data?.enviado } catch { return false }
}

/** Nombre visible de la cuenta (Google y Facebook lo envían en los metadatos). */
export const nombreDe = (u: User) => String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'Usuario')
export const fotoDe = (u: User) => (u.user_metadata?.avatar_url as string | undefined) ?? undefined

/** Traduce los errores de Supabase más comunes. */
export function mensajeError(e: unknown, tx: (es: string, en: string, pt: string) => string) {
  const m = String((e as { message?: string })?.message ?? e)
  if (/invalid login credentials/i.test(m)) return tx('Correo o contraseña incorrectos', 'Wrong email or password', 'E-mail ou senha incorretos')
  if (/email not confirmed/i.test(m)) return tx('Confirme su correo primero: revise su bandeja de entrada', 'Confirm your email first: check your inbox', 'Confirme seu e-mail primeiro: verifique sua caixa de entrada')
  if (/already registered|already been registered/i.test(m)) return tx('Ese correo ya tiene cuenta: inicie sesión', 'That email already has an account: sign in', 'Esse e-mail já tem conta: entre')
  if (/password should be at least|weak/i.test(m)) return tx('La contraseña debe tener al menos 8 caracteres', 'Password must be at least 8 characters', 'A senha deve ter pelo menos 8 caracteres')
  if (/email address .* is invalid|invalid email/i.test(m)) return tx('Ese correo no es válido', 'That email is not valid', 'Esse e-mail não é válido')
  if (/not authorized/i.test(m)) return tx('Por ahora no podemos enviar correos a esa dirección. Escríbanos para ayudarle.', 'We can\'t send email to that address yet. Contact us for help.', 'Ainda não podemos enviar e-mails para esse endereço. Fale conosco.')
  if (/ya usó su prueba/i.test(m)) return tx('Esta cuenta ya usó su prueba gratis. Elija un plan para continuar.', 'This account already used its free trial. Choose a plan to continue.', 'Esta conta já usou o teste grátis. Escolha um plano para continuar.')
  if (/ya tiene un plan activo/i.test(m)) return tx('Esta cuenta ya tiene un plan activo', 'This account already has an active plan', 'Esta conta já tem um plano ativo')
  if (m === 'sin-sesion' || /jwt expired|invalid jwt|not authenticated/i.test(m)) return tx('Su sesión se cerró. Salga y vuelva a ingresar con su cuenta para hacer este cambio.', 'Your session ended. Sign out and sign in again to make this change.', 'Sua sessão terminou. Saia e entre novamente para fazer esta alteração.')
  if (m === 'solo-titular' || /row-level security/i.test(m)) return tx('Solo el titular de la cuenta puede cambiar o quitar personas del equipo. Si usted es el titular, salga y vuelva a ingresar.', 'Only the account owner can change or remove team members. If you are the owner, sign out and sign in again.', 'Somente o titular da conta pode alterar ou remover pessoas da equipe. Se você é o titular, saia e entre novamente.')
  if (/duplicate key|already exists/i.test(m)) return tx('Esa persona ya está en su equipo', 'That person is already on your team', 'Essa pessoa já está na sua equipe')
  if (/pagos-no-configurados/.test(m)) return tx('Los pagos con Payphone se están activando. Pruebe NEXORA gratis mientras tanto o escríbanos.', 'Payphone payments are being set up. Try NEXORA free meanwhile or contact us.', 'Os pagamentos com Payphone estão sendo ativados. Teste o NEXORA grátis enquanto isso.')
  if (/rate limit|too many/i.test(m)) return tx('Demasiados intentos. Espere unos minutos.', 'Too many attempts. Wait a few minutes.', 'Muitas tentativas. Aguarde alguns minutos.')
  if (/provider is not enabled|unsupported provider/i.test(m)) return tx('Este método de ingreso aún no está activado', 'This sign-in method is not enabled yet', 'Este método de login ainda não está ativado')
  return m
}

// ---------- Regreso desde Google, Facebook o el enlace del correo ----------
// Se escucha desde que carga el módulo: Supabase avisa apenas termina de leer el ?code=… de la URL.
let recuperando = false
let errorRetorno = ''
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())
const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f) } }
/** true mientras la persona llegó desde el correo de "Olvidé mi contraseña" y debe crear una nueva. */
export const useRecuperando = () => useSyncExternalStore(suscribir, () => recuperando)
export const terminarRecuperacion = () => { recuperando = false; avisar() }
/** Error que devolvió Google/Facebook/Supabase al volver (se lee una sola vez). */
export const tomarErrorRetorno = () => { const e = errorRetorno; errorRetorno = ''; return e }

/** Al volver de Google/Facebook, la pantalla de ingreso continúa sola (sin pedir otro clic). */
const AUTO = 'nexora-auto'
export const pedirContinuar = () => { try { sessionStorage.setItem(AUTO, '1') } catch { /* sin almacenamiento */ } }
export const tomarContinuar = () => { try { const v = sessionStorage.getItem(AUTO) === '1'; sessionStorage.removeItem(AUTO); return v } catch { return false } }

const RETORNO_PAGO = 'nexora-pago'
/** Datos con los que Payphone devolvió a la persona (para confirmar el pago). */
export function retornoPago(): { id: string; clientTxId: string } | null {
  try { return JSON.parse(sessionStorage.getItem(RETORNO_PAGO) ?? 'null') } catch { return null }
}
export const olvidarRetornoPago = () => { try { sessionStorage.removeItem(RETORNO_PAGO) } catch { /* sin almacenamiento */ } }

if (typeof window !== 'undefined') {
  const q = new URLSearchParams(location.search)
  const e = q.get('error_description') ?? q.get('error')
  if (e) {
    errorRetorno = e.replace(/\+/g, ' ')
    const d = tomarDestino()
    history.replaceState(history.state, '', urlRetorno() + (d ? rutaDe(d) : location.hash))
  }
  // Regreso de Payphone: ?id=…&clientTransactionId=… → se guarda y se abre #/pago para confirmarlo.
  const idPago = q.get('id'), txPago = q.get('clientTransactionId')
  if (idPago && txPago) {
    try { sessionStorage.setItem(RETORNO_PAGO, JSON.stringify({ id: idPago, clientTxId: txPago })) } catch { /* sin almacenamiento */ }
    history.replaceState(history.state, '', urlRetorno() + '#/pago')
  }
  supabase.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') { tomarDestino(); recuperando = true; avisar() }
    else if (ev === 'SIGNED_IN') {
      const d = tomarDestino()
      if (d) { if (d === 'login') pedirContinuar(); location.hash = rutaDe(d) }
    }
  })
}
