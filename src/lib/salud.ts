/**
 * Salud del negocio: puntaje de 0 a 100 con 5 factores medibles y nivel de rendimiento (bajo, medio o alto).
 * Sirve igual para un emprendimiento que para una multinacional; las metas son referencias generales.
 */
import type { Movimiento, Producto } from '../data/base'
import { enQuiebre, stockTotal } from './inventario'
import { num, pct } from './format'

export type NivelSalud = 'Bajo' | 'Medio' | 'Alto' | 'Sin datos'
export interface Factor { nombre: string; valor: string; puntos: number; max: number; meta: string; consejo: string }

const lim = (x: number) => Math.max(0, Math.min(1, x))

/** margenMeta: margen bruto de referencia del sector (40 % si no se indica). */
export function saludNegocio(movs: Movimiento[], productos: Producto[], ahora = Date.now(), margenMeta = 0.4) {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  let v90 = 0, c90 = 0, vAntes = 0, cmv30 = 0, movidas = 0, corregidas = 0
  for (const m of movs) {
    movidas += Math.abs(m.cantidad)
    if (m.tipo === 'Ajuste' || m.tipo === 'Merma') corregidas += Math.abs(m.cantidad)
    if (m.tipo !== 'Venta') continue
    const dias = (ahora - new Date(m.fecha).getTime()) / 864e5, q = -m.cantidad, v = q * (m.precioUnit ?? precio.get(m.productoId) ?? 0)
    if (dias <= 90) { v90 += v; c90 += q * m.costoUnit } else if (dias <= 180) vAntes += v
    if (dias <= 30) cmv30 += q * m.costoUnit
  }
  const valor = productos.reduce((a, p) => a + stockTotal(p) * p.costo, 0)
  const margen = v90 ? (v90 - c90) / v90 : 0
  const crec = vAntes ? (v90 - vAntes) / vAntes : null
  const rot = valor ? (cmv30 * 12) / valor : 0
  const disponibles = productos.length ? 1 - productos.filter((p) => enQuiebre(p)).length / productos.length : 1
  const exactitud = movidas ? 1 - corregidas / movidas : 1
  const factores: Factor[] = [
    { nombre: 'Margen bruto', valor: pct(margen, 1), puntos: 35 * lim(margen / margenMeta), max: 35, meta: `${pct(margenMeta, 0)} o más`, consejo: 'Revise sus precios con la calculadora de margen y negocie mejores costos con sus proveedores.' },
    { nombre: 'Crecimiento de ventas', valor: crec === null ? 'sin historial' : `${crec >= 0 ? '+' : ''}${pct(crec, 1)}`, puntos: crec === null ? 10 : 20 * lim((crec + 0.2) / 0.3), max: 20, meta: '+10 % cada trimestre', consejo: 'Venda por más canales (WhatsApp, Instagram, tienda web) y premie a los clientes que vuelven.' },
    { nombre: 'Rotación del inventario', valor: `${num(rot, 1)}×`, puntos: 15 * lim(rot / 6), max: 15, meta: '6 veces al año', consejo: 'Liquide lo que no se mueve con promociones y compre en lotes más pequeños.' },
    { nombre: 'Productos disponibles', valor: pct(disponibles, 0), puntos: 15 * disponibles, max: 15, meta: '100 % sin quiebre', consejo: 'Reponga los productos en quiebre con las sugerencias de compra de IA NEXORA.' },
    { nombre: 'Exactitud del inventario', valor: pct(exactitud, 1), puntos: 15 * lim((exactitud - 0.9) / 0.08), max: 15, meta: '98 % o más', consejo: 'Haga conteos físicos cada mes y registre las mermas el mismo día.' },
  ]
  const puntaje = Math.round(factores.reduce((a, f) => a + f.puntos, 0))
  const nivel: NivelSalud = !v90 ? 'Sin datos' : puntaje >= 70 ? 'Alto' : puntaje >= 45 ? 'Medio' : 'Bajo'
  // Lo que más conviene mejorar: los factores por debajo del 90 % de su máximo, del más débil al más fuerte
  const mejorar = factores.filter((f) => f.puntos / f.max < 0.9).sort((a, b) => a.puntos / a.max - b.puntos / b.max).slice(0, 3)
  return { puntaje, nivel, factores, mejorar, margen, crec, rot }
}
