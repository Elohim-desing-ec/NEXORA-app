import { describe, expect, it } from 'vitest'
import type { Gasto, Movimiento, Producto } from '../data/base'
import { agregar, idCierre, periodoDe, variacion } from '../lib/resumen'

const prod: Producto = { id: 'P1', sku: 'A-1', nombre: 'Camiseta', categoria: 'Ropa', costo: 7, precio: 20, stock: { GYE: 10 }, min: 2, max: 50, lote: '', vence: '2030-01-01', proveedorId: '' }
const venta = (fecha: string, cantidad: number, precioUnit?: number, sucursal = 'GYE'): Movimiento => ({ id: fecha + cantidad, fecha, productoId: 'P1', sucursal, tipo: 'Venta', cantidad: -cantidad, costoUnit: 7, precioUnit, usuario: 'x' })
const gasto = (fecha: string, monto: number, sucursal = ''): Gasto => ({ id: fecha + monto, fecha, concepto: 'Arriendo', categoria: 'Arriendo', monto, sucursal })

describe('resumen del negocio', () => {
  it('lee AAAA-MM-DD sin desfase de zona horaria', () => {
    expect(periodoDe('2026-11-01')).toEqual({ anio: 2026, mes: 10 })
  })

  it('calcula ventas, costo, gastos y ganancia del mes', () => {
    const movs = [venta('2026-11-05T15:00:00', 3, 18), venta('2026-11-20T15:00:00', 2), venta('2026-10-02T15:00:00', 5)]
    const a = agregar(movs, [prod], [gasto('2026-11-01', 30), gasto('2026-10-01', 99)], 2026, 10)
    expect(a.ventas).toBe(3 * 18 + 2 * 20) // precio de la venta, o el actual si falta
    expect(a.costo).toBe(5 * 7)
    expect(a.bruta).toBe(94 - 35)
    expect(a.gastos).toBe(30)
    expect(a.neta).toBe(59 - 30)
    expect(a.unidades).toBe(5)
    expect(a.margen).toBeCloseTo(29 / 94)
  })

  it('todo el año y filtro por sucursal', () => {
    const movs = [venta('2026-03-05T15:00:00', 1, 20, 'GYE'), venta('2026-07-05T15:00:00', 1, 20, 'UIO')]
    const gs = [gasto('2026-03-01', 10, 'GYE'), gasto('2026-03-01', 5)]
    expect(agregar(movs, [prod], gs, 2026, -1).ventas).toBe(40)
    expect(agregar(movs, [prod], gs, 2026, -1).gastos).toBe(15)
    const gye = agregar(movs, [prod], gs, 2026, -1, 'GYE')
    expect(gye.ventas).toBe(20)
    expect(gye.gastos).toBe(10) // los gastos generales solo cuentan en el consolidado
  })

  it('ids de cierre y variación', () => {
    expect(idCierre(2026, 0)).toBe('2026-01')
    expect(idCierre(2026, -1)).toBe('2026')
    expect(variacion(120, 100)).toBeCloseTo(0.2)
    expect(variacion(5, 0)).toBeNull()
  })
})

describe('ventas y estado del stock', () => {
  it('lista ventas con cliente y también las sueltas de Inventario', async () => {
    const { filasVentas, estadoStock, statsProductos } = await import('../lib/resumen')
    const v = { id: 'V-1001', fecha: '2026-11-05T15:00:00.000Z', sucursal: 'GYE', lineas: [{ productoId: 'P1', cantidad: 2, precio: 20, costo: 7 }], descuento: 4, total: 36, costoTotal: 14, cliente: 'Ana', canal: 'WhatsApp', estado: 'Pagada' as const, usuario: 'x' }
    const movs: Movimiento[] = [
      { ...venta('2026-11-05T15:00:00.000Z', 2, 18), pedido: 'V-1001' },
      venta('2026-11-06T15:00:00.000Z', 1, 20),
    ]
    const filas = filasVentas([v], movs, [prod])
    expect(filas.map((f) => f.canal)).toEqual(['Inventario', 'WhatsApp'])
    expect(filas[1].ganancia).toBe(22)
    expect(statsProductos(movs, [prod]).get('P1')).toEqual({ vendidas: 3, ingresos: 56, ganancia: 35 })
    expect(estadoStock(prod)).toBe('OK')
    expect(estadoStock({ ...prod, stock: { GYE: 0 } })).toBe('Agotado')
  })
})
