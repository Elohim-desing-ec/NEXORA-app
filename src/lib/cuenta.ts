/**
 * Cuentas de NEXORA (Supabase Auth): correo + contraseña, Google, Facebook y recuperación de contraseña.
 * Sin una licencia activa (tabla `licencias`) no se puede ingresar. El pago es simulado: no cobra dinero.
 */
import { useSyncExternalStore } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { soloDigitos } from './tarjeta'

// Clave publicable: está hecha para ir en el navegador; los datos se protegen con RLS en la base.
const URL_SUPABASE = 'https://loldipdbreouzvdciuic.supabase.co'
const CLAVE_PUBLICA = 'sb_publishable_fbBB3EOKcRj0s5P2pegH4Q_ozdAhCG2'

// PKCE: Supabase vuelve con ?code=… en la URL y no choca con las rutas por # de la app.
export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })

/** Planes que se pueden comprar en línea (NEXORA Global se cotiza). */
export const PLANES_COMPRABLES = ['Emprende', 'Emprende Plus', 'Emprende Propio', 'NEXORA Nube', 'NEXORA Pro'] as const
export type PlanComprable = (typeof PLANES_COMPRABLES)[number]
export const esComprable = (p: string): p is PlanComprable => (PLANES_COMPRABLES as readonly string[]).includes(p)

export interface Licencia { plan: string; precio: string; empresa: string; creada: string }

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

export async function licenciaActiva(): Promise<Licencia | null> {
  const { data, error } = await supabase.from('licencias').select('plan, precio, empresa, creada').eq('estado', 'activa').order('creada', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export async function registrarCompra(c: { plan: PlanComprable; precio: string; empresa: string; titular: string; tarjeta: string }): Promise<Licencia> {
  const { data, error } = await supabase.from('licencias')
    .insert({ plan: c.plan, precio: c.precio, empresa: c.empresa.trim(), titular: c.titular.trim(), tarjeta_ultimos: soloDigitos(c.tarjeta).slice(-4) })
    .select('plan, precio, empresa, creada').single()
  if (error) throw error
  return data
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

if (typeof window !== 'undefined') {
  const q = new URLSearchParams(location.search)
  const e = q.get('error_description') ?? q.get('error')
  if (e) {
    errorRetorno = e.replace(/\+/g, ' ')
    const d = tomarDestino()
    history.replaceState(history.state, '', urlRetorno() + (d ? rutaDe(d) : location.hash))
  }
  supabase.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') { tomarDestino(); recuperando = true; avisar() }
    else if (ev === 'SIGNED_IN') {
      const d = tomarDestino()
      if (d) { if (d === 'login') pedirContinuar(); location.hash = rutaDe(d) }
    }
  })
}
