/** Resumen del negocio: ventas, costo de lo vendido, gastos y ganancia por mes o por año. */
import type { Cierre, EstadoVenta, Gasto, Movimiento, Producto, SucursalId, Venta } from '../data/base'
import { enQuiebre, stockTotal } from './inventario'

/** Roles que registran ventas, gastos, productos y cierres en "Tu negocio" (el Auditor solo mira). */
export const EDITAN: string[] = ['Gerente General', 'Gerente Financiero', 'Contador', 'Analista Financiero', 'Gerente de Sucursal', 'Gerente de Ventas', 'Vendedor', 'Cajero', 'Asistente Administrativo']
/** Fecha de hoy como AAAA-MM-DD (hora local). */
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** Fecha y hora para guardar una venta del día elegido (hoy: la hora actual; otro día: mediodía). */
export const fechaVenta = (dia: string) => (dia === hoyISO() ? new Date().toISOString() : new Date(`${dia}T12:00:00`).toISOString())

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const CATEGORIAS_GASTO = ['Arriendo', 'Sueldos', 'Servicios básicos', 'Transporte', 'Publicidad', 'Mantenimiento', 'Impuestos', 'Otros']

/** Año y mes (0-11). "AAAA-MM-DD" se lee tal cual (sin desfase de zona horaria); una fecha ISO con hora, en hora local. */
export function periodoDe(f: string) {
  if (f.length === 10) return { anio: +f.slice(0, 4), mes: +f.slice(5, 7) - 1 }
  const d = new Date(f)
  return { anio: d.getFullYear(), mes: d.getMonth() }
}
/** ¿La fecha cae en el periodo? mes = -1 significa todo el año. */
export const enPeriodo = (f: string, anio: number, mes: number) => { const p = periodoDe(f); return p.anio === anio && (mes < 0 || p.mes === mes) }

export interface Agregado { ventas: number; costo: number; bruta: number; gastos: number; neta: number; margen: number; unidades: number }

/** Gastos del periodo; con una sucursal elegida solo cuentan los de esa sucursal (no los generales). */
export const gastosDe = (gastos: Gasto[], anio: number, mes: number, s: SucursalId | 'TODAS' = 'TODAS') =>
  gastos.filter((g) => (s === 'TODAS' || g.sucursal === s) && enPeriodo(g.fecha, anio, mes))

/** Ganancia bruta = ventas − costo de lo vendido; ganancia neta = bruta − gastos; margen neto = neta ÷ ventas. */
export function agregar(movs: Movimiento[], productos: Producto[], gastos: Gasto[], anio: number, mes: number, s: SucursalId | 'TODAS' = 'TODAS'): Agregado {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  let ventas = 0, costo = 0, unidades = 0
  for (const m of movs) {
    if (m.tipo !== 'Venta' || (s !== 'TODAS' && m.sucursal !== s) || !enPeriodo(m.fecha, anio, mes)) continue
    const q = -m.cantidad // las ventas se guardan en negativo (salen de la sucursal)
    ventas += q * (m.precioUnit ?? precio.get(m.productoId) ?? 0)
    costo += q * m.costoUnit
    unidades += q
  }
  const g = gastosDe(gastos, anio, mes, s).reduce((a, x) => a + x.monto, 0)
  const bruta = ventas - costo, neta = bruta - g
  return { ventas, costo, bruta, gastos: g, neta, margen: ventas ? neta / ventas : 0, unidades }
}

/** Variación relativa frente a otro periodo; null si el otro periodo no tiene datos. */
export const variacion = (actual: number, antes: number) => (antes ? (actual - antes) / Math.abs(antes) : null)

export const idCierre = (anio: number, mes: number) => (mes < 0 ? String(anio) : `${anio}-${String(mes + 1).padStart(2, '0')}`)
export const nombrePeriodo = (anio: number, mes: number) => (mes < 0 ? `Todo ${anio}` : `${MESES[mes]} ${anio}`)
/** ¿Cambiaron los números después de cerrar el periodo? */
export const cambioTrasCierre = (c: Cierre, a: Agregado) => Math.abs(c.neta - a.neta) >= 0.005 || c.unidades !== a.unidades

/** Años del selector: desde el dato más antiguo hasta el año actual. */
export function anios(movs: Movimiento[], gastos: Gasto[], cierres: Cierre[]) {
  const ys = [new Date().getFullYear(), ...movs.filter((m) => m.tipo === 'Venta').map((m) => periodoDe(m.fecha).anio), ...gastos.map((g) => periodoDe(g.fecha).anio), ...cierres.map((c) => c.anio)].filter((y) => y > 1900 && y < 3000)
  const lo = Math.min(...ys), hi = Math.max(...ys)
  return Array.from({ length: hi - lo + 1 }, (_, k) => hi - k)
}

export type EstadoStock = 'OK' | 'Stock bajo' | 'Agotado'
/** Agotado: sin unidades; stock bajo: en quiebre (menos de 1/3 del mínimo), igual que en el Dashboard. */
export const estadoStock = (p: Producto, s: SucursalId | 'TODAS' = 'TODAS'): EstadoStock => (stockTotal(p, s) <= 0 ? 'Agotado' : enQuiebre(p, s) ? 'Stock bajo' : 'OK')

/** Unidades vendidas, ingresos y ganancia generada por producto (todas las ventas registradas, menos anulaciones). */
export function statsProductos(movs: Movimiento[], productos: Producto[], s: SucursalId | 'TODAS' = 'TODAS') {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  const r = new Map<string, { vendidas: number; ingresos: number; ganancia: number }>()
  for (const m of movs) {
    if (m.tipo !== 'Venta' || (s !== 'TODAS' && m.sucursal !== s)) continue
    const q = -m.cantidad, pu = m.precioUnit ?? precio.get(m.productoId) ?? 0
    const x = r.get(m.productoId) ?? { vendidas: 0, ingresos: 0, ganancia: 0 }
    x.vendidas += q; x.ingresos += q * pu; x.ganancia += q * (pu - m.costoUnit)
    r.set(m.productoId, x)
  }
  return r
}

export interface FilaVenta { key: string; id: string; fecha: string; sucursal: SucursalId; cliente: string; canal: string; estado: EstadoVenta; detalle: string; codigos: string; unidades: number; total: number; ganancia: number; venta?: Venta }
/** Ventas de la pestaña Ventas y también las registradas una por una desde Inventario (canal "Inventario"). */
export function filasVentas(ventas: Venta[], movs: Movimiento[], productos: Producto[]): FilaVenta[] {
  const prod = new Map(productos.map((p) => [p.id, p]))
  const nombre = (id: string) => prod.get(id)?.nombre ?? 'Producto eliminado'
  const desdeVentas = ventas.map((v): FilaVenta => ({
    key: v.id, id: v.id, fecha: v.fecha, sucursal: v.sucursal, cliente: v.cliente, canal: v.canal, estado: v.estado,
    detalle: v.lineas.map((l) => `${nombre(l.productoId)} × ${l.cantidad}`).join(', '), codigos: v.lineas.map((l) => prod.get(l.productoId)?.sku ?? '').join(' '),
    unidades: v.lineas.reduce((a, l) => a + l.cantidad, 0), total: v.total, ganancia: v.total - v.costoTotal, venta: v,
  }))
  const sueltas = movs.filter((m) => m.tipo === 'Venta' && m.cantidad < 0 && !m.pedido).map((m): FilaVenta => {
    const q = -m.cantidad, pu = m.precioUnit ?? prod.get(m.productoId)?.precio ?? 0
    return { key: m.id, id: '—', fecha: m.fecha, sucursal: m.sucursal, cliente: '', canal: 'Inventario', estado: 'Pagada', detalle: `${nombre(m.productoId)} × ${q}`, codigos: prod.get(m.productoId)?.sku ?? '', unidades: q, total: q * pu, ganancia: q * (pu - m.costoUnit) }
  })
  return [...desdeVentas, ...sueltas].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
