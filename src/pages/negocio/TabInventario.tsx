import { useMemo, useState } from 'react'
import { ArrowRight, Plus, Search, Tag } from 'lucide-react'
import { useApp, rolesDe } from '../../store/useApp'
import type { Producto } from '../../data/base'
import { categoriasPara } from '../../lib/sectores'
import { tiposDe } from '../../data/categorias'
import { Badge, Button, Campo, Card, Modal, MontoInput, NumInput, Scroll, cx } from '../../components/ui'
import { money, num, pct, plural } from '../../lib/format'
import { etiquetaProducto, stockTotal, usaVencimiento, valorInventario, venceSugerido } from '../../lib/inventario'
import { EDITAN, estadoStock, statsProductos, type EstadoStock } from '../../lib/resumen'
import { BarraPeriodo, EstadoCierre } from '../../components/BarraPeriodo'

const TONO: Record<EstadoStock, 'verde' | 'ambar' | 'rojo'> = { OK: 'verde', 'Stock bajo': 'ambar', Agotado: 'rojo' }
const r2 = (v: number) => Math.round(v * 100) / 100

/** Ganancia y margen del precio, y calculadora: precio sugerido = costo ÷ (1 − margen que quiere). */
function Calculadora({ costo, precio, onPrecio }: { costo: number; precio: number; onPrecio: (v: number) => void }) {
  const [m, setM] = useState('')
  const g = precio - costo
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-fg/5 p-3 text-sm sm:grid-cols-3">
      <div><div className="text-xs text-muted">Ganancia por unidad</div><b className={cx('tnum', g < 0 && 'text-peligro')}>{money(g)}</b></div>
      <div><div className="text-xs text-muted">Margen</div><b className="tnum">{pct(precio ? g / precio : 0, 1)}</b></div>
      <Campo label="Margen que quiere (%)"><input className="inp" inputMode="decimal" placeholder="Ej. 50" value={m}
        onChange={(e) => { setM(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); if (v >= 0 && v < 95 && costo > 0) onPrecio(r2(costo / (1 - v / 100))) }} /></Campo>
    </div>
  )
}

interface Nuevo { sku: string; nombre: string; categoria: string; tipo: string; sucursal: string; stock: number; min: number; costo: number; precio: number }

export default function TabInventario() {
  const { productos, movimientos, sucursales, sucursal, usuario, empresa, guardarProducto, ir } = useApp()
  const puede = !!usuario && rolesDe(usuario).some((r) => EDITAN.includes(r))
  const [q, setQ] = useState(''), [cat, setCat] = useState(''), [est, setEst] = useState('')
  const [nuevo, setNuevo] = useState<Nuevo | null>(null)
  const [precio, setPrecio] = useState<Producto | null>(null)
  const [error, setError] = useState('')

  const d = useMemo(() => {
    const stats = statsProductos(movimientos, productos, sucursal)
    const filas = productos.map((p) => {
      const s = stats.get(p.id) ?? { vendidas: 0, ingresos: 0, ganancia: 0 }, stock = stockTotal(p, sucursal)
      return { p, stock, valor: stock * p.costo, estado: estadoStock(p, sucursal), gu: p.precio - p.costo, ...s }
    })
    const porCat = [...new Set(productos.map((p) => p.categoria))].sort().map((c) => {
      const fs = filas.filter((f) => f.p.categoria === c)
      return { c, n: fs.length, stock: fs.reduce((a, f) => a + f.stock, 0), valor: fs.reduce((a, f) => a + f.valor, 0), vendidas: fs.reduce((a, f) => a + f.vendidas, 0), ganancia: fs.reduce((a, f) => a + f.ganancia, 0) }
    })
    return { filas, porCat }
  }, [productos, movimientos, sucursal])

  const t = q.trim().toLowerCase()
  const lista = d.filas.filter((f) => (!t || `${f.p.sku} ${etiquetaProducto(f.p)} ${f.p.categoria} ${f.p.tipo ?? ''}`.toLowerCase().includes(t)) && (!cat || f.p.categoria === cat) && (!est || f.estado === est))
  const categorias = [...new Set([...categoriasPara(empresa.sector), ...productos.map((p) => p.categoria)])]

  const abrirNuevo = () => { setError(''); setNuevo({ sku: '', nombre: '', categoria: '', tipo: '', sucursal: sucursal !== 'TODAS' ? sucursal : sucursales[0]?.id ?? '', stock: 0, min: 10, costo: 0, precio: 0 }) }
  const crear = () => {
    if (!nuevo) return
    const sku = nuevo.sku.trim().toUpperCase()
    if (!sku) return setError('Escriba un código (SKU), por ejemplo CAM-001.')
    if (productos.some((p) => p.sku.toUpperCase() === sku)) return setError(`Ya existe un producto con el código ${sku}.`)
    if (!nuevo.nombre.trim()) return setError('Escriba el nombre del producto.')
    if (!nuevo.sucursal) return setError('Elija la sucursal donde entra el stock.')
    if (nuevo.stock < 0 || !Number.isInteger(nuevo.stock)) return setError('El stock inicial debe ser un número entero de 0 o más.')
    if (nuevo.costo < 0 || nuevo.precio < 0) return setError('El costo y el precio no pueden ser negativos.')
    guardarProducto({
      id: `P${Date.now()}`, sku, nombre: nuevo.nombre.trim(), categoria: nuevo.categoria.trim() || 'General', tipo: nuevo.tipo.trim() || undefined, costo: r2(nuevo.costo), precio: r2(nuevo.precio),
      // Solo la sucursal elegida: las demás "no lo manejan" (no cuentan como agotadas). Con transferencias o compras se agrega a otras.
      stock: { [nuevo.sucursal]: nuevo.stock }, min: Math.max(0, nuevo.min), max: Math.max(nuevo.min, 100),
      lote: '', vence: usaVencimiento(nuevo.categoria, nuevo.tipo) ? venceSugerido() : '', proveedorId: '', // ropa, tecnología…: sin vencimiento
    })
    setNuevo(null)
  }
  const guardarPrecio = () => {
    if (!precio) return
    if (precio.costo < 0 || precio.precio < 0) return setError('El costo y el precio no pueden ser negativos.')
    guardarProducto({ ...precio, costo: r2(precio.costo), precio: r2(precio.precio) })
    setPrecio(null)
  }

  return (
    <div className="space-y-5">
      {/* Año, mes y cierre: los mismos de Operación → Inventario y del Resumen */}
      <div className="flex flex-wrap items-center justify-between gap-2"><EstadoCierre /><BarraPeriodo /></div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{plural(lista.length, 'producto', 'productos')} · {num(lista.reduce((a, f) => a + f.stock, 0), 0)} unidades · {money(lista.reduce((a, f) => a + f.valor, 0))} en stock. <span className="text-primario">Es el mismo inventario de NEXORA.</span></p>
        <div className="flex flex-wrap gap-2">
          {puede && <Button variante="primario" onClick={abrirNuevo} disabled={!sucursales.length} title={sucursales.length ? '' : 'Primero cree una sucursal en Configuración'}><Plus size={15} />Agregar inventario</Button>}
          {puede && <Button onClick={() => { setError(''); setPrecio(productos[0] ?? null) }} disabled={!productos.length}><Tag size={15} />Agregar precio</Button>}
          <Button onClick={() => ir('productos')}>Kardex, compras y transferencias<ArrowRight size={14} /></Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" type="search" placeholder="Buscar código, nombre o categoría…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp w-auto" aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas las categorías</option>{[...new Set(productos.map((p) => p.categoria))].sort().map((c) => <option key={c}>{c}</option>)}</select>
        <select className="inp w-auto" aria-label="Estado" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos los estados</option><option>OK</option><option>Stock bajo</option><option>Agotado</option></select>
      </div>

      <Card>
        <Scroll><table className="tabla">
          <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th className="num">Stock</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Ganancia / u</th><th className="num">Margen</th><th className="num">Vendidas</th><th className="num">Ganancia generada</th><th className="num">Valor stock</th><th>Estado</th>{puede && <th></th>}</tr></thead>
          <tbody>{lista.map((f) => (
            <tr key={f.p.id}>
              <td className="font-mono text-xs">{f.p.sku}</td><td className="max-w-[16rem] truncate font-medium" title={etiquetaProducto(f.p)}>{etiquetaProducto(f.p)}</td><td className="text-muted">{f.p.categoria}{f.p.tipo && <div className="text-xs">{f.p.tipo}</div>}</td>
              <td className="num font-semibold">{num(f.stock, 0)}</td><td className="num">{money(f.p.costo)}</td><td className="num">{money(f.p.precio)}</td>
              <td className={cx('num', f.gu < 0 && 'text-peligro')}>{money(f.gu)}</td><td className="num">{pct(f.p.precio ? f.gu / f.p.precio : 0, 0)}</td>
              <td className="num">{num(f.vendidas, 0)}</td><td className="num">{money(f.ganancia)}</td><td className="num">{money(f.valor)}</td>
              <td><Badge tono={TONO[f.estado]}>{f.estado}</Badge></td>
              {puede && <td><Button variante="fantasma" className="px-2 py-1 text-xs" onClick={() => { setError(''); setPrecio(f.p) }}>Precio</Button></td>}
            </tr>))}
            {!lista.length && <tr><td colSpan={13} className="py-6 text-center text-muted">{productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos. Pulse «Agregar inventario».'}</td></tr>}
          </tbody>
        </table></Scroll>
        <p className="mt-2 text-[11px] text-muted">Stock {sucursal === 'TODAS' ? 'de todas las sucursales' : `de la sucursal ${sucursal}`} (cámbielo arriba). Ganancia generada = unidades vendidas × (precio de venta − costo). Stock bajo = menos de un tercio del mínimo.</p>
      </Card>

      <Card titulo="Resumen por categoría" accion={<span className="text-xs text-muted">Valor del stock: {money(valorInventario(productos, sucursal))}</span>}>
        <Scroll><table className="tabla">
          <thead><tr><th>Categoría</th><th className="num">Productos</th><th className="num">Stock</th><th className="num">Valor del stock</th><th className="num">Vendidas</th><th className="num">Ganancia generada</th></tr></thead>
          <tbody>{d.porCat.map((c) => <tr key={c.c}><td className="font-medium">{c.c}</td><td className="num">{c.n}</td><td className="num">{num(c.stock, 0)}</td><td className="num">{money(c.valor)}</td><td className="num">{num(c.vendidas, 0)}</td><td className="num font-semibold">{money(c.ganancia)}</td></tr>)}
            {!d.porCat.length && <tr><td colSpan={6} className="py-6 text-center text-muted">Sin productos.</td></tr>}
          </tbody>
        </table></Scroll>
      </Card>

      <Modal abierto={!!nuevo} onClose={() => setNuevo(null)} titulo="Agregar inventario" ancho="max-w-2xl">
        {nuevo && <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo label="Código (único)"><input className="inp uppercase" placeholder="CAM-001" value={nuevo.sku} onChange={(e) => setNuevo({ ...nuevo, sku: e.target.value })} /></Campo>
            <div className="sm:col-span-2"><Campo label="Nombre del producto"><input className="inp" placeholder="Camiseta negra talla M" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Campo></div>
            <Campo label="Categoría"><input className="inp" list="categoriasNegocio" placeholder={categorias[0]} value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} /></Campo>
            <Campo label="Tipo (opcional)"><input className="inp" list="tiposNegocio" placeholder={tiposDe(nuevo.categoria)[0] ?? ''} value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} /></Campo>
            <Campo label="Sucursal donde entra"><select className="inp" value={nuevo.sucursal} onChange={(e) => setNuevo({ ...nuevo, sucursal: e.target.value })}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.ciudad}</option>)}</select></Campo>
            <Campo label="Stock inicial"><NumInput min={0} value={nuevo.stock} onChange={(v) => setNuevo({ ...nuevo, stock: v })} /></Campo>
            <Campo label="Costo unitario"><MontoInput value={nuevo.costo} onChange={(v) => setNuevo({ ...nuevo, costo: v })} /></Campo>
            <Campo label="Precio de venta"><MontoInput value={nuevo.precio} onChange={(v) => setNuevo({ ...nuevo, precio: v })} /></Campo>
            <Campo label="Stock mínimo" ayuda="Para avisar cuando queda poco"><NumInput min={0} value={nuevo.min} onChange={(v) => setNuevo({ ...nuevo, min: v })} /></Campo>
          </div>
          <datalist id="categoriasNegocio">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="tiposNegocio">{tiposDe(nuevo.categoria).map((t) => <option key={t} value={t} />)}</datalist>
          <Calculadora costo={nuevo.costo} precio={nuevo.precio} onPrecio={(v) => setNuevo({ ...nuevo, precio: v })} />
          <p className="text-xs text-muted">El producto aparece también en Inventario de NEXORA, con su «Saldo inicial» en el kardex.</p>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <div className="flex justify-end gap-2"><Button onClick={() => setNuevo(null)}>Cancelar</Button><Button variante="primario" onClick={crear}>Agregar al inventario</Button></div>
        </div>}
      </Modal>

      <Modal abierto={!!precio} onClose={() => setPrecio(null)} titulo="Agregar precio" ancho="max-w-xl">
        {precio && <div className="space-y-4">
          <Campo label="Producto"><select className="inp" value={precio.id} onChange={(e) => { const p = productos.find((x) => x.id === e.target.value); if (p) setPrecio(p) }}>{productos.map((p) => <option key={p.id} value={p.id}>{p.sku} · {etiquetaProducto(p)}</option>)}</select></Campo>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Costo unitario"><MontoInput value={precio.costo} onChange={(v) => setPrecio({ ...precio, costo: v })} /></Campo>
            <Campo label="Precio de venta"><MontoInput value={precio.precio} onChange={(v) => setPrecio({ ...precio, precio: v })} /></Campo>
          </div>
          <Calculadora key={precio.id} costo={precio.costo} precio={precio.precio} onPrecio={(v) => setPrecio({ ...precio, precio: v })} />
          <p className="text-xs text-muted">Las ventas ya registradas conservan el precio con el que se vendieron.</p>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <div className="flex justify-end gap-2"><Button onClick={() => setPrecio(null)}>Cancelar</Button><Button variante="primario" onClick={guardarPrecio}>Guardar precio</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
