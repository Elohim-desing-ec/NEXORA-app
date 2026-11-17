/**
 * Perfiles por tipo de negocio: NEXORA es el mismo sistema para todos, pero cada sector ve
 * sus categorías sugeridas, su meta de margen, los indicadores que más le importan y consejos propios.
 */
import type { Movimiento, Producto, Venta } from '../data/base'
import { enQuiebre, stockTotal } from './inventario'
import { serviciosDe } from './resumen'
import { money, num, pct, plural } from './format'

export type Clave = 'vencimiento' | 'mermas' | 'rotacion' | 'margen' | 'porCobrar' | 'canales' | 'sucursales' | 'quiebres'
export interface PerfilSector {
  id: string; nombre: string; sectores: string[]
  /** Cómo se llaman las cosas en este negocio */
  productos: string; clientes: string; sucursales: string
  categorias: string[]; margenMeta: number; foco: string; claves: Clave[]; consejos: string[]
}

export const PERFILES: PerfilSector[] = [
  { id: 'salud', nombre: 'Salud y farmacia', sectores: ['Salud', 'Farmacéutico'], productos: 'medicamentos e insumos', clientes: 'pacientes', sucursales: 'farmacias o consultorios',
    categorias: ['Medicamentos', 'Insumos médicos', 'Material de curación', 'Equipos médicos', 'Higiene y protección', 'Suplementos'], margenMeta: 0.3,
    foco: 'Que nunca falte un medicamento y que nada se venza en la bodega.', claves: ['vencimiento', 'quiebres', 'mermas', 'margen'],
    consejos: ['Venda primero lo que vence primero (FEFO) y revise cada semana la lista "Por vencer".', 'Registre lote y fecha de vencimiento en cada ingreso: así responde rápido ante un retiro sanitario.', 'Los medicamentos de alta rotación no deben quedar en quiebre: use las sugerencias de compra de la IA.'] },
  { id: 'construccion', nombre: 'Construcción y arquitectura', sectores: ['Construcción / ferretería', 'Arquitectura e ingeniería'], productos: 'materiales', clientes: 'clientes y proyectos', sucursales: 'obras o bodegas',
    categorias: ['Cemento y agregados', 'Acero y hierro', 'Madera', 'Acabados y pisos', 'Eléctricos', 'Plomería', 'Pintura', 'Herramientas'], margenMeta: 0.25,
    foco: 'Saber cuánto material lleva cada obra y no detener un proyecto por falta de material.', claves: ['sucursales', 'quiebres', 'margen', 'porCobrar'],
    consejos: ['Cree una sucursal por obra: verá cuánto material y dinero tiene cada proyecto.', 'Transfiera los sobrantes de una obra a otra antes de volver a comprar.', 'Califique a sus proveedores por cumplimiento: un retraso detiene toda la obra.'] },
  { id: 'alimentos', nombre: 'Restaurantes y alimentos', sectores: ['Restaurantes y cafeterías', 'Alimentos y bebidas', 'Turismo y hotelería'], productos: 'insumos y productos', clientes: 'comensales y clientes', sucursales: 'locales o cocinas',
    categorias: ['Carnes y mariscos', 'Frutas y verduras', 'Lácteos', 'Abarrotes', 'Bebidas', 'Panadería', 'Desechables'], margenMeta: 0.6,
    foco: 'Controlar la merma y los perecibles: ahí se va la ganancia de la cocina.', claves: ['mermas', 'vencimiento', 'margen', 'rotacion'],
    consejos: ['Registre cada merma el mismo día; una merma mayor al 3 % de lo vendido es señal de alerta.', 'Use primero lo que entró primero (PEPS) y compre perecibles en lotes pequeños.', 'Costee sus platos: precio de venta = costo de ingredientes ÷ (1 − margen que quiere).'] },
  { id: 'moda', nombre: 'Moda, belleza y emprendimiento creativo', sectores: ['Moda y textil', 'Belleza y cuidado personal', 'Artesanías / emprendimiento creativo'], productos: 'prendas y productos', clientes: 'clientes y seguidores', sucursales: 'tiendas',
    categorias: ['Camisetas', 'Pantalones', 'Vestidos', 'Calzado', 'Accesorios', 'Cuidado personal', 'Temporada'], margenMeta: 0.5,
    foco: 'Vender por redes sociales y no quedarse con mercadería de temporadas pasadas.', claves: ['canales', 'margen', 'porCobrar', 'rotacion'],
    consejos: ['Mire qué canal vende más (WhatsApp, Instagram, TikTok) y ponga ahí su publicidad.', 'Liquide al final de cada temporada lo que no se movió en 90 días.', 'Cobre los fiados a tiempo: en Ventas → Clientes ve quién le debe.'] },
  { id: 'tecnologia', nombre: 'Tecnología y comercio en línea', sectores: ['Tecnología', 'Software y servicios digitales', 'E-commerce / tienda en línea'], productos: 'equipos y productos', clientes: 'clientes', sucursales: 'tiendas o bodegas',
    categorias: ['Computadoras', 'Celulares', 'Accesorios', 'Componentes', 'Licencias', 'Servicio técnico'], margenMeta: 0.25,
    foco: 'Rotar rápido: la tecnología pierde valor cada mes que pasa en la bodega.', claves: ['rotacion', 'canales', 'margen', 'quiebres'],
    consejos: ['Un equipo que no se vende en 90 días ya perdió valor: haga combos o promociones.', 'Compre más seguido y en menos cantidad para no quedarse con modelos viejos.', 'Separe ventas en línea y en tienda con el canal de cada venta.'] },
  { id: 'industria', nombre: 'Industria y repuestos', sectores: ['Industria / manufactura', 'Automotriz / repuestos'], productos: 'materias primas y repuestos', clientes: 'clientes', sucursales: 'plantas o bodegas',
    categorias: ['Materia prima', 'Producto en proceso', 'Producto terminado', 'Repuestos', 'Lubricantes', 'Empaques'], margenMeta: 0.3,
    foco: 'Que la producción no pare por falta de materia prima ni de repuestos.', claves: ['quiebres', 'rotacion', 'mermas', 'margen'],
    consejos: ['Defina el stock mínimo de cada materia prima según lo que consume por semana.', 'Las mermas de producción también son costo: regístrelas.', 'Revise el ranking de proveedores antes de cada compra grande.'] },
  { id: 'agro', nombre: 'Agro y agroindustria', sectores: ['Agricultura y agroindustria'], productos: 'insumos y cosechas', clientes: 'compradores', sucursales: 'fincas o bodegas',
    categorias: ['Semillas', 'Fertilizantes', 'Agroquímicos', 'Alimento animal', 'Herramientas', 'Cosecha'], margenMeta: 0.3,
    foco: 'Planificar insumos por temporada y vender la cosecha antes de que pierda calidad.', claves: ['vencimiento', 'mermas', 'rotacion', 'margen'],
    consejos: ['Registre la fecha de vencimiento de agroquímicos y semillas.', 'Anote las pérdidas de cosecha como merma para saber cuánto se pierde.', 'Compre los insumos antes de la siembra comparando proveedores.'] },
  { id: 'servicios', nombre: 'Servicios y educación', sectores: ['Servicios', 'Servicios profesionales', 'Educación'], productos: 'materiales e insumos', clientes: 'clientes y estudiantes', sucursales: 'oficinas o sedes',
    categorias: ['Materiales', 'Insumos', 'Papelería', 'Equipos', 'Kits', 'Repuestos'], margenMeta: 0.45,
    foco: 'Cobrar a tiempo y controlar los insumos que usa en cada servicio.', claves: ['porCobrar', 'margen', 'quiebres', 'canales'],
    consejos: ['Revise cada semana lo que está "Por cobrar" y llame a quien le debe.', 'Incluya el costo de los materiales en el precio de cada servicio.', 'Use el canal de la venta para saber de dónde llegan sus clientes.'] },
  { id: 'comercio', nombre: 'Comercio y distribución', sectores: ['Comercio / distribución', 'Retail / supermercados', 'Importación / exportación', 'Logística', 'Otro'], productos: 'productos', clientes: 'clientes', sucursales: 'sucursales',
    categorias: ['Alimentos y bebidas', 'Limpieza y hogar', 'Cuidado personal', 'Tecnología', 'Papelería y oficina', 'Ferretería', 'Repuestos', 'Farmacia', 'Textil', 'Materia prima'], margenMeta: 0.25,
    foco: 'Rotar el inventario, no quedarse sin lo que más se vende y cobrar a tiempo.', claves: ['rotacion', 'quiebres', 'sucursales', 'porCobrar'],
    consejos: ['Mantenga en el mínimo lo que menos se vende y nunca deje en quiebre lo que más se vende.', 'Compare sus sucursales: mueva mercadería de donde sobra a donde falta.', 'Negocie plazos con proveedores parecidos a los que da a sus clientes.'] },
]

export const perfilDe = (sector?: string) => PERFILES.find((p) => sector && p.sectores.includes(sector)) ?? PERFILES[PERFILES.length - 1]

export interface Indicador { titulo: string; valor: string; nota: string; tono: 'verde' | 'ambar' | 'rojo' | 'gris' }

/** Los 4 indicadores clave del sector, calculados con los datos reales del negocio. */
export function indicadoresSector(perfil: PerfilSector, d: { productos: Producto[]; movimientos: Movimiento[]; ventas: Venta[]; sucursales: { id: string; nombre: string }[] }, ahora = Date.now()): Indicador[] {
  const { productos, movimientos, ventas } = d
  const dias = (f: string) => (ahora - new Date(f).getTime()) / 864e5
  const precio = new Map(productos.map((p) => [p.id, p.precio]))
  let cmv30 = 0, merma30 = 0, v90 = 0, c90 = 0
  for (const m of movimientos) {
    const t = dias(m.fecha)
    if (m.tipo === 'Venta' && t <= 30) cmv30 -= m.cantidad * m.costoUnit
    if (m.tipo === 'Merma' && t <= 30) merma30 -= m.cantidad * m.costoUnit
    if (m.tipo === 'Venta' && t <= 90) { v90 -= m.cantidad * (m.precioUnit ?? precio.get(m.productoId) ?? 0); c90 -= m.cantidad * m.costoUnit }
  }
  for (const x of serviciosDe(ventas)) if (dias(x.fecha) <= 90) { v90 += x.monto; c90 += x.costo } // servicios y otros ingresos
  const valor = productos.reduce((a, p) => a + stockTotal(p) * p.costo, 0)
  const calc: Record<Clave, () => Indicador> = {
    vencimiento: () => {
      const conStock = productos.filter((p) => stockTotal(p) > 0 && p.vence)
      const vencidos = conStock.filter((p) => new Date(p.vence + 'T23:59:59').getTime() < ahora)
      const pronto = conStock.filter((p) => { const t = new Date(p.vence + 'T12:00:00').getTime() - ahora; return t >= 0 && t < 60 * 864e5 })
      return { titulo: 'Por vencer (60 días)', valor: plural(pronto.length, 'producto', 'productos'), nota: vencidos.length ? `${plural(vencidos.length, 'ya vencido', 'ya vencidos')} en bodega` : `${money(pronto.reduce((a, p) => a + stockTotal(p) * p.costo, 0), 0)} en riesgo`, tono: vencidos.length ? 'rojo' : pronto.length ? 'ambar' : 'verde' }
    },
    mermas: () => { const r = cmv30 ? merma30 / cmv30 : 0; return { titulo: 'Merma del mes', valor: money(merma30, 0), nota: cmv30 ? `${pct(r, 1)} de lo vendido (meta: menos de 3 %)` : 'Sin ventas en 30 días', tono: !merma30 ? 'verde' : r > 0.03 ? 'rojo' : 'ambar' } },
    rotacion: () => { const dInv = cmv30 ? valor / (cmv30 / 30) : Infinity; return { titulo: 'Días de inventario', valor: Number.isFinite(dInv) ? `${num(dInv, 0)} días` : '—', nota: Number.isFinite(dInv) ? 'Lo que dura su stock al ritmo actual de ventas' : 'Sin ventas en 30 días', tono: !Number.isFinite(dInv) ? 'gris' : dInv > 120 ? 'rojo' : dInv > 60 ? 'ambar' : 'verde' } },
    margen: () => { const m = v90 ? (v90 - c90) / v90 : 0; return { titulo: 'Margen bruto (90 días)', valor: v90 ? pct(m, 1) : '—', nota: `Meta del sector: ${pct(perfil.margenMeta, 0)} o más`, tono: !v90 ? 'gris' : m >= perfil.margenMeta ? 'verde' : m >= perfil.margenMeta * 0.7 ? 'ambar' : 'rojo' } },
    porCobrar: () => { const pc = ventas.filter((v) => v.estado === 'Por cobrar'); const total = pc.reduce((a, v) => a + v.total, 0); return { titulo: 'Por cobrar', valor: money(total, 0), nota: pc.length ? `${plural(new Set(pc.map((v) => v.cliente || v.id)).size, 'persona le debe', 'personas le deben')} (fiado)` : 'Nadie le debe', tono: total ? 'ambar' : 'verde' } },
    canales: () => {
      const por = new Map<string, number>()
      for (const v of ventas) if (v.estado !== 'Anulada' && dias(v.fecha) <= 90) por.set(v.canal, (por.get(v.canal) ?? 0) + v.total)
      const tot = [...por.values()].reduce((a, b) => a + b, 0), top = [...por].sort((a, b) => b[1] - a[1])[0]
      return { titulo: 'Canal que más vende', valor: top ? top[0] : '—', nota: top ? `${pct(top[1] / tot, 0)} de las ventas de 90 días` : 'Registre el canal en cada venta', tono: top ? 'verde' : 'gris' }
    },
    sucursales: () => {
      const por = d.sucursales.map((s) => ({ s, v: productos.reduce((a, p) => a + (p.stock[s.id] ?? 0) * p.costo, 0) })).sort((a, b) => b.v - a.v)
      return { titulo: 'Dónde está su stock', valor: por[0] ? por[0].s.nombre : '—', nota: por[0] ? `Tiene ${money(por[0].v, 0)} (${pct(valor ? por[0].v / valor : 0, 0)} del total)` : 'Registre sus sucursales', tono: por.length ? 'gris' : 'ambar' }
    },
    quiebres: () => { const q = productos.filter((p) => enQuiebre(p)).length; return { titulo: 'En quiebre', valor: plural(q, 'producto', 'productos'), nota: q ? 'Hay que reponer pronto' : 'Todo con stock', tono: q ? 'rojo' : 'verde' } },
  }
  return perfil.claves.map((k) => calc[k]())
}
