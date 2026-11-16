import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Params } from '../lib/finance'
import { PARAMS_VACIOS } from '../lib/evaluaciones'

export interface Escenario { id: string; nombre: string; fecha: string; params: Params }
/** Evaluación de inversión de la empresa, con sus propios valores. El sistema arranca sin ninguna. */
export interface Evaluacion { id: string; params: Params; creada: string }

interface EconState {
  /** Parámetros de la evaluación abierta (todo el análisis lee de aquí) */
  p: Params
  tab: string
  escenarios: Escenario[]
  evaluaciones: Evaluacion[]
  /** Evaluación abierta ('' si todavía no hay ninguna) */
  activa: string
  set: (fn: (p: Params) => void) => void
  setTab: (t: string) => void
  guardar: (nombre: string) => void
  cargar: (id: string) => void
  eliminar: (id: string) => void
  nuevaEvaluacion: (p: Params) => void
  abrirEvaluacion: (id: string) => void
  duplicarEvaluacion: () => void
  eliminarEvaluacion: (id: string) => void
}

export const useEcon = create<EconState>()(persist((set, get) => {
  /** Cambia p y lo guarda también en la evaluación abierta. */
  const fijar = (p: Params) => set({ p, evaluaciones: get().evaluaciones.map((e) => (e.id === get().activa ? { ...e, params: p } : e)) })
  return {
    p: structuredClone(PARAMS_VACIOS),
    tab: 'comparacion',
    escenarios: [],
    evaluaciones: [],
    activa: '',
    set: (fn) => { if (!get().activa) return; const p = structuredClone(get().p); fn(p); fijar(p) },
    setTab: (tab) => set({ tab }),
    guardar: (nombre) => set({ escenarios: [...get().escenarios, { id: crypto.randomUUID(), nombre, fecha: new Date().toISOString(), params: structuredClone(get().p) }] }),
    cargar: (id) => { const e = get().escenarios.find((x) => x.id === id); if (e && get().activa) fijar(structuredClone(e.params)) },
    eliminar: (id) => set({ escenarios: get().escenarios.filter((e) => e.id !== id) }),
    nuevaEvaluacion: (p) => { const e = { id: crypto.randomUUID(), params: structuredClone(p), creada: new Date().toISOString() }; set({ evaluaciones: [...get().evaluaciones, e], activa: e.id, p: structuredClone(p), tab: 'comparacion' }) },
    abrirEvaluacion: (id) => { const e = get().evaluaciones.find((x) => x.id === id); if (e) set({ activa: id, p: structuredClone(e.params) }) },
    duplicarEvaluacion: () => {
      if (!get().activa) return
      const p = structuredClone(get().p); if (p.etiquetas) p.etiquetas = { ...p.etiquetas, evaluacion: `${p.etiquetas.evaluacion} (copia)` }
      get().nuevaEvaluacion(p)
    },
    eliminarEvaluacion: (id) => {
      const resto = get().evaluaciones.filter((e) => e.id !== id)
      set({ evaluaciones: resto })
      if (get().activa === id) { if (resto[0]) get().abrirEvaluacion(resto[0].id); else set({ activa: '', p: structuredClone(PARAMS_VACIOS), escenarios: [] }) }
    },
  }
}, {
  name: 'nexora-econ', version: 3,
  migrate: (old, v) => {
    const o = (old ?? {}) as Partial<EconState>
    // v3: sin datos de muestra. Se quita la evaluación "ejemplo" (caso del proyecto) y los escenarios guardados sobre ella.
    if (v < 3) {
      const evaluaciones = (o.evaluaciones ?? []).filter((e) => e.id !== 'ejemplo')
      const abierta = evaluaciones.find((e) => e.id === o.activa) ?? evaluaciones[0]
      return { ...o, evaluaciones, activa: abierta?.id ?? '', p: abierta ? abierta.params : structuredClone(PARAMS_VACIOS), escenarios: abierta ? o.escenarios ?? [] : [] } as EconState
    }
    return o as EconState
  },
}))
