import type { Movimiento, Producto, SucursalId } from '../data/base'
import { tiposDe } from '../data/categorias'

/** Unidades de un producto en una sucursal (0 si no la maneja). */
export const st = (p: Producto, s: SucursalId) => p.stock[s] ?? 0
export const stockTotal = (p: Producto, s: SucursalId | 'TODAS' = 'TODAS') => (s === 'TODAS' ? Object.values(p.stock).reduce((a, b) => a + (b || 0), 0) : st(p, s))
/** Quiebre: stock por debajo de 1/3 del mínimo (en la sucursal elegida o en cualquiera que maneje el producto). */
export const enQuiebre = (p: Producto, s: SucursalId | 'TODAS' = 'TODAS') => (s === 'TODAS' ? Object.values(p.stock).some((v) => v < p.min / 3) : st(p, s) < p.min / 3)
/** Valor del inventario a costo promedio, total o por sucursal. */
export const valorInventario = (ps: Producto[], s: SucursalId | 'TODAS' = 'TODAS') => ps.reduce((a, p) => a + stockTotal(p, s) * p.costo, 0)

export interface FilaKardex { fecha: string; tipo: string; sucursal: string; entrada: number; salida: number; costoUnit: number; saldo: number; cpp: number; valor: number; usuario: string }

/** Kardex por método de promedio ponderado: el costo promedio se recalcula en cada entrada. */
export function kardex(productoId: string, movs: Movimiento[], s: SucursalId | 'TODAS' = 'TODAS'): FilaKardex[] {
  let saldo = 0, cpp = 0
  const filas: FilaKardex[] = []
  for (const m of movs) {
    if (m.productoId !== productoId || (s !== 'TODAS' && m.sucursal !== s)) continue
    if (s === 'TODAS' && m.tipo === 'Transferencia') continue // neutra en el consolidado
    if (m.cantidad > 0) { cpp = (saldo * cpp + m.cantidad * m.costoUnit) / (saldo + m.cantidad); saldo += m.cantidad }
    else saldo += m.cantidad
    filas.push({ fecha: m.fecha, tipo: m.tipo, sucursal: m.sucursal, entrada: Math.max(0, m.cantidad), salida: Math.max(0, -m.cantidad), costoUnit: m.cantidad > 0 ? m.costoUnit : cpp, saldo, cpp, valor: saldo * cpp, usuario: m.usuario })
  }
  return filas
}

/** Ventas por semana (últimas 26) de un producto o de todos. */
export function ventasSemanales(movs: Movimiento[], productoId?: string, s: SucursalId | 'TODAS' = 'TODAS', semanas = 26) {
  const fin = Date.now(), ms = 7 * 86400000
  const serie = Array(semanas).fill(0) as number[]
  for (const m of movs) {
    if (m.tipo !== 'Venta' || (productoId && m.productoId !== productoId) || (s !== 'TODAS' && m.sucursal !== s)) continue
    const k = semanas - 1 - Math.floor((fin - new Date(m.fecha).getTime()) / ms)
    if (k >= 0 && k < semanas) serie[k] += -m.cantidad
  }
  return serie
}

/** Ventas valorizadas por mes (últimos 6) para las sucursales indicadas. */
export function ventasMensuales(movs: Movimiento[], productos: Producto[], sucursales: SucursalId[]) {
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  const meses = new Map<string, Record<string, number>>()
  for (const m of movs) {
    if (m.tipo !== 'Venta') continue
    const k = m.fecha.slice(0, 7)
    const r = meses.get(k) ?? Object.fromEntries(sucursales.map((s) => [s, 0]))
    if (m.sucursal in r) r[m.sucursal] += -m.cantidad * (precio.get(m.productoId) ?? 0)
    meses.set(k, r)
  }
  return [...meses.entries()].sort().slice(-6).map(([mes, r]) => ({ mes: new Date(mes + '-15').toLocaleDateString('es-EC', { month: 'short' }), ...r }) as { mes: string } & Record<string, number>)
}

/** Ventas de los últimos n días por sucursal (unidades valorizadas a precio). */
export function ventasRecientes(movs: Movimiento[], productos: Producto[], dias = 30) {
  const desde = Date.now() - dias * 864e5, precio = new Map(productos.map((p) => [p.id, p.precio]))
  const r: Record<string, number> = {}
  for (const m of movs) if (m.tipo === 'Venta' && new Date(m.fecha).getTime() > desde) r[m.sucursal] = (r[m.sucursal] ?? 0) - m.cantidad * (precio.get(m.productoId) ?? 0)
  return r
}

// ---------- Vencimiento y prendas ----------
export const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const tiene = (texto: string, claves: string[]) => { const t = sinTildes(texto); return !!t && claves.some((k) => t.includes(k)) }

/** Lo que suele vencer (alimentos, medicinas, limpieza…). Lo demás (ropa, tecnología, ferretería…) arranca sin fecha de vencimiento. */
const PERECIBLES = ['aliment', 'bebida', 'farmac', 'medicament', 'insumos medicos', 'curacion', 'suplement', 'vitamina', 'carne', 'embutido', 'pescado', 'marisco', 'fruta', 'verdura', 'lacteo', 'abarrote', 'grano', 'cereal', 'panaderia', 'pasteleria', 'snack', 'golosina', 'enlatado', 'congelado', 'condimento', 'salsa', 'comida', 'cuidado personal', 'cuidado del cabello', 'cuidado de la piel', 'maquillaje', 'limpieza', 'detergente', 'desinfectante', 'higiene', 'agroquimic', 'fertiliz', 'semilla', 'cosecha']
/** Tipos que no vencen aunque su categoría sí (en «Limpieza y hogar», los utensilios o la decoración). */
const NO_VENCEN = ['utensilio', 'menaje', 'decoracion', 'mueble', 'ropa de cama', 'toalla', 'papel', 'desechable', 'equipo', 'herramienta', 'accesorio', 'afeitado']
export const usaVencimiento = (categoria: string, tipo = '') =>
  tiene(tipo, NO_VENCEN) ? false : tiene(tipo, PERECIBLES) || tiene(categoria, PERECIBLES)
/** Días que faltan para que venza (negativo: ya venció). null: el producto no vence. */
export const diasParaVencer = (p: Pick<Producto, 'vence'>, ahora = Date.now()) => (p.vence ? (new Date(`${p.vence.slice(0, 10)}T12:00:00`).getTime() - ahora) / 864e5 : null)
/** Fecha de vencimiento sugerida para un producto nuevo de una categoría que vence (dentro de un año). */
export const venceSugerido = () => new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)

/** Ropa, calzado y textiles: se registran con color, talla y tipo de cuello. */
const PRENDAS = ['textil', 'ropa', 'prenda', 'camiseta', 'camisa', 'blusa', 'polo', 'buzo', 'sudadera', 'chompa', 'sueter', 'chaqueta', 'abrigo', 'chaleco', 'pantalon', 'jean', 'short', 'falda', 'vestido', 'pijama', 'media', 'calcetin', 'traje de bano', 'uniforme', 'gorra', 'sombrero', 'calzado', 'zapat', 'bufanda', 'guante', 'cinturon', 'temporada']
const NO_PRENDAS = ['ropa de cama', 'toalla', 'tela', 'hilo']
export const esPrenda = (categoria: string, tipo = '') => !tiene(tipo, NO_PRENDAS) && (tiene(tipo, PRENDAS) || tiene(categoria, PRENDAS))
/** El tipo de cuello solo aplica a prendas de arriba (no a pantalones, calzado, gorras, medias…). */
const SIN_CUELLO = ['pantalon', 'jean', 'short', 'falda', 'calzado', 'zapat', 'gorra', 'sombrero', 'media', 'calcetin', 'interior', 'bufanda', 'guante', 'cinturon']
/** Qué mirar para el cuello y la talla: el tipo; sin tipo, la categoría (salvo una categoría general como «Ropa, calzado y textil», que lo engloba todo). */
const referencia = (categoria: string, tipo: string) => tipo || (tiposDe(categoria).length ? '' : categoria)
export const usaCuello = (categoria: string, tipo = '') => esPrenda(categoria, tipo) && !tiene(referencia(categoria, tipo), SIN_CUELLO)
/** Tallas sugeridas según la prenda (siempre se puede escribir otra). */
export function tallasDe(categoria: string, tipo = '') {
  const x = referencia(categoria, tipo)
  if (tiene(x, ['calzado', 'zapat'])) return ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44']
  if (tiene(x, ['gorra', 'sombrero'])) return ['Única', 'S/M', 'L/XL']
  if (tiene(x, ['bebe'])) return ['0-3 M', '3-6 M', '6-12 M', '12-18 M', '18-24 M']
  if (tiene(x, ['jean'])) return ['28', '30', '32', '34', '36', '38']
  if (tiene(x, ['media', 'calcetin', 'bufanda', 'guante', 'cinturon'])) return ['Única', 'S', 'M', 'L']
  return ['XS', 'S', 'M', 'L', 'XL', 'XXL']
}
export const CUELLOS = ['Redondo', 'En V', 'Polo', 'Camisero', 'Tortuga', 'Sin cuello']
/** Colores de prendas por defecto (los de la empresa se guardan en empresa.colores y se pueden agregar más). */
export const COLORES = ['Blanco', 'Negro', 'Azul camerino', 'Rojo', 'Celeste acuario', 'Azul rey', 'Plomo claro', 'Azul marino', 'Plomo oscuro', 'Crema']
const HEX: Record<string, string> = {
  blanco: '#ffffff', negro: '#111111', 'azul camerino': '#3b5a8f', rojo: '#d32f2f', 'celeste acuario': '#6fd3e6', 'azul rey': '#2649c9', 'plomo claro': '#b9bdc4',
  'azul marino': '#1d2b4f', 'plomo oscuro': '#555b63', crema: '#f2e6c8', gris: '#9ca3af', plomo: '#8a8f97', azul: '#2563eb', celeste: '#7dd3fc', verde: '#16a34a',
  amarillo: '#facc15', naranja: '#f97316', rosado: '#f9a8d4', fucsia: '#d946ef', morado: '#7e22ce', lila: '#c4b5fd', vino: '#7b1e2b', beige: '#e8d9b5', cafe: '#6b4226', mostaza: '#d4a017', turquesa: '#14b8a6',
}
/** Color para la muestra (círculo) de un nombre de color; null si no se conoce. */
export const colorHex = (nombre: string) => HEX[sinTildes(nombre).trim()] ?? HEX[sinTildes(nombre).trim().split(/\s+/)[0]] ?? null
/** Código corto de un color para el SKU: «Azul marino» → AZUM, «Blanco» → BLA. */
export const codigoColor = (nombre: string) => { const w = sinTildes(nombre).toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean); return (w[0]?.slice(0, 3) ?? 'COL') + w.slice(1).map((x) => x[0]).join('') }
/** SKU de una variante: CAM-010 + Blanco + S → CAM-010-BLA-S */
export const skuVariante = (base: string, color?: string, talla?: string) => [base.trim(), color && codigoColor(color), talla && talla.replace(/[^A-Za-z0-9]/g, '')].filter(Boolean).join('-').toUpperCase()
/** Variantes del mismo modelo (mismos colores y tallas de una prenda): por su código de modelo o, si no lo tiene, por nombre, categoría y cuello. */
export const modeloDe = (p: Pick<Producto, 'modelo' | 'nombre' | 'categoria' | 'cuello' | 'color' | 'talla'>) => p.modelo ?? (p.color || p.talla ? `${p.nombre}|${p.categoria}|${p.cuello ?? ''}` : null)
/** Código base de un modelo (para crear una variante nueva): el del modelo o el SKU sin su color y talla. */
export function baseDeModelo(p: Pick<Producto, 'modelo' | 'sku' | 'color' | 'talla'>) {
  if (p.modelo) return p.modelo
  let s = p.sku
  if (p.talla) s = s.replace(new RegExp(`-${p.talla.replace(/[^A-Za-z0-9]/g, '')}$`, 'i'), '')
  if (p.color) s = s.replace(new RegExp(`-${codigoColor(p.color)}$`, 'i'), '')
  return s
}
/** Nombre con sus detalles de prenda, para distinguir tallas y colores: «Camiseta básica · Blanco · Talla M · Cuello en V». */
export const etiquetaProducto = (p: Pick<Producto, 'nombre' | 'color' | 'talla' | 'cuello'>) =>
  [p.nombre, p.color, p.talla && `Talla ${p.talla}`, p.cuello && (p.cuello === 'Sin cuello' ? p.cuello : `Cuello ${p.cuello.charAt(0).toLowerCase()}${p.cuello.slice(1)}`)].filter(Boolean).join(' · ')

