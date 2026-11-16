import { describe, expect, it } from 'vitest'
import type { Movimiento, Producto } from '../data/base'
import { saludNegocio } from '../lib/salud'

const ahora = new Date('2026-11-13T12:00:00Z').getTime()
const hace = (dias: number) => new Date(ahora - dias * 864e5).toISOString()
const prod: Producto = { id: 'P1', sku: 'A', nombre: 'A', categoria: 'X', costo: 6, precio: 10, stock: { S: 100 }, min: 10, max: 200, lote: '', vence: '2030-01-01', proveedorId: '' }
const venta = (dias: number, q: number, precio = 10): Movimiento => ({ id: `${dias}-${q}`, fecha: hace(dias), productoId: 'P1', sucursal: 'S', tipo: 'Venta', cantidad: -q, costoUnit: 6, precioUnit: precio, usuario: 'x' })

describe('salud del negocio', () => {
  it('sin ventas no da un nivel', () => {
    expect(saludNegocio([], [prod], ahora).nivel).toBe('Sin datos')
  })
  it('margen del 40 % y ventas en alza dan rendimiento alto', () => {
    const s = saludNegocio([venta(10, 50), venta(40, 50), venta(120, 60)], [prod], ahora)
    expect(s.margen).toBeCloseTo(0.4)
    expect(s.crec).toBeCloseTo((1000 - 600) / 600)
    expect(s.factores[0].puntos).toBeCloseTo(35)
    expect(s.nivel).toBe('Alto')
  })
  it('vender casi al costo da rendimiento bajo y lo sugiere primero', () => {
    const s = saludNegocio([venta(10, 5, 6.3), venta(120, 50, 6.3)], [{ ...prod, stock: { S: 1000 } }], ahora)
    expect(s.nivel).toBe('Bajo')
    expect(s.mejorar.map((f) => f.nombre)).toContain('Margen bruto')
  })
})

describe('cómo mejorar', () => {
  it('no sugiere lo que ya está en su meta', () => {
    const s = saludNegocio([venta(10, 50), venta(40, 50), venta(120, 60)], [prod], ahora)
    expect(s.mejorar.map((f) => f.nombre)).not.toContain('Margen bruto')
  })
})
