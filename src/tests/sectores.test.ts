import { describe, expect, it } from 'vitest'
import type { Movimiento, Producto } from '../data/base'
import { SECTORES } from '../data/base'
import { PERFILES, indicadoresSector, perfilDe } from '../lib/sectores'
import { saludNegocio } from '../lib/salud'

const ahora = new Date('2026-11-13T12:00:00Z').getTime()
const prod: Producto = { id: 'P1', sku: 'A', nombre: 'Paracetamol', categoria: 'Medicamentos', costo: 1, precio: 2, stock: { F1: 10 }, min: 3, max: 50, lote: 'L', vence: '2026-12-01', proveedorId: '' }
const mov = (tipo: Movimiento['tipo'], q: number): Movimiento => ({ id: tipo + q, fecha: new Date(ahora - 5 * 864e5).toISOString(), productoId: 'P1', sucursal: 'F1', tipo, cantidad: q, costoUnit: 1, precioUnit: 2, usuario: 'x' })

describe('perfiles por sector', () => {
  it('cada sector de la lista tiene un perfil', () => {
    for (const s of SECTORES) expect(PERFILES.some((p) => p.sectores.includes(s))).toBe(true)
  })
  it('salud y arquitectura usan su propio perfil; sin sector, el general', () => {
    expect(perfilDe('Farmacéutico').id).toBe('salud')
    expect(perfilDe('Arquitectura e ingeniería').id).toBe('construccion')
    expect(perfilDe('').id).toBe('comercio')
  })
  it('una farmacia ve lo que vence pronto y la merma', () => {
    const ind = indicadoresSector(perfilDe('Salud'), { productos: [prod], movimientos: [mov('Venta', -20), mov('Merma', -1)], ventas: [], sucursales: [{ id: 'F1', nombre: 'Farmacia centro' }] }, ahora)
    expect(ind[0]).toMatchObject({ titulo: 'Por vencer (60 días)', valor: '1 producto', tono: 'ambar' })
    expect(ind.find((i) => i.titulo === 'Merma del mes')?.tono).toBe('rojo') // 1 de 20 = 5 %
  })
  it('la meta de margen cambia con el sector', () => {
    const movs = [mov('Venta', -10)] // margen 50 %
    expect(saludNegocio(movs, [prod], ahora, 0.6).factores[0].puntos).toBeLessThan(35)
    expect(saludNegocio(movs, [prod], ahora, 0.3).factores[0].puntos).toBe(35)
  })
})
