import { useMemo, useState } from 'react'
import { CheckCircle2, Plus, Search, Trash2, Wrench, X } from 'lucide-react'
import { useApp, rolesDe } from '../../store/useApp'
import { CANALES, type EstadoVenta } from '../../data/base'
import { Badge, Button, Campo, Card, MontoInput, NumInput, Scroll, cx } from '../../components/ui'
import { fecha, money, num, plural } from '../../lib/format'
import { etiquetaProducto } from '../../lib/inventario'
import { EDITAN, MESES, anios, enPeriodo, fechaVenta, filasVentas, hoyISO } from '../../lib/resumen'
import { pedirEliminar } from '../../components/Eliminacion'

/** Línea del formulario: un producto del inventario o un servicio u otro ingreso (concepto libre, sin stock). */
interface Linea { k: number; productoId: string; cantidad: number; precio: number; servicio?: boolean; concepto?: string; costo?: number }
const TONO: Record<EstadoVenta, 'verde' | 'ambar' | 'gris'> = { Pagada: 'verde', 'Por cobrar': 'ambar', Anulada: 'gris' }
/** Día local (AAAA-MM-DD) de una fecha ISO. */
const diaDe = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
let sig = 1
const linea = (): Linea => ({ k: sig++, productoId: '', cantidad: 1, precio: 0 })
const servicio = (): Linea => ({ k: sig++, productoId: '', cantidad: 1, precio: 0, servicio: true, concepto: '', costo: 0 })

export default function TabVentas() {
  const { productos, movimientos, ventas, gastos, cierres, sucursales, sucursal, usuario, registrarVenta, cambiarEstadoVenta, anularVenta, eliminarVenta } = useApp()
  const puede = !!usuario && rolesDe(usuario).some((r) => EDITAN.includes(r))
  // Formulario de la venta
  const [suc, setSuc] = useState(sucursal !== 'TODAS' ? sucursal : sucursales[0]?.id ?? '')
  const [lineas, setLineas] = useState<Linea[]>([linea()])
  const [dia, setDia] = useState(hoyISO())
  const [descuento, setDescuento] = useState(0)
  const [canal, setCanal] = useState(CANALES[0])
  const [estado, setEstado] = useState<Exclude<EstadoVenta, 'Anulada'>>('Pagada')
  const [cliente, setCliente] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  // Filtros del historial
  const [q, setQ] = useState(''), [fAnio, setFAnio] = useState(0), [fMes, setFMes] = useState(-1), [fCanal, setFCanal] = useState(''), [fEstado, setFEstado] = useState('')

  const prod = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const set = (k: number, c: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.k === k ? { ...l, ...c } : l)))
  const elegir = (k: number, id: string) => set(k, { productoId: id, precio: prod.get(id)?.precio ?? 0 })

  // Recibo en vivo
  const validas = lineas.filter((l) => (l.servicio ? l.concepto?.trim() : l.productoId) && l.cantidad > 0)
  const subtotal = validas.reduce((a, l) => a + l.cantidad * l.precio, 0)
  const desc = Math.min(Math.max(0, descuento), subtotal), total = subtotal - desc
  const costo = validas.reduce((a, l) => a + l.cantidad * (l.servicio ? l.costo ?? 0 : prod.get(l.productoId)?.costo ?? 0), 0)
  const pide = new Map<string, number>()
  for (const l of validas) if (!l.servicio) pide.set(l.productoId, (pide.get(l.productoId) ?? 0) + l.cantidad)
  const faltan = [...pide].filter(([id, n]) => (prod.get(id)?.stock[suc] ?? 0) < n).map(([id]) => `${prod.get(id)?.nombre} (hay ${prod.get(id)?.stock[suc] ?? 0} u en ${suc})`)

  const guardar = () => {
    if (!suc) return setMsg({ ok: false, t: 'Primero cree una sucursal en Configuración.' })
    const e = registrarVenta({ fecha: fechaVenta(dia), sucursal: suc, lineas: validas.map((l) => (l.servicio ? { productoId: '', concepto: l.concepto!.trim(), cantidad: l.cantidad, precio: l.precio, costo: l.costo ?? 0 } : { productoId: l.productoId, cantidad: l.cantidad, precio: l.precio })), descuento: desc, cliente, canal, estado })
    if (e) return setMsg({ ok: false, t: e })
    setMsg({ ok: true, t: `Venta registrada por ${money(total)}.${pide.size ? ' El stock ya se descontó en Inventario.' : ' Ya suma en sus ventas y en el Resumen.'}` })
    setLineas([linea()]); setDescuento(0); setCliente('')
  }

  const d = useMemo(() => {
    const todas = filasVentas(ventas, movimientos, productos).filter((f) => sucursal === 'TODAS' || f.sucursal === sucursal)
    const hoy = todas.filter((f) => f.estado !== 'Anulada' && diaDe(f.fecha) === hoyISO())
    const clientes = new Map<string, { nombre: string; compras: number; total: number; debe: number; ultima: string }>()
    for (const v of ventas) {
      if (v.estado === 'Anulada' || !v.cliente || (sucursal !== 'TODAS' && v.sucursal !== sucursal)) continue
      const k = v.cliente.toLowerCase(), c = clientes.get(k) ?? { nombre: v.cliente, compras: 0, total: 0, debe: 0, ultima: v.fecha }
      c.compras++; c.total += v.total; if (v.estado === 'Por cobrar') c.debe += v.total; if (v.fecha > c.ultima) c.ultima = v.fecha
      clientes.set(k, c)
    }
    return {
      todas, hoy: { total: hoy.reduce((a, f) => a + f.total, 0), ganancia: hoy.reduce((a, f) => a + f.ganancia, 0), unidades: hoy.reduce((a, f) => a + f.unidades, 0), n: hoy.length },
      clientes: [...clientes.values()].sort((a, b) => b.total - a.total),
    }
  }, [ventas, movimientos, productos, sucursal])

  const t = q.trim().toLowerCase()
  const lista = d.todas.filter((f) => (!t || `${f.id} ${f.cliente} ${f.detalle} ${f.codigos}`.toLowerCase().includes(t)) && (!fAnio || enPeriodo(f.fecha, fAnio, fMes)) && (!fCanal || f.canal === fCanal) && (!fEstado || f.estado === fEstado))
  const activas = lista.filter((f) => f.estado !== 'Anulada')
  const nombresClientes = [...new Set(ventas.map((v) => v.cliente).filter(Boolean))]

  return (
    <div className="space-y-5">
      {puede && <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card titulo="Agregar venta" className="xl:col-span-3">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted">Productos y servicios de esta venta</div>
              {lineas.map((l) => {
                const p = prod.get(l.productoId)
                const quitar = <button aria-label="Quitar" className="mb-0.5 self-end rounded-lg p-2 text-muted hover:bg-fg/10 disabled:opacity-30" disabled={lineas.length === 1} onClick={() => setLineas(lineas.filter((x) => x.k !== l.k))}><X size={15} /></button>
                const etiqueta = (t: string) => <span className="mb-0.5 block text-[11px] text-muted">{t}</span>
                // Servicio, trabajo u otro ingreso: qué fue, cuánto le pagaron y (si quiere) cuánto le costó
                if (l.servicio) return (
                  <div key={l.k} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-primario/25 bg-primario/[.04] p-2.5">
                    <label className="col-span-3 block">{etiqueta('¿Qué trabajo o servicio fue?')}
                      <div className="relative"><Wrench size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primario" /><input className="inp pl-8" placeholder="Ej.: instalación, reparación, asesoría, confección" value={l.concepto ?? ''} onChange={(e) => set(l.k, { concepto: e.target.value })} /></div></label>
                    <label className="block min-w-0">{etiqueta('¿Cuánto le pagaron? ($)')}<MontoInput value={l.precio} onChange={(v) => set(l.k, { precio: v, cantidad: 1 })} /></label>
                    <label className="block min-w-0">{etiqueta('¿Cuánto le costó? (opcional)')}<MontoInput value={l.costo ?? 0} onChange={(v) => set(l.k, { costo: v })} placeholder="Materiales, transporte…" /></label>
                    {quitar}
                    <p className="col-span-3 text-[11px] text-muted">No descuenta inventario. Suma en sus ventas y su ganancia: {money(l.precio - (l.costo ?? 0))}.</p>
                  </div>)
                return (
                  <div key={l.k} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-fg/5 pb-2 last:border-0 sm:grid-cols-[1fr_5.5rem_7rem_auto] sm:border-0 sm:pb-0">
                    <label className="col-span-3 block min-w-0 sm:col-span-1">{etiqueta('Producto')}<select className="inp" value={l.productoId} onChange={(e) => elegir(l.k, e.target.value)}>
                      <option value="">Elija un producto…</option>
                      {productos.map((x) => <option key={x.id} value={x.id} disabled={(x.stock[suc] ?? 0) <= 0}>{x.sku} · {etiquetaProducto(x)} ({x.stock[suc] ?? 0} u)</option>)}
                    </select></label>
                    <label className="block min-w-0">{etiqueta('Cantidad')}<NumInput min={1} value={l.cantidad} onChange={(v) => set(l.k, { cantidad: Math.max(0, Math.round(v)) })} /></label>
                    <label className="block min-w-0">{etiqueta('Precio c/u ($)')}<MontoInput value={l.precio} onChange={(v) => set(l.k, { precio: v })} /></label>
                    {quitar}
                    {p && <div className="col-span-3 -mt-1 text-[11px] text-muted sm:col-span-4">Precio de lista {money(p.precio)} · subtotal {money(l.cantidad * l.precio)}</div>}
                  </div>)
              })}
              <div className="flex flex-wrap gap-2">
                <Button className="text-xs" onClick={() => setLineas([...lineas, linea()])}><Plus size={14} />Agregar otro producto</Button>
                <Button className="text-xs" onClick={() => setLineas([...lineas.filter((x) => x.servicio || x.productoId), servicio()])}><Wrench size={14} />Agregar servicio u otro ingreso</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Campo label="Sucursal"><select className="inp" value={suc} onChange={(e) => setSuc(e.target.value)}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.ciudad}</option>)}</select></Campo>
              <Campo label="Fecha"><input type="date" className="inp" value={dia} max={hoyISO()} onChange={(e) => setDia(e.target.value || hoyISO())} /></Campo>
              <Campo label="Descuento total ($)"><MontoInput value={descuento} onChange={setDescuento} /></Campo>
              <Campo label="Canal"><select className="inp" value={canal} onChange={(e) => setCanal(e.target.value)}>{CANALES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
              <Campo label="Estado"><select className="inp" value={estado} onChange={(e) => setEstado(e.target.value as 'Pagada' | 'Por cobrar')}><option>Pagada</option><option value="Por cobrar">Por cobrar (fiado)</option></select></Campo>
              <Campo label="Cliente"><input className="inp" list="clientesNegocio" placeholder="Nombre o @usuario" value={cliente} onChange={(e) => setCliente(e.target.value)} /></Campo>
            </div>
            <datalist id="clientesNegocio">{nombresClientes.map((c) => <option key={c} value={c} />)}</datalist>
            <Button variante="primario" className="w-full py-2.5" disabled={!validas.length || faltan.length > 0} onClick={guardar}>Registrar venta · {money(total)}</Button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-primario/30" titulo={<span className="flex w-full justify-between gap-2">Resumen de la venta<span className="font-normal text-muted">{fecha(`${dia}T12:00:00`)}</span></span>}>
          <ul className="space-y-1.5 text-sm">{validas.map((l) => <li key={l.k} className="flex justify-between gap-3"><span className="truncate">{l.servicio ? `${l.concepto?.trim()} (servicio)` : `${prod.get(l.productoId)?.nombre} × ${l.cantidad}`}</span><span className="tnum">{money(l.cantidad * l.precio)}</span></li>)}
            {!validas.length && <li className="text-muted">Elija un producto o agregue un servicio para empezar.</li>}</ul>
          <div className="mt-3 space-y-1.5 border-t border-dashed border-fg/15 pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="tnum">{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Descuento</span><span className="tnum">−{money(desc)}</span></div>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-fg/15 pt-3"><span className="font-semibold">Total</span><span className="texto-oro font-display text-3xl font-bold tnum">{money(total)}</span></div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted">Costo (productos y servicios)</span><span className="tnum">{money(costo)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Su ganancia</span><b className={cx('tnum', total - costo < 0 ? 'text-peligro' : 'text-exito')}>{money(total - costo)}</b></div>
            <div className="flex justify-between"><span className="text-muted">Cliente</span><span>{cliente.trim() || '—'}</span></div>
          </div>
          {faltan.length > 0 && <p className="mt-3 rounded-lg bg-peligro/10 px-3 py-2 text-xs text-peligro">Stock insuficiente: {faltan.join(', ')}</p>}
          {msg && <p className={cx('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs', msg.ok ? 'bg-exito/10 text-exito' : 'bg-peligro/10 text-peligro')}>{msg.ok && <CheckCircle2 size={14} />}{msg.t}</p>}
        </Card>
      </div>}

      <Card titulo="Hoy" accion={<span className="text-xs text-muted">{fecha(new Date().toISOString())}</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">{([['Ventas de hoy', money(d.hoy.total)], ['Ganancia de hoy', money(d.hoy.ganancia)], ['Unidades vendidas', num(d.hoy.unidades, 0)], ['Ventas registradas', num(d.hoy.n, 0)]] as const).map(([a, b]) => (
          <div key={a} className="rounded-xl bg-fg/5 p-3"><div className="text-xs text-muted">{a}</div><div className="text-xl font-bold tnum">{b}</div></div>))}</div>
      </Card>

      <Card titulo="Clientes" accion={<span className="text-xs text-muted">Se guardan solos con cada venta. Toque uno para ver sus compras.</span>}>
        <div className="flex flex-wrap gap-2">{d.clientes.slice(0, 24).map((c) => (
          <button key={c.nombre} onClick={() => { setQ(c.nombre); setFAnio(0) }} className={cx('rounded-xl border px-3 py-2 text-left text-xs transition hover:border-primario/50', q === c.nombre ? 'border-primario/60 bg-primario/10' : 'border-fg/10 bg-fg/5')}>
            <div className="font-semibold">{c.nombre}</div><div className="text-muted">{plural(c.compras, 'compra', 'compras')} · {money(c.total)}</div>{c.debe > 0 && <div className="text-alerta">Debe {money(c.debe)}</div>}
          </button>))}
          {!d.clientes.length && <p className="text-sm text-muted">Escriba el nombre del cliente al registrar una venta y aparecerá aquí.</p>}</div>
      </Card>

      <Card titulo="Todas las ventas">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[14rem] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" type="search" placeholder="Buscar cliente, producto o código…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="inp w-auto" aria-label="Año" value={fAnio} onChange={(e) => setFAnio(+e.target.value)}><option value={0}>Todos los años</option>{anios(movimientos, gastos, cierres).map((y) => <option key={y}>{y}</option>)}</select>
          <select className="inp w-auto" aria-label="Mes" value={fMes} disabled={!fAnio} onChange={(e) => setFMes(+e.target.value)}><option value={-1}>Todos los meses</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          <select className="inp w-auto" aria-label="Canal" value={fCanal} onChange={(e) => setFCanal(e.target.value)}><option value="">Todos los canales</option>{[...CANALES, 'Inventario'].map((c) => <option key={c}>{c}</option>)}</select>
          <select className="inp w-auto" aria-label="Estado" value={fEstado} onChange={(e) => setFEstado(e.target.value)}><option value="">Todos los estados</option><option>Pagada</option><option>Por cobrar</option><option>Anulada</option></select>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">{([['Total vendido', money(activas.reduce((a, f) => a + f.total, 0))], ['Ganancia', money(activas.reduce((a, f) => a + f.ganancia, 0))], ['Unidades', num(activas.reduce((a, f) => a + f.unidades, 0), 0)], ['Por cobrar', money(activas.filter((f) => f.estado === 'Por cobrar').reduce((a, f) => a + f.total, 0))]] as const).map(([a, b]) => (
          <div key={a} className="rounded-xl bg-fg/5 p-3"><div className="text-xs text-muted">{a}</div><div className="text-lg font-bold tnum">{b}</div></div>))}</div>
        <Scroll><table className="tabla">
          <thead><tr><th>N.º</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Sucursal</th><th>Canal</th><th>Estado</th><th className="num">Total</th><th className="num">Ganancia</th>{puede && <th></th>}</tr></thead>
          <tbody>{lista.slice(0, 300).map((f) => (
            <tr key={f.key} className={cx(f.estado === 'Anulada' && 'opacity-50')}>
              <td className="font-mono text-xs">{f.id}</td><td>{fecha(f.fecha)}</td><td>{f.cliente || <span className="text-muted">—</span>}</td>
              <td className="max-w-[18rem] truncate" title={f.detalle}>{f.detalle}</td><td>{f.sucursal}</td><td>{f.canal}</td><td><Badge tono={TONO[f.estado]}>{f.estado}</Badge></td>
              <td className={cx('num font-semibold', f.estado === 'Anulada' && 'line-through')}>{money(f.total)}</td><td className="num">{money(f.ganancia)}</td>
              {puede && <td className="whitespace-nowrap text-right">{f.venta && f.estado !== 'Anulada' && <>
                <Button variante="fantasma" className="px-2 py-1 text-xs" onClick={() => cambiarEstadoVenta(f.id, f.estado === 'Pagada' ? 'Por cobrar' : 'Pagada')}>{f.estado === 'Pagada' ? 'Por cobrar' : 'Cobrada'}</Button>
                <Button variante="fantasma" className="px-2 py-1 text-xs text-peligro" onClick={() => pedirEliminar({ titulo: `¿Anular la venta ${f.id}?`, detalle: `${money(f.total)}. El stock regresa a ${f.sucursal}.`, boton: 'Anular', listo: `Venta ${f.id} anulada`, accion: () => anularVenta(f.id) })}><X size={13} />Anular</Button></>}
                <button aria-label="Eliminar venta" title="Eliminar venta" className="rounded-lg p-1.5 text-peligro hover:bg-peligro/10" onClick={() => pedirEliminar(f.venta
                  ? { titulo: `¿Eliminar la venta ${f.id}?`, detalle: `${money(f.total)}${f.estado !== 'Anulada' && f.unidades ? `. El stock regresa a ${f.sucursal}` : ''}. Deja de contar en sus ventas y queda en la Papelera por si la necesita.`, listo: `Venta ${f.id} eliminada`, accion: () => eliminarVenta(f.id) }
                  : { titulo: '¿Eliminar esta venta de Inventario?', detalle: `${f.detalle} · ${money(f.total)}. El stock regresa a ${f.sucursal}.`, listo: 'Venta eliminada', accion: () => eliminarVenta(f.key) })}><Trash2 size={14} /></button></td>}
            </tr>))}
            {!lista.length && <tr><td colSpan={10} className="py-6 text-center text-muted">{d.todas.length ? 'Ninguna venta coincide con los filtros.' : 'Todavía no hay ventas.'}</td></tr>}
          </tbody>
        </table></Scroll>
        {lista.length > 300 && <p className="mt-2 text-[11px] text-muted">Se muestran las 300 más recientes de {lista.length}. Use los filtros o exporte en la pestaña Datos.</p>}
        <p className="mt-2 text-[11px] text-muted">Las ventas registradas una por una en Inventario aparecen con el canal «Inventario».</p>
      </Card>
    </div>
  )
}
