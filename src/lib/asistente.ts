/**
 * Asistente NEXORA (funciona sin internet): entiende la intención de la pregunta por palabras clave,
 * consulta los datos reales del sistema y explica cómo usar cada módulo.
 */
import type { Gasto, Movimiento, Orden, Producto, Proveedor, Sucursal, Empresa, Venta } from '../data/base'
import { agregar, gastosDe } from './resumen'
import type { Pagina, Rol } from '../store/useApp'
import type { Params } from './finance'
import * as F from './finance'
import { money, num, pct, fecha } from './format'
import { normalizar, responder as responderEcon } from './preguntas'
import { diasParaVencer, enQuiebre, etiquetaProducto, stockTotal } from './inventario'

export interface Ctx { productos: Producto[]; movimientos: Movimiento[]; ordenes: Orden[]; proveedores: Proveedor[]; sucursales: Sucursal[]; empresa: Empresa; rol: Rol; nombre: string; p: Params; /** ¿La empresa ya creó una evaluación económica? (si falta, se asume que sí) */ hayEval?: boolean; /** Ventas (incluye servicios) y gastos del negocio */ ventas?: Venta[]; gastos?: Gasto[] }
export interface Resp { texto: string; ir?: { pagina: Pagina; label: string; tab?: string }; sugerencias?: string[] }

/** Coincide al inicio de palabra ("vend" ⊂ "vendido", pero "tema" ⊄ "sistema"); palabras cortas, exactas. */
const has = (q: string, k: string) => new RegExp(`\\b${k}${k.length <= 3 ? '\\b' : ''}`).test(q)
interface Intencion { tema: string[]; accion?: string[]; r: (c: Ctx, q: string) => Resp }

export const SUGERENCIAS = ['¿Cómo agrego un producto?', '¿Qué productos están en quiebre?', '¿Cuál es el valor del inventario?', '¿Cómo registro una venta?', '¿Conviene reemplazar el sistema?', '¿Cómo cargo mis datos desde Excel?']

/** Busca el producto mencionado en la pregunta (por SKU o palabras del nombre). */
function productoEn(q: string, ps: Producto[]) {
  let mejor: Producto | undefined, max = 0
  for (const p of ps) {
    if (q.includes(p.sku.toLowerCase())) return p
    const n = normalizar(p.nombre).split(/\s+/).filter((w) => w.length > 3 && q.includes(w)).length
    if (n > max) { max = n; mejor = p }
  }
  return mejor
}

/** Resultado de este mes con la misma cuenta que Resumen y el Dashboard. */
const mesActual = (c: Ctx) => { const h = new Date(); return agregar(c.movimientos, c.productos, c.gastos ?? [], h.getFullYear(), h.getMonth(), 'TODAS', c.ventas ?? []) }

const DATOS: Intencion[] = [
  { tema: ['gasto', 'gaste', 'gastamos', 'egreso'], r: (c) => {
    const h = new Date(), g = gastosDe(c.gastos ?? [], h.getFullYear(), h.getMonth())
    return { texto: g.length ? `Este mes lleva ${money(g.reduce((a, x) => a + x.monto, 0))} en gastos:\n${g.slice(-6).map((x) => `• ${x.fecha} · ${x.concepto || x.categoria}: ${money(x.monto)}`).join('\n')}` : 'No hay gastos registrados este mes. Regístrelos en Operación → Gastos.', ir: { pagina: 'gastos', label: 'Ir a Gastos' } }
  } },
  { tema: ['ganancia', 'utilidad', 'gane', 'ganamos', 'cuanto vendi', 'cuanto vendimos', 'ventas del mes', 'ingreso'], r: (c) => {
    const a = mesActual(c)
    return { texto: `Este mes: ventas ${money(a.ventas)}${a.servicios ? ` (de ellas ${money(a.servicios)} en servicios)` : ''} − costo de lo vendido ${money(a.costo)} − gastos ${money(a.gastos)} = ganancia neta ${money(a.neta)} (margen ${pct(a.margen, 1)}).`, ir: { pagina: 'resumen', label: 'Ver el Resumen' } }
  } },
  { tema: ['por cobrar', 'me deben', 'deuda', 'fiado', 'credito'], r: (c) => {
    const l = (c.ventas ?? []).filter((v) => v.estado === 'Por cobrar')
    return { texto: l.length ? `Tiene ${money(l.reduce((a, v) => a + v.total, 0))} por cobrar:\n${l.slice(0, 8).map((v) => `• ${v.id}${v.cliente ? ` · ${v.cliente}` : ''}: ${money(v.total)}`).join('\n')}` : 'Nadie le debe: todas las ventas están pagadas.', ir: { pagina: 'ventas', label: 'Ir a Ventas' } }
  } },
  { tema: ['hola', 'buenas', 'buenos dias', 'ayuda', 'que puedes', 'que sabes', 'como funcionas'], r: (c) => ({ texto: `¡Hola, ${c.nombre.split(' ')[0]}! Soy el asistente de NEXORA. Puedo:\n• Explicarle cómo usar cada módulo (productos, ventas, compras, usuarios, reportes…).\n• Consultar sus datos: stock, quiebres, valor del inventario, más vendidos, vencimientos.\n• Responder preguntas del análisis económico (CAUE, VPN, TIR, depreciación…).`, sugerencias: SUGERENCIAS }) },
  { tema: ['resumen', 'como va', 'como estamos', 'estado del negocio', 'situacion'], r: (c) => {
    const v = c.productos.reduce((s, p) => s + stockTotal(p) * p.costo, 0), q = c.productos.filter((p) => enQuiebre(p)).length, a = mesActual(c)
    const mes = a.ventas || a.gastos ? `Este mes: ventas ${money(a.ventas)}, gastos ${money(a.gastos)}, ganancia neta ${money(a.neta)}.\n` : ''
    if (!c.productos.length && mes) return { texto: mes.trim(), ir: { pagina: 'resumen', label: 'Ver el Resumen' } }
    return { texto: c.productos.length ? mes + `${c.empresa.nombre} tiene ${c.productos.length} productos con un inventario valorizado en ${money(v)}. ${q} producto(s) en quiebre de stock y ${c.ordenes.filter((o) => o.estado !== 'Recibida').length} orden(es) de compra pendientes. Se han registrado ${c.movimientos.filter((m) => m.tipo === 'Venta').length} ventas.` : 'Aún no hay productos registrados. Empiece en Inventario → "Nuevo producto" o cargue un Excel en Configuración → Mis datos.', ir: { pagina: 'dashboard', label: 'Ver dashboard' } }
  } },
  { tema: ['valor del inventario', 'valor inventario', 'cuanto vale', 'inventario vale', 'capital'], r: (c) => ({ texto: `El inventario vale ${money(c.productos.reduce((s, p) => s + stockTotal(p) * p.costo, 0))} a costo promedio.\n${c.sucursales.map((s) => `• ${s.ciudad}: ${money(c.productos.reduce((a, p) => a + p.stock[s.id] * p.costo, 0))}`).join('\n')}`, ir: { pagina: 'productos', label: 'Ver inventario' } }) },
  { tema: ['quiebre', 'agotad', 'sin stock', 'faltan', 'bajo stock', 'reponer', 'minimo'], r: (c) => { const q = c.productos.filter((p) => enQuiebre(p)); return { texto: q.length ? `Hay ${q.length} producto(s) en quiebre (stock menor a 1/3 del mínimo en alguna sucursal):\n${q.slice(0, 8).map((p) => `• ${p.nombre}: ${Object.entries(p.stock).filter(([, v]) => v < p.min / 3).map(([k, v]) => `${k} ${v} u`).join(' · ')} (mín. ${p.min})`).join('\n')}` : 'No hay productos en quiebre de stock.', ir: { pagina: 'ia', label: 'Ver sugerencias de compra' } } } },
  { tema: ['mas vendid', 'mejor vendid', 'mas se vende', 'top', 'ranking de productos'], r: (c) => {
    const v = new Map<string, number>(); c.movimientos.filter((m) => m.tipo === 'Venta').forEach((m) => v.set(m.productoId, (v.get(m.productoId) ?? 0) - m.cantidad))
    const top = [...v.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { texto: top.length ? `Productos más vendidos:\n${top.map(([id, u], k) => `${k + 1}. ${c.productos.find((p) => p.id === id)?.nombre ?? '—'}: ${u} u`).join('\n')}` : 'Aún no hay ventas registradas. Regístrelas en Inventario → "Registrar movimiento" → Venta.' }
  } },
  { tema: ['vence', 'vencimiento', 'caduc', 'expira'], r: (c) => { const l = c.productos.filter((p) => (diasParaVencer(p) ?? Infinity) < 60).sort((a, b) => a.vence.localeCompare(b.vence)); return { texto: l.length ? `Productos que vencen en menos de 60 días:\n${l.slice(0, 8).map((p) => `• ${etiquetaProducto(p)}${p.lote ? ` (lote ${p.lote})` : ''}: ${fecha(p.vence)}`).join('\n')}` : 'Ningún producto vence en los próximos 60 días.' } } },
  { tema: ['pendiente', 'por aprobar', 'por recibir'], r: (c) => { const o = c.ordenes.filter((x) => x.estado !== 'Recibida'); return { texto: o.length ? `Órdenes pendientes:\n${o.map((x) => `• ${x.id} · ${c.proveedores.find((p) => p.id === x.proveedorId)?.nombre ?? '—'} · ${x.estado}`).join('\n')}` : 'No hay órdenes de compra pendientes.', ir: { pagina: 'compras', label: 'Ir a Compras' } } } },
  { tema: ['cuantas sucursales', 'cuantos paises', 'en que paises', 'donde estamos'], r: (c) => { const ps = [...new Set(c.sucursales.map((s) => s.pais))]; return { texto: c.sucursales.length ? `${c.empresa.nombre || 'La empresa'} tiene ${c.sucursales.length} sucursal(es) en ${ps.length} país(es):\n${c.sucursales.map((s) => `• ${s.id} · ${s.nombre} (${s.ciudad}, ${s.pais})`).join('\n')}` : 'Aún no hay sucursales registradas (Configuración → Empresa).', ir: { pagina: 'red', label: 'Ver en el globo' } } } },
  { tema: ['cuantos productos', 'numero de productos', 'cantidad de productos', 'cuantos articulos'], r: (c) => ({ texto: `Hay ${c.productos.length} productos en ${new Set(c.productos.map((p) => p.categoria)).size} categorías y ${c.proveedores.length} proveedores registrados.` }) },
  { tema: ['stock', 'cuanto hay', 'cuantas unidades', 'existencia', 'queda', 'quedan', 'hay de'], r: (c, q) => { const p = productoEn(q, c.productos); return p ? { texto: `${p.nombre} (${p.sku}): ${stockTotal(p)} u en total.\n${c.sucursales.map((s) => `• ${s.ciudad}: ${p.stock[s.id]} u`).join('\n')}\nCosto promedio ${money(p.costo)} · precio ${money(p.precio)} · mínimo ${p.min} / máximo ${p.max}.`, ir: { pagina: 'productos', label: 'Ver kardex en Inventario' } } : { texto: 'No identifiqué el producto. Escriba, por ejemplo: "stock de arroz" o el SKU.' } } },
]

const AYUDA: Intencion[] = [
  { tema: ['usuari', 'persona', 'emplead', 'ayudante', 'contrasen', 'clave', 'rol'], r: (c) => ({ texto: c.rol === 'Gerente General' ? 'Para agregar una persona: Configuración → Usuarios → "Agregar persona". Escriba su nombre, un usuario corto (ej. ana), una contraseña fácil (ej. ana2026) y su rol. Para cambiar una contraseña o un rol, pulse el lápiz junto a la persona.' : 'Solo el Gerente General puede crear usuarios o cambiar contraseñas (Configuración → Usuarios). Pídaselo a él.', ir: { pagina: 'configuracion', label: 'Ir a Usuarios' } }) },
  { tema: ['excel', 'importar', 'plantilla', 'masiv', 'csv', 'muchos productos'], r: () => ({ texto: '1. Configuración → Mis datos → "Plantilla" (descarga un Excel).\n2. Llene una fila por producto: SKU, nombre, categoría, costo, precio, stock por sucursal, mínimo, máximo, lote y vencimiento.\n3. "Importar Excel" → revise la vista previa → Importar. Si el SKU ya existe, se actualiza.', ir: { pagina: 'configuracion', label: 'Ir a Mis datos' } }) },
  { tema: ['venta', 'vend', 'factur', 'salida'], r: () => ({ texto: 'Operación → Ventas. Agregue productos del inventario o un servicio / otro ingreso (un trabajo que le pagaron), el descuento y si está Pagada o Por cobrar, y pulse \"Registrar venta\". Se descuenta el stock de los productos y todo el equipo la ve al instante en el Dashboard.', ir: { pagina: 'resumen', label: 'Ir a Resumen' } }) },
  { tema: ['producto', 'articulo', 'item', 'mercaderia'], accion: ['agreg', 'crear', 'nuevo', 'registr', 'ingres', 'anad'], r: () => ({ texto: 'Inventario → "Nuevo producto". Llene SKU, nombre, categoría (puede escribir una nueva), proveedor, costo, precio, stock por sucursal, mínimo, máximo, lote y vencimiento. El stock inicial queda como "Saldo inicial" en el kardex.', ir: { pagina: 'productos', label: 'Ir a Inventario' } }) },
  { tema: ['proveedor'], r: () => ({ texto: 'Compras → "Nuevo proveedor": nombre, RUC, ciudad, contacto, teléfono y correo. El ranking se calcula con el cumplimiento real (órdenes recibidas / aprobadas) y el índice de precio.', ir: { pagina: 'compras', label: 'Ir a Compras' } }) },
  { tema: ['orden', 'compra', 'pedido', 'comprar', 'aprob', 'recib'], r: () => ({ texto: 'Compras → "Nueva orden": proveedor, sucursal y productos. Flujo: Borrador → Aprobada (Gerente o Analista) → Recibida (Gerente o Jefe de Bodega). Al recibir se suma el stock y se recalcula el costo promedio.\nPara una compra rápida sin orden: Inventario → "Registrar movimiento" → Compra.', ir: { pagina: 'compras', label: 'Ir a Compras' } }) },
  { tema: ['transfer', 'traslad', 'mover', 'enviar'], r: () => ({ texto: 'Inventario → ícono ⇄ del producto → elija origen, destino y cantidad. Queda registrado en ambas sucursales y en la bitácora.', ir: { pagina: 'productos', label: 'Ir a Inventario' } }) },
  { tema: ['merma', 'ajuste', 'dano', 'perdid', 'robo', 'conteo'], r: () => ({ texto: 'Inventario → "Registrar movimiento" → Merma (pérdida, daño, vencimiento) o Ajuste (corrección por conteo físico; positivo suma, negativo resta). Escriba el motivo en la nota.', ir: { pagina: 'productos', label: 'Ir a Inventario' } }) },
  { tema: ['kardex', 'promedio ponderado', 'historial'], r: () => ({ texto: 'Inventario → ícono del reloj en el producto. El kardex muestra cada entrada y salida con su saldo y el costo promedio ponderado: con cada compra, costo = (saldo × costo anterior + cantidad × costo nuevo) / (saldo + cantidad).', ir: { pagina: 'productos', label: 'Ir a Inventario' } }) },
  { tema: ['codigo de barra', 'barra', 'qr', 'etiqueta', 'imprimir'], r: () => ({ texto: 'Inventario → ícono de código de barras del producto → "Imprimir etiqueta" (incluye código de barras y QR con SKU, lote y vencimiento).' }) },
  { tema: ['reporte', 'export', 'pdf', 'descargar'], r: () => ({ texto: 'Reportes: inventario, kardex, compras, auditoría y el análisis económico en Excel (con fórmulas reales) o PDF con membrete de la empresa.', ir: { pagina: 'reportes', label: 'Ir a Reportes' } }) },
  { tema: ['respaldo', 'backup', 'otra computadora', 'perder', 'se borra', 'guardar los datos'], r: () => ({ texto: 'Los datos se guardan en este navegador. Configuración → Mis datos → "Descargar respaldo" genera un archivo .json; con "Restaurar respaldo" lo carga en otra computadora.', ir: { pagina: 'configuracion', label: 'Ir a Mis datos' } }) },
  { tema: ['empresa', 'sucursal', 'ruc', 'direccion', 'mapa'], r: () => ({ texto: 'Configuración → Empresa: razón social, país, moneda e identificación fiscal. Ahí mismo agrega sucursales ilimitadas en cualquier país: busque la dirección real o haga clic en el globo para ubicarlas.', ir: { pagina: 'configuracion', label: 'Ir a Empresa' } }) },
  { tema: ['red global', 'globo', 'mundo', 'internacional', '3d'], r: () => ({ texto: 'Red global muestra todas sus sucursales sobre un globo terráqueo 3D: arrástrelo para girar, use la rueda para acercar hasta la calle y cambie entre mapa oscuro, claro o satélite. Incluye el consolidado por país con tipos de cambio reales del día.', ir: { pagina: 'red', label: 'Abrir Red global' } }) },
  { tema: ['pronost', 'reorden', 'anomal', 'prediccion', 'inteligencia', 'ia'], r: () => ({ texto: 'IA NEXORA pronostica la demanda de 30 días (regresión lineal + estacionalidad + promedio móvil), calcula el punto de reorden con stock de seguridad (95 %) y detecta movimientos atípicos con z-score. Necesita algunas semanas de ventas registradas.', ir: { pagina: 'ia', label: 'Ir a IA NEXORA' } }) },
  { tema: ['vaciar', 'borrar todo', 'de cero', 'en blanco'], r: () => ({ texto: 'Configuración → Mis datos → "Vaciar inventario" borra productos, movimientos y órdenes (conserva usuarios, proveedores y empresa). Descargue un respaldo antes.' }) },
  { tema: ['presentacion', 'pantalla completa'], r: () => ({ texto: 'Botón "Presentación" en la barra superior: pantalla completa, letra más grande y sin menús. Esc para salir.' }) },
  { tema: ['modo oscuro', 'modo claro', 'tema', 'color'], r: () => ({ texto: 'El botón del sol o la luna en la barra superior cambia entre modo oscuro y claro.' }) },
  { tema: ['buscar', 'ctrl', 'encontrar'], r: () => ({ texto: 'Pulse Ctrl + K (⌘ + K en Mac) para abrir el buscador global de páginas, productos y pestañas del análisis.' }) },
  { tema: ['defensa', 'asesor', 'sustentacion', 'practicar'], r: () => ({ texto: 'El Asesor económico está en Análisis económico → pestaña «Asesor». Responda preguntas como «¿me conviene reemplazar?» o «¿qué pasa si la TMAR sube?» y le contesta con los números y fórmulas de su evaluación.', ir: { pagina: 'economico', label: 'Ir al Asesor', tab: 'asesor' } }) },
]

function puntuar(q: string, it: Intencion) {
  const t = it.tema.filter((k) => has(q, k)).length
  if (!t) return 0
  return 2 + t * 0.5 + (it.accion?.filter((k) => has(q, k)).length ?? 0)
}

export function asistente(pregunta: string, c: Ctx): Resp {
  const q = normalizar(pregunta).replace(/\s+/g, ' ').trim()
  if (!q) return { texto: 'Escriba su pregunta.', sugerencias: SUGERENCIAS }
  // 1) consultas de datos  2) cómo usar el sistema  3) análisis económico
  const mejor = (lista: Intencion[]) => lista.map((it) => ({ it, s: puntuar(q, it) })).sort((a, b) => b.s - a.s)[0]
  const d = mejor(DATOS), a = mejor(AYUDA)
  const esPregCompo = /\b(como|donde|pasos)\b/.test(q)
  if (d.s && (!a.s || (!esPregCompo && d.s >= a.s))) return d.it.r(c, q)
  if (a.s) return a.it.r(c, q)
  const e = responderEcon(pregunta, c.p)
  if (e && c.hayEval === false) return { texto: 'Para responder con números, primero cree una evaluación en Análisis económico: ingrese lo que tiene hoy, la alternativa y cuánto invertiría.', ir: { pagina: 'economico', label: 'Crear una evaluación' } }
  if (e) return { texto: e.respuesta.texto, ir: { pagina: 'economico', label: 'Ver en Análisis económico', tab: e.respuesta.tab } }
  const R = F.reemplazo(c.p)
  return { texto: `No entendí la pregunta. Pruebe con otras palabras o elija una sugerencia.\n(Dato rápido: el análisis económico indica ${R.veredicto}, ahorro ${money(F.ahorroAnual(c.p))}/año, TIR ${pct(F.indicadores(c.p).TIR, 1)}, VPN ${money(F.indicadores(c.p).VPN)}, recuperación ${num(F.indicadores(c.p).recSimple)} años.)`, sugerencias: SUGERENCIAS }
}
