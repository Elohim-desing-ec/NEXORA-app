/** Resumen del negocio: ventas, costo de lo vendido, gastos y ganancia por mes o por año. */
import type { Cierre, EstadoVenta, Gasto, Movimiento, Producto, SucursalId, Venta } from '../data/base'
import { create } from 'zustand'
import { enQuiebre, stockTotal } from './inventario'

/** Roles que registran ventas, gastos, productos y cierres en "Tu negocio" (el Auditor solo mira). */
export const EDITAN: string[] = ['Mano derecha', 'Encargado de Ventas', 'Encargado de Gastos', 'Gerente General', 'Gerente Financiero', 'Contador', 'Analista Financiero', 'Gerente de Sucursal', 'Gerente de Ventas', 'Vendedor', 'Cajero', 'Asistente Administrativo']
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

export interface Agregado { ventas: number; costo: number; bruta: number; gastos: number; neta: number; margen: number; unidades: number; /** Parte de las ventas que viene de servicios u otros ingresos */ servicios: number }

/** Gastos del periodo; con una sucursal elegida solo cuentan los de esa sucursal (no los generales). */
export const gastosDe = (gastos: Gasto[], anio: number, mes: number, s: SucursalId | 'TODAS' = 'TODAS') =>
  gastos.filter((g) => (s === 'TODAS' || g.sucursal === s) && enPeriodo(g.fecha, anio, mes))

/** Servicios y otros ingresos sin inventario: una entrada por línea, con el descuento de la venta repartido. */
export function serviciosDe(ventas: Venta[]) {
  const r: { fecha: string; sucursal: SucursalId; monto: number; costo: number; concepto: string; cantidad: number }[] = []
  for (const v of ventas) {
    if (v.estado === 'Anulada') continue
    const bruto = v.total + v.descuento, f = bruto ? v.total / bruto : 1
    for (const l of v.lineas) if (!l.productoId) r.push({ fecha: v.fecha, sucursal: v.sucursal, monto: l.cantidad * l.precio * f, costo: l.cantidad * (l.costo || 0), concepto: l.concepto || 'Servicio', cantidad: l.cantidad })
  }
  return r
}

/** Ganancia bruta = ventas − costo de lo vendido; ganancia neta = bruta − gastos; margen neto = neta ÷ ventas. */
export function agregar(movs: Movimiento[], productos: Producto[], gastos: Gasto[], anio: number, mes: number, s: SucursalId | 'TODAS' = 'TODAS', listaVentas: Venta[] = []): Agregado {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  let ventas = 0, costo = 0, unidades = 0
  for (const m of movs) {
    if (m.tipo !== 'Venta' || (s !== 'TODAS' && m.sucursal !== s) || !enPeriodo(m.fecha, anio, mes)) continue
    const q = -m.cantidad // las ventas se guardan en negativo (salen de la sucursal)
    ventas += q * (m.precioUnit ?? precio.get(m.productoId) ?? 0)
    costo += q * m.costoUnit
    unidades += q
  }
  // Servicios y otros ingresos (no pasan por el inventario)
  let servicios = 0
  for (const x of serviciosDe(listaVentas)) {
    if ((s !== 'TODAS' && x.sucursal !== s) || !enPeriodo(x.fecha, anio, mes)) continue
    ventas += x.monto; costo += x.costo; servicios += x.monto
  }
  const g = gastosDe(gastos, anio, mes, s).reduce((a, x) => a + x.monto, 0)
  const bruta = ventas - costo, neta = bruta - g
  return { ventas, costo, bruta, gastos: g, neta, margen: ventas ? neta / ventas : 0, unidades, servicios }
}

/** Variación relativa frente a otro periodo; null si el otro periodo no tiene datos. */
export const variacion = (actual: number, antes: number) => (antes ? (actual - antes) / Math.abs(antes) : null)

export const idCierre = (anio: number, mes: number) => (mes < 0 ? String(anio) : `${anio}-${String(mes + 1).padStart(2, '0')}`)
export const nombrePeriodo = (anio: number, mes: number) => (mes < 0 ? `Todo ${anio}` : `${MESES[mes]} ${anio}`)
/** ¿Cambiaron los números después de cerrar el periodo? */
export const cambioTrasCierre = (c: Cierre, a: Agregado) => Math.abs(c.neta - a.neta) >= 0.005 || c.unidades !== a.unidades

/** Años del selector: desde el dato más antiguo hasta el año actual. */
/** Años que se pueden elegir: desde el primero con datos hasta 10 años después del actual (para los años que vienen). */
export const ANIOS_ADELANTE = 10
export function anios(movs: Movimiento[], gastos: Gasto[], cierres: Cierre[], ventas: Venta[] = []) {
  const ys = [new Date().getFullYear(), new Date().getFullYear() + ANIOS_ADELANTE, ...movs.filter((m) => m.tipo === 'Venta').map((m) => periodoDe(m.fecha).anio), ...ventas.map((v) => periodoDe(v.fecha).anio), ...gastos.map((g) => periodoDe(g.fecha).anio), ...cierres.map((c) => c.anio)].filter((y) => y > 1900 && y < 3000)
  const lo = Math.min(...ys), hi = Math.max(...ys)
  return Array.from({ length: hi - lo + 1 }, (_, k) => hi - k)
}

/** Año y mes elegidos. Los comparten Resumen e Inventario: cambiar el periodo en uno lo cambia en el otro. mes = -1: todo el año. */
export const usePeriodo = create<{ anio: number; mes: number; setAnio: (anio: number) => void; setMes: (mes: number) => void }>((set) => ({
  anio: new Date().getFullYear(), mes: new Date().getMonth(),
  setAnio: (anio) => set({ anio }), setMes: (mes) => set({ mes }),
}))

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
    detalle: v.lineas.map((l) => `${l.productoId ? nombre(l.productoId) : `${l.concepto || 'Servicio'} (servicio)`} × ${l.cantidad}`).join(', '), codigos: v.lineas.filter((l) => l.productoId).map((l) => prod.get(l.productoId)?.sku ?? '').join(' '),
    unidades: v.lineas.filter((l) => l.productoId).reduce((a, l) => a + l.cantidad, 0), total: v.total, ganancia: v.total - v.costoTotal, venta: v,
  }))
  const sueltas = movs.filter((m) => m.tipo === 'Venta' && m.cantidad < 0 && !m.pedido).map((m): FilaVenta => {
    const q = -m.cantidad, pu = m.precioUnit ?? prod.get(m.productoId)?.precio ?? 0
    return { key: m.id, id: '—', fecha: m.fecha, sucursal: m.sucursal, cliente: '', canal: 'Inventario', estado: 'Pagada', detalle: `${nombre(m.productoId)} × ${q}`, codigos: prod.get(m.productoId)?.sku ?? '', unidades: q, total: q * pu, ganancia: q * (pu - m.costoUnit) }
  })
  return [...desdeVentas, ...sueltas].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
