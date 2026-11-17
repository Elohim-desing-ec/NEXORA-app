import { describe, it, expect } from 'vitest'
import { asistente } from '../lib/asistente'
import { analizarNegocio } from '../lib/reporteInteligente'
import { saludNegocio } from '../lib/salud'
import { anios } from '../lib/resumen'
import { PROYECTO } from '../data/proyecto'
import { EMPRESA_BASE, type Gasto, type Venta } from '../data/base'

// Un negocio de servicios (sin inventario), como cuando le pagan por un trabajo
const hoy = new Date(), dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
const venta = (id: string, total: number, estado: Venta['estado'] = 'Pagada'): Venta => ({ id, fecha: hoy.toISOString(), sucursal: 'ELO', lineas: [{ productoId: '', concepto: 'Diseño', cantidad: 1, precio: total, costo: 0 }], descuento: 0, total, costoTotal: 0, cliente: 'Ana', canal: 'Local', estado, usuario: 'Yo' } as Venta)
const gasto: Gasto = { id: 'G1', fecha: dia, concepto: 'PAGO', categoria: 'Otros', monto: 23, sucursal: '' }
const ventas = [venta('V-1', 50), venta('V-2', 30, 'Por cobrar')]

describe('todo lo registrado llega a los indicadores', () => {
  it('el asistente responde con gastos, ganancia y cuentas por cobrar', () => {
    const ctx = { productos: [], movimientos: [], ordenes: [], proveedores: [], sucursales: [], empresa: EMPRESA_BASE, rol: 'Gerente General' as const, nombre: 'Yo', p: PROYECTO, ventas, gastos: [gasto] }
    expect(asistente('¿cuánto gasté este mes?', ctx).texto).toContain('PAGO')
    const g = asistente('¿cuánto gané este mes?', ctx).texto
    expect(g).toContain('80') // ventas 50 + 30
    expect(g).toContain('57') // 80 − 23 de gastos
    expect(asistente('¿quién me debe? por cobrar', ctx).texto).toContain('V-2')
  })
  it('el reporte inteligente incluye servicios y gastos, y avisa lo pendiente de cobro', () => {
    const a = analizarNegocio({ productos: [], movimientos: [], ordenes: [], sucursales: [], proveedores: [], empresa: 'Elohim', ventas, gastos: [gasto] })
    const k = Object.fromEntries(a.kpis)
    expect(k['Ventas 30 días']).toContain('80')
    expect(k['Gastos 30 días']).toContain('23')
    expect(k['Ganancia neta 30 días']).toContain('57')
    expect(a.hallazgos.some((h) => h.titulo.includes('por cobrar'))).toBe(true)
    expect(a.resumen).not.toMatch(/Aún no hay productos/)
  })
  it('la salud del negocio cuenta los servicios y el año de una venta aparece en el selector', () => {
    expect(saludNegocio([], [], Date.now(), 0.4, ventas).nivel).not.toBe('Sin datos')
    expect(anios([], [], [], [{ ...ventas[0], fecha: '2024-03-10T12:00:00.000Z' }])).toContain(2024)
  })
})
