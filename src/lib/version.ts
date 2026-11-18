/**
 * Aviso de versión nueva: cada equipo abierto revisa cada pocos minutos (y al volver a la app) si se publicó una
 * versión más nueva. Así todo el equipo trabaja con la misma versión sin tener que avisar a cada persona.
 */
import { useSyncExternalStore } from 'react'

let nueva = false
const oyentes = new Set<() => void>()
const actual = typeof __VERSION__ !== 'undefined' ? __VERSION__ : ''

async function revisar() {
  if (nueva || !actual || !import.meta.env.PROD) return
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const { version } = (await r.json()) as { version?: string }
    if (version && version !== actual) { nueva = true; oyentes.forEach((f) => f()) }
  } catch { /* sin internet: se revisa después */ }
}

let iniciado = false
function iniciar() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  setInterval(revisar, 5 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar() })
  window.addEventListener('online', revisar)
  setTimeout(revisar, 20 * 1000)
}

/** true cuando se publicó una versión más nueva que la que está abierta. */
export function useVersionNueva() {
  iniciar()
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f) } }, () => nueva)
}
