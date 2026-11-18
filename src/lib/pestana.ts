/**
 * NEXORA se usa en UNA pestaña a la vez por navegador.
 * Todas las pestañas comparten el mismo almacenamiento: una pestaña vieja abierta en segundo plano guardaba encima sus
 * datos desactualizados y, al recargar, lo recién agregado (un producto, un proveedor) parecía «eliminado» y se borraba.
 * La pestaña activa tiene el candado (Web Locks); las demás muestran un aviso con «Usar aquí» y no guardan nada.
 */
import { useSyncExternalStore } from 'react'

export type EstadoPestana = 'comprobando' | 'activa' | 'otra'
let estado: EstadoPestana = 'comprobando'
const oyentes = new Set<() => void>()
const fijar = (e: EstadoPestana) => { if (e !== estado) { estado = e; oyentes.forEach((f) => f()) } }
export const estadoPestana = () => estado
export const usePestana = () => useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, () => estado)

/** Id de esta pestaña (cambia en cada carga de la página). */
export const PESTANA = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`

const CANDADO = 'nexora-pestana', USAR_AQUI = 'nx-usar-aqui'

/**
 * Pide el candado al abrir la app. true: esta es la pestaña activa.
 * `alPerderla` se llama si otra pestaña pulsa «Usar aquí» (esta deja de sincronizar y de guardar).
 */
export function tomarPestana(alPerderla: () => void): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) { fijar('activa'); return Promise.resolve(true) } // navegador sin candados: funciona como antes
  let robar = false
  try { robar = sessionStorage.getItem(USAR_AQUI) === '1'; sessionStorage.removeItem(USAR_AQUI) } catch { /* sin almacenamiento */ }
  return new Promise((listo) => {
    locks.request(CANDADO, robar ? { steal: true } : { ifAvailable: true }, (candado) => {
      if (!candado) { fijar('otra'); listo(false); return }
      fijar('activa'); listo(true)
      return new Promise<void>(() => undefined) // se conserva mientras la pestaña esté abierta
    }).catch(() => { // otra pestaña pulsó «Usar aquí»
      const era = estado
      fijar('otra')
      if (era === 'activa') alPerderla()
      listo(false)
    })
  })
}

/** «Usar aquí»: esta pestaña pasa a ser la activa (la otra queda en pausa) y se recarga con los datos al día. */
export function usarAqui() {
  try { sessionStorage.setItem(USAR_AQUI, '1') } catch { /* sin almacenamiento */ }
  location.reload()
}
