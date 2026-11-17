/**
 * Proveedores de todo tamaño: desde quien hace camisetas en su casa hasta una fábrica.
 * Niveles, cumplimiento real, distancia a las sucursales y avisos para la campana.
 */
import type { Orden, Producto, Proveedor, Sucursal } from '../data/base'
import { enQuiebre } from './inventario'

export type NivelProveedor = 'Emprendedor' | 'Junior' | 'Senior' | 'Experimentado'
export const NIVELES_PROVEEDOR: { nivel: NivelProveedor; descripcion: string; ejemplo: string }[] = [
  { nivel: 'Emprendedor', descripcion: 'Recién empieza o trabaja desde casa. No necesita RUC ni local.', ejemplo: 'Ej.: hace camisetas en su casa' },
  { nivel: 'Junior', descripcion: 'Pocos clientes y algo de experiencia; produce en pequeño.', ejemplo: 'Ej.: taller con 1 o 2 personas' },
  { nivel: 'Senior', descripcion: 'Negocio establecido, con taller o local y RUC.', ejemplo: 'Ej.: distribuidora de la ciudad' },
  { nivel: 'Experimentado', descripcion: 'Muchos años, mayorista o fábrica; entrega en volumen.', ejemplo: 'Ej.: fábrica o importadora' },
]
export const LUGARES_TRABAJO = ['Desde su casa', 'Taller pequeño', 'Local o tienda', 'Fábrica o bodega', 'Solo en línea'] as const
export const infoNivel = (n?: string) => NIVELES_PROVEEDOR.find((x) => x.nivel === n)

/** Cumplimiento real: % de órdenes aprobadas que ya se recibieron (sin historial: el valor registrado). */
export function cumplimientoReal(p: Proveedor, ordenes: Orden[]) {
  const os = ordenes.filter((o) => o.proveedorId === p.id && o.estado !== 'Borrador')
  const recibidas = os.filter((o) => o.estado === 'Recibida').length
  return { cumplimiento: os.length ? (recibidas / os.length) * 100 : p.cumplimiento, recibidas, ordenes: os.length }
}

/** Con 3+ órdenes recibidas y 90 %+ de cumplimiento, sugiere subir un nivel (nunca baja solo). */
export function nivelSugerido(p: Proveedor, ordenes: Orden[]): NivelProveedor | null {
  const { cumplimiento, recibidas } = cumplimientoReal(p, ordenes)
  const k = NIVELES_PROVEEDOR.findIndex((x) => x.nivel === p.nivel)
  if (k < 0 || k === NIVELES_PROVEEDOR.length - 1) return null
  const necesita = [3, 6, 12][k] // más órdenes cumplidas para cada nivel siguiente
  return recibidas >= necesita && cumplimiento >= 90 ? NIVELES_PROVEEDOR[k + 1].nivel : null
}

export const tieneUbicacion = (p: Pick<Proveedor, 'lat' | 'lng'>) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0)

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}
export const textoKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`)

/** Sucursal más cercana a un proveedor con ubicación. */
export function sucursalCercana(p: Proveedor, sucursales: Sucursal[]) {
  if (!tieneUbicacion(p)) return null
  let mejor: { s: Sucursal; km: number } | null = null
  for (const s of sucursales) { if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue; const km = distanciaKm({ lat: p.lat!, lng: p.lng! }, s); if (!mejor || km < mejor.km) mejor = { s, km } }
  return mejor
}

/** 'info' = recordatorio suave (no enciende el punto rojo de la campana). */
export interface AvisoProveedor { t: 'rojo' | 'ambar' | 'verde' | 'info'; m: string }

/** Avisos sobre proveedores para la campana: a quién pedir lo que falta (y a qué distancia), quién merece subir de nivel y quién no cumple. */
export function avisosProveedores(d: { proveedores: Proveedor[]; productos: Producto[]; sucursales: Sucursal[]; ordenes: Orden[] }): AvisoProveedor[] {
  const r: AvisoProveedor[] = []
  const porId = new Map(d.proveedores.map((p) => [p.id, p]))
  // 1) Falta stock: proveedor del producto y su distancia a la sucursal donde falta
  for (const prod of d.productos) {
    const p = porId.get(prod.proveedorId)
    if (!p) continue
    const faltan = d.sucursales.filter((s) => s.id in prod.stock && enQuiebre(prod, s.id))
    if (!faltan.length) continue
    const cerca = tieneUbicacion(p) ? faltan.map((s) => ({ s, km: distanciaKm({ lat: p.lat!, lng: p.lng! }, s) })).sort((a, b) => a.km - b.km)[0] : null
    r.push({ t: 'rojo', m: cerca ? `Reponga ${prod.nombre}: su proveedor ${p.nombre} está a ${textoKm(cerca.km)} de ${cerca.s.nombre}` : `Reponga ${prod.nombre}: pídaselo a ${p.nombre}${p.telefono ? ` (${p.telefono})` : ''}` })
  }
  // 2) Proveedores que crecieron con usted
  for (const p of d.proveedores) { const n = nivelSugerido(p, d.ordenes); if (n) r.push({ t: 'verde', m: `${p.nombre} ya cumplió varias entregas: puede subirlo a ${n}` }) }
  // 3) Proveedores que no cumplen
  for (const p of d.proveedores) { const c = cumplimientoReal(p, d.ordenes); if (c.ordenes >= 2 && c.cumplimiento < 80) r.push({ t: 'ambar', m: `${p.nombre} entregó solo el ${Math.round(c.cumplimiento)} % de sus órdenes` }) }
  // 4) Sin ubicación: no aparecen en el mapa ni se puede medir la distancia
  const sinUbicar = d.proveedores.filter((p) => !tieneUbicacion(p)).length
  if (sinUbicar && d.proveedores.length) r.push({ t: 'info', m: `${sinUbicar === 1 ? '1 proveedor no tiene' : `${sinUbicar} proveedores no tienen`} ubicación: agréguela en Compras para verlos en el mapa` })
  return r
}
