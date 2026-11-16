/**
 * Evaluaciones de inversión de cada empresa: a partir de pocos datos arma un caso completo para el análisis
 * de reemplazo (CAUE, VPN, TIR, depreciación, sensibilidad). Supuestos de partida, editables en Parámetros:
 * el defensor pierde su valor de forma lineal hasta 0 al final de su vida; el retador pierde 20 % de su valor
 * por año; los costos de operación suben 8 %/año (defensor, por desgaste) y 6 %/año (retador).
 */
import type { Concepto, Etiquetas, Params } from './finance'
import { PROYECTO } from '../data/proyecto'
import type { Gasto } from '../data/base'

export type Plantilla = 'nexora' | 'activo' | 'sistema' | 'blanco'
export const PLANTILLAS: Record<Plantilla, { titulo: string; ayuda: string; etiquetas: Etiquetas; conceptos: string[] }> = {
  nexora: { titulo: 'Comparar mi sistema con NEXORA', ayuda: 'Lo que le cuesta su sistema actual frente a NEXORA', etiquetas: { evaluacion: 'Cambiar mi sistema actual por NEXORA', defensor: 'Sistema actual', retador: 'NEXORA', inversion: ['Licencia', 'Implementación', 'Capacitación'] }, conceptos: ['Mantenimiento', 'Pérdidas por errores de inventario y devoluciones', 'Licencia y soporte', 'Horas extra', 'Caídas del sistema'] },
  activo: { titulo: 'Reemplazar un equipo o vehículo', ayuda: 'Camión, máquina, refrigeradora, computadoras…', etiquetas: { evaluacion: 'Reemplazar el camión de reparto', defensor: 'Equipo actual', retador: 'Equipo nuevo', inversion: ['Precio de compra', 'Instalación y traslado', 'Capacitación'] }, conceptos: ['Mantenimiento y reparaciones', 'Combustible o energía', 'Paradas y tiempo perdido'] },
  sistema: { titulo: 'Cambiar un sistema o software', ayuda: 'Programa de inventario, facturación, punto de venta…', etiquetas: { evaluacion: 'Cambiar el sistema de facturación', defensor: 'Sistema actual', retador: 'Sistema nuevo', inversion: ['Licencia', 'Implementación', 'Capacitación'] }, conceptos: ['Mantenimiento', 'Errores y pérdidas', 'Licencia y soporte', 'Horas extra'] },
  blanco: { titulo: 'Otra inversión', ayuda: 'Cualquier decisión de mantener o reemplazar', etiquetas: { evaluacion: 'Nueva evaluación', defensor: 'Lo que tengo hoy', retador: 'La alternativa', inversion: ['Precio', 'Instalación', 'Capacitación'] }, conceptos: ['Costos de operación'] },
}

export interface DatosEvaluacion {
  etiquetas: Etiquetas; inversion: [number, number, number]; conceptos: Concepto[]
  vmHoy: number; costoOriginal: number; edad: number; vidaRestante: number; rescate: number; n: number; tmar: number
}

const r2 = (v: number) => Math.round(v * 100) / 100
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Caso completo y coherente para el análisis, a partir de los datos de la empresa. */
export function crearParams(d: DatosEvaluacion): Params {
  const P = suma(d.inversion), k = Math.max(1, Math.min(8, Math.round(d.vidaRestante))), n = Math.max(1, Math.min(8, Math.round(d.n)))
  const totA = suma(d.conceptos.map((c) => c.actual)), totN = suma(d.conceptos.map((c) => c.nuevo))
  return {
    i: d.tmar, licencia: d.inversion[0], implementacion: d.inversion[1], capacitacion: d.inversion[2], S: d.rescate, n, impuesto: PROYECTO.impuesto,
    conceptos: d.conceptos.map((c) => ({ ...c })),
    defensor: { vm0: d.vmHoy, costoOriginal: d.costoOriginal, edad: d.edad, vidaRestante: k, vm: Array.from({ length: k }, (_, t) => r2(d.vmHoy * (1 - (t + 1) / k))), coa: Array.from({ length: k }, (_, t) => r2(totA * 1.08 ** (t + 1))) },
    retador: { vm: Array.from({ length: 8 }, (_, t) => r2(P * 0.8 ** (t + 1))), coa: Array.from({ length: 8 }, (_, t) => r2(totN * 1.06 ** t)) },
    depMetodo: 'SDD_LR', factorSD: 2, macrsClase: 5, unidades: [...PROYECTO.unidades], inflacion: PROYECTO.inflacion, horizonte: n,
    etiquetas: { ...d.etiquetas, inversion: [...d.etiquetas.inversion] as [string, string, string] },
  }
}

/** Gastos reales de los últimos 12 meses por categoría (para llenar los costos de "hoy"). */
export function gastosAnuales(gastos: Gasto[], ahora = Date.now()) {
  const desde = ahora - 365 * 864e5, por = new Map<string, number>()
  for (const g of gastos) if (new Date(`${g.fecha}T12:00:00`).getTime() >= desde) por.set(g.categoria, (por.get(g.categoria) ?? 0) + g.monto)
  return [...por].map(([nombre, v]) => ({ nombre, actual: r2(v), nuevo: r2(v) })).sort((a, b) => b.actual - a.actual)
}

/** Parámetros en cero (cuando la empresa aún no crea ninguna evaluación). */
export const PARAMS_VACIOS: Params = crearParams({ etiquetas: { ...PLANTILLAS.nexora.etiquetas }, inversion: [0, 0, 0], conceptos: [], vmHoy: 0, costoOriginal: 0, edad: 0, vidaRestante: 1, rescate: 0, n: 5, tmar: 0.12 })
