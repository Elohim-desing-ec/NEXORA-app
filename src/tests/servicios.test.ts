import { beforeEach, describe, expect, it } from 'vitest'
import { useApp } from '../store/useApp'
import { agregar, serviciosDe } from '../lib/resumen'
import type { Producto } from '../data/base'

const prod: Producto = { id: 'P1', sku: 'CAF-1', nombre: 'Café', categoria: 'Bebidas', costo: 5, precio: 10, stock: { GYE: 10 }, min: 1, max: 50, lote: '', vence: '', proveedorId: '' } as Producto

describe('ventas de servicios y otros ingresos', () => {
  beforeEach(() => useApp.setState({ productos: [prod], movimientos: [], ventas: [], gastos: [], auditoria: [], usuario: null }))

  it('una venta mixta descuenta solo el producto y suma el servicio en la contabilidad', () => {
    const fecha = '2026-11-10T15:00:00.000Z'
    const e = useApp.getState().registrarVenta({ fecha, sucursal: 'GYE', descuento: 10, cliente: 'Cliente', canal: 'Local', estado: 'Pagada', lineas: [
      { productoId: 'P1', cantidad: 2, precio: 10 },
      { productoId: '', concepto: 'Instalación', cantidad: 1, precio: 80, costo: 15 },
    ] })
    expect(e).toBeNull()
    const s = useApp.getState()
    expect(s.productos[0].stock.GYE).toBe(8) // solo el café sale del inventario
    expect(s.movimientos).toHaveLength(1)
    expect(s.ventas[0].total).toBe(90) // 100 − 10 de descuento
    expect(s.ventas[0].costoTotal).toBe(25) // 2 × 5 + 15
    // El descuento se reparte: el servicio aporta 80 × 0,9 = 72
    expect(serviciosDe(s.ventas)[0]).toMatchObject({ monto: 72, costo: 15, concepto: 'Instalación' })
    const a = agregar(s.movimientos, s.productos, [], 2026, 10, 'TODAS', s.ventas)
    expect(a.ventas).toBeCloseTo(90)
    expect(a.costo).toBeCloseTo(25)
    expect(a.servicios).toBeCloseTo(72)
    expect(a.unidades).toBe(2) // los servicios no son unidades de inventario
  })

  it('solo servicios: no pide stock, y al anular deja de contar', () => {
    const fecha = '2026-11-12T15:00:00.000Z'
    expect(useApp.getState().registrarVenta({ fecha, sucursal: 'GYE', descuento: 0, cliente: '', canal: 'Local', estado: 'Pagada', lineas: [{ productoId: '', concepto: 'Asesoría', cantidad: 2, precio: 50 }] })).toBeNull()
    let s = useApp.getState()
    expect(s.productos[0].stock.GYE).toBe(10)
    expect(agregar(s.movimientos, s.productos, [], 2026, 10, 'TODAS', s.ventas).ventas).toBe(100)
    expect(useApp.getState().anularVenta(s.ventas[0].id)).toBeNull()
    s = useApp.getState()
    expect(s.productos[0].stock.GYE).toBe(10)
    expect(agregar(s.movimientos, s.productos, [], 2026, 10, 'TODAS', s.ventas).ventas).toBe(0)
  })

  it('una línea de servicio sin concepto no se registra', () => {
    expect(useApp.getState().registrarVenta({ fecha: '2026-11-12T15:00:00.000Z', sucursal: 'GYE', descuento: 0, cliente: '', canal: 'Local', estado: 'Pagada', lineas: [{ productoId: '', concepto: '  ', cantidad: 1, precio: 50 }] })).toMatch(/Agregue al menos/)
  })
})
