import { describe, expect, it } from 'vitest'
import * as F from '../lib/finance'
import { PLANTILLAS, crearParams, gastosAnuales } from '../lib/evaluaciones'

const datos = {
  etiquetas: PLANTILLAS.activo.etiquetas, inversion: [30000, 1000, 500] as [number, number, number],
  conceptos: [{ nombre: 'Mantenimiento', actual: 6000, nuevo: 1500 }, { nombre: 'Combustible', actual: 9000, nuevo: 6000 }],
  vmHoy: 8000, costoOriginal: 25000, edad: 7, vidaRestante: 4, rescate: 9000, n: 5, tmar: 0.12,
}

describe('evaluaciones de inversión de cada empresa', () => {
  it('arma un caso completo y coherente', () => {
    const p = crearParams(datos)
    expect(F.inversion(p)).toBe(31500)
    expect(F.ahorroAnual(p)).toBe(7500)
    expect(p.defensor.vm).toEqual([6000, 4000, 2000, 0])
    expect(p.retador.vm).toHaveLength(8)
    expect(p.defensor.coa[0]).toBeCloseTo(15000 * 1.08)
    const K = F.indicadores(p), R = F.reemplazo(p)
    expect(Number.isFinite(K.VPN) && Number.isFinite(K.TIR)).toBe(true)
    expect(['REEMPLAZAR AHORA', 'CONSERVAR']).toContain(R.veredicto)
    expect(F.etq(p).retador).toBe('Equipo nuevo')
  })
  it('los nombres del caso NEXORA quedan por defecto', () => {
    expect(F.etq(crearParams({ ...datos, etiquetas: PLANTILLAS.sistema.etiquetas })).inversion[0]).toBe('Licencia')
  })
  it('llena los costos de hoy con los gastos reales del último año', () => {
    const ahora = new Date('2026-11-13T12:00:00').getTime()
    const g = (fecha: string, categoria: string, monto: number) => ({ id: fecha + monto, fecha, concepto: 'x', categoria, monto, sucursal: '' })
    expect(gastosAnuales([g('2026-10-01', 'Mantenimiento', 300), g('2026-03-01', 'Mantenimiento', 200), g('2025-01-01', 'Mantenimiento', 999), g('2026-09-01', 'Transporte', 100)], ahora))
      .toEqual([{ nombre: 'Mantenimiento', actual: 500, nuevo: 500 }, { nombre: 'Transporte', actual: 100, nuevo: 100 }])
  })
})
