import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Barcode, FileSpreadsheet, History, Pencil, Plus, Printer, Search, Trash2, PackageMinus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { useApp, soloLectura as esSoloLectura } from '../store/useApp'
import { Badge, Button, Campo, Card, Modal, MontoInput, NumInput, Scroll, Titulo } from '../components/ui'
import { money, fecha, fechaHora, num } from '../lib/format'
import { COLORES, CUELLOS, diasParaVencer, enQuiebre, esPrenda, etiquetaProducto, kardex, stockTotal, tallasDe, usaCuello, usaVencimiento, venceSugerido } from '../lib/inventario'
import type { Producto, Sucursal, SucursalId } from '../data/base'
import { tiposDe } from '../data/categorias'
import type { TipoOperacion } from '../store/useApp'
import { exportarTabla } from '../lib/export'
import { categoriasPara } from '../lib/sectores'
import { BarraPeriodo, EstadoCierre } from '../components/BarraPeriodo'
import { pedirEliminar } from '../components/Eliminacion'

const vacio = (sucs: Sucursal[], categoria: string): Producto => ({ id: `P${Date.now()}`, sku: '', nombre: '', categoria, costo: 0, precio: 0, stock: Object.fromEntries(sucs.map((x) => [x.id, 0])), min: 10, max: 100, lote: '', vence: usaVencimiento(categoria) ? venceSugerido() : '', proveedorId: '' })

function CodigoBarras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => { if (ref.current) JsBarcode(ref.current, valor || '0000', { format: 'CODE128', height: 50, fontSize: 12, background: '#ffffff', lineColor: '#0A0907' }) }, [valor])
  return <svg ref={ref} />
}

export default function Productos() {
  const { productos, movimientos, usuario, sucursal, guardarProducto, eliminarProducto, transferir, registrar, proveedores, sucursales: SUCURSALES } = useApp()
  const soloLectura = esSoloLectura(usuario)
  const [q, setQ] = useState(''), [cat, setCat] = useState('Todas')
  const [edit, setEdit] = useState<Producto | null>(null)
  // Prenda nueva: varias tallas a la vez, cada una con su cantidad por sucursal (se crea un producto por talla)
  const [porTalla, setPorTalla] = useState<{ talla: string; stock: Record<SucursalId, number> }[]>([]), [otraTalla, setOtraTalla] = useState('')
  const abrirEdicion = (p: Producto) => { setPorTalla([]); setOtraTalla(''); setEdit(p) }
  const [codigo, setCodigo] = useState<Producto | null>(null)
  const [trans, setTrans] = useState<{ p: Producto; de: SucursalId; a: SucursalId; cant: number; err?: string } | null>(null)
  const [aj, setAj] = useState<{ p: Producto; s: SucursalId; cant: number; tipo: TipoOperacion; nota: string; costo: number; err?: string } | null>(null)
  const [kx, setKx] = useState<{ p: Producto; s: SucursalId | 'TODAS' } | null>(null)
  useEffect(() => { const id = sessionStorage.getItem('nx-p'); if (id) { sessionStorage.removeItem('nx-p'); const p = productos.find((x) => x.id === id); if (p) setKx({ p, s: 'TODAS' }) } }, [productos])

  const suc0 = sucursal === 'TODAS' ? SUCURSALES[0]?.id ?? '' : sucursal
  // Hasta 5 sucursales: una columna por sucursal. Con más: solo la sucursal elegida arriba (o el total).
  const cols = SUCURSALES.length <= 5 ? SUCURSALES.map((x) => x.id) : sucursal !== 'TODAS' ? [sucursal] : []
  const [pag, setPag] = useState(0), POR_PAG = 50
  const sector = useApp((s) => s.empresa.sector)
  const categorias = useMemo(() => [...new Set([...categoriasPara(sector), ...productos.map((p) => p.categoria)])], [productos, sector])
  const lista = useMemo(() => productos.filter((p) => (cat === 'Todas' || p.categoria === cat) && `${p.sku} ${etiquetaProducto(p)} ${p.tipo ?? ''} ${p.lote}`.toLowerCase().includes(q.toLowerCase())), [productos, q, cat])
  const filasK = kx ? kardex(kx.p.id, movimientos, kx.s) : []
  const exportar = (f: 'xlsx' | 'pdf') => exportarTabla('Inventario', ['SKU', 'Producto', 'Categoría', 'Costo', 'Precio', ...SUCURSALES.map((x) => x.id), 'Total', 'Valor', 'Lote', 'Vence'], lista.map((p) => [p.sku, etiquetaProducto(p), p.tipo ? `${p.categoria} · ${p.tipo}` : p.categoria, money(p.costo), money(p.precio), ...SUCURSALES.map((x) => p.stock[x.id] ?? 0), stockTotal(p), money(stockTotal(p) * p.costo), p.lote, p.vence || 'No vence']), f)
  const set = (k: keyof Producto, v: unknown) => edit && setEdit({ ...edit, [k]: v })
  /** Cambia la categoría o el tipo. En un producto nuevo, la fecha de vencimiento se pone o se quita según lo que es (ropa, tecnología… no vencen). */
  const cambiarClase = (categoria: string, tipo: string) => {
    if (!edit) return
    const nuevo = !productos.some((x) => x.id === edit.id)
    setEdit({ ...edit, categoria, tipo, ...(nuevo ? { vence: usaVencimiento(categoria, tipo) ? edit.vence || venceSugerido() : '' } : {}) })
  }

  /** Botones de cada producto (tabla en pantallas anchas y tarjeta en el celular). */
  const acciones = (p: Producto) => <>
    <Button variante="fantasma" className="!p-1.5" title="Kardex" onClick={() => setKx({ p, s: 'TODAS' })}><History size={15} /></Button>
    <Button variante="fantasma" className="!p-1.5" title="Código de barras / QR" onClick={() => setCodigo(p)}><Barcode size={15} /></Button>
    {!soloLectura && <>
      <Button variante="fantasma" className="!p-1.5" title="Transferir" onClick={() => setTrans({ p, de: SUCURSALES[0]?.id ?? '', a: SUCURSALES[1]?.id ?? SUCURSALES[0]?.id ?? '', cant: 1 })}><ArrowLeftRight size={15} /></Button>
      <Button variante="fantasma" className="!p-1.5" title="Registrar venta, compra, ajuste o merma" onClick={() => setAj({ p, s: suc0, cant: 1, tipo: 'Venta', nota: '', costo: p.costo })}><PackageMinus size={15} /></Button>
      <Button variante="fantasma" className="!p-1.5" title="Editar" onClick={() => abrirEdicion(structuredClone(p))}><Pencil size={15} /></Button>
      <Button variante="fantasma" className="!p-1.5 text-peligro" title="Eliminar" onClick={() => pedirEliminar({ titulo: `¿Eliminar ${etiquetaProducto(p)}?`, detalle: 'El producto queda en la Papelera; su kardex se conserva.', listo: `${p.nombre} eliminado`, accion: () => eliminarProducto(p.id) })}><Trash2 size={15} /></Button>
    </>}
  </>

  return (
    <div className="space-y-5">
      <Titulo titulo="Productos e inventario" sub={`${productos.length} productos · ${new Set(productos.map((p) => p.categoria)).size} categorías · ${SUCURSALES.length} sucursales${cols.length < SUCURSALES.length ? ' (elija una sucursal arriba para ver su columna)' : ''}`}>
        <Button onClick={() => exportar('xlsx')}><FileSpreadsheet size={15} />Excel</Button><Button onClick={() => exportar('pdf')}><Printer size={15} />PDF</Button>
        {!soloLectura && productos.length > 0 && <Button onClick={() => setAj({ p: productos[0], s: suc0, cant: 1, tipo: 'Venta', nota: '', costo: productos[0].costo })}><PackageMinus size={15} />Registrar movimiento</Button>}
        {!soloLectura && <Button variante="primario" disabled={!SUCURSALES.length} title={SUCURSALES.length ? '' : 'Primero registre una sucursal en Configuración'} onClick={() => abrirEdicion(vacio(SUCURSALES, categorias[0]))}><Plus size={15} />Nuevo producto</Button>}
      </Titulo>
      {/* Año, mes y cierre: los mismos de Resumen (y del Inventario de Resumen) */}
      <div className="flex flex-wrap items-center justify-between gap-2"><EstadoCierre /><BarraPeriodo /></div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" placeholder="Buscar por SKU, nombre o lote…" value={q} onChange={(e) => { setQ(e.target.value); setPag(0) }} /></div>
          <select className="inp !w-auto" value={cat} onChange={(e) => { setCat(e.target.value); setPag(0) }}><option>Todas</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {/* Celular: cada producto como tarjeta (la tabla completa tiene demasiadas columnas) */}
        <ul className="space-y-2 sm:hidden">{lista.slice(pag * POR_PAG, (pag + 1) * POR_PAG).map((p) => {
          const t = stockTotal(p), vence = diasParaVencer(p) ?? Infinity
          return <li key={p.id} className="rounded-xl border border-fg/10 bg-fg/[.03] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-medium leading-snug">{etiquetaProducto(p)}</div><div className="mt-0.5 text-xs text-muted"><span className="font-mono">{p.sku}</span> · {p.categoria}{p.tipo && ` · ${p.tipo}`}</div></div>
              {enQuiebre(p, sucursal) ? <Badge tono="rojo">Quiebre</Badge> : t > p.max * 3 ? <Badge tono="ambar">Sobrestock</Badge> : <Badge tono="verde">OK</Badge>}
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted">Stock</div><div className="font-semibold tnum">{num(t, 0)} u</div></div>
              <div><div className="text-muted">Precio</div><div className="tnum">{money(p.precio)}</div></div>
              <div><div className="text-muted">Costo</div><div className="tnum">{money(p.costo)}</div></div>
            </div>
            {cols.length > 1 && <div className="mt-2 text-[11px] text-muted tnum">{cols.map((s) => <span key={s} className={(p.stock[s] ?? 0) < p.min / 3 ? 'font-semibold text-peligro' : ''}>{s}: {p.stock[s] ?? 0}</span>).reduce<ReactNode[]>((a, x, k) => (k ? [...a, ' · ', x] : [x]), [])}</div>}
            {p.vence && <div className={`mt-1 text-[11px] ${vence < 60 ? 'text-alerta' : 'text-muted'}`}>Vence: {fecha(p.vence)}</div>}
            <div className="mt-2 flex flex-wrap justify-end gap-1 border-t border-fg/10 pt-2 [&_button]:!p-2.5">{acciones(p)}</div>
          </li>
        })}</ul>
        <div className="hidden sm:block"><Scroll><table className="tabla">
          <thead><tr><th>SKU</th><th>Producto</th><th>Categoría</th><th className="num">Costo</th><th className="num">Precio</th>{cols.map((s) => <th key={s} className="num">{s}</th>)}<th className="num">Total</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>{lista.slice(pag * POR_PAG, (pag + 1) * POR_PAG).map((p) => {
            const t = stockTotal(p), vence = diasParaVencer(p) ?? Infinity
            return <tr key={p.id}>
              <td className="font-mono text-xs text-muted">{p.sku}</td><td className="font-medium">{p.nombre}{(p.color || p.talla || p.cuello) && <div className="text-xs font-normal text-muted">{etiquetaProducto({ nombre: '', color: p.color, talla: p.talla, cuello: p.cuello })}</div>}</td><td className="text-muted">{p.categoria}{p.tipo && <div className="text-xs">{p.tipo}</div>}</td>
              <td className="num">{money(p.costo)}</td><td className="num">{money(p.precio)}</td>
              {cols.map((s) => <td key={s} className={`num ${(p.stock[s] ?? 0) < p.min / 3 ? 'text-peligro font-semibold' : ''}`}>{p.stock[s] ?? 0}</td>)}
              <td className="num font-semibold">{t}</td><td className={vence < 60 ? 'text-alerta' : 'text-muted'}>{p.vence ? fecha(p.vence) : 'No vence'}</td>
              <td>{enQuiebre(p, sucursal) ? <Badge tono="rojo">Quiebre</Badge> : t > p.max * 3 ? <Badge tono="ambar">Sobrestock</Badge> : <Badge tono="verde">OK</Badge>}</td>
              <td><div className="flex gap-0.5">{acciones(p)}</div></td>
            </tr>
          })}</tbody>
        </table></Scroll></div>
        {lista.length > POR_PAG && <div className="mt-3 flex items-center justify-between text-xs text-muted"><span>{pag * POR_PAG + 1}–{Math.min(lista.length, (pag + 1) * POR_PAG)} de {lista.length} productos</span><div className="flex gap-1"><Button className="!py-1" disabled={pag === 0} onClick={() => setPag(pag - 1)}>Anterior</Button><Button className="!py-1" disabled={(pag + 1) * POR_PAG >= lista.length} onClick={() => setPag(pag + 1)}>Siguiente</Button></div></div>}
        {!lista.length && <p className="py-10 text-center text-sm text-muted">{productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos. Pulse "Nuevo producto" o importe un Excel en Configuración → Mis datos.'}</p>}
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{([
        ['En quiebre', 'Menos de un tercio del mínimo', productos.filter((p) => enQuiebre(p, sucursal)), 'rojo'],
        ['Sobrestock', 'Más de 3 veces el máximo', productos.filter((p) => stockTotal(p, sucursal) > p.max * 3), 'ambar'],
        ['Por vencer', 'Vence en los próximos 60 días', productos.filter((p) => stockTotal(p, sucursal) > 0 && (diasParaVencer(p) ?? Infinity) < 60).sort((a, b) => a.vence.localeCompare(b.vence)), 'violeta'],
      ] as const).map(([t, d, ps, tono]) => (
        <Card key={t} titulo={<span className="flex items-center gap-2">{t}<Badge tono={tono}>{ps.length}</Badge></span>} accion={<span className="text-xs text-muted">{d}</span>}>
          <ul className="max-h-[260px] space-y-2 overflow-y-auto text-sm">{ps.map((p) => <li key={p.id}><button onClick={() => setKx({ p, s: 'TODAS' })} className="flex w-full items-center justify-between gap-2 rounded-lg bg-fg/5 px-3 py-2 text-left transition hover:bg-fg/10"><span className="min-w-0"><span className="block truncate">{etiquetaProducto(p)}</span><span className="text-xs text-muted">{p.sku}{t === 'Por vencer' ? ` · vence ${fecha(p.vence + 'T12:00:00')}` : ` · mín ${p.min} · máx ${p.max}`}</span></span><Badge tono={tono}>{stockTotal(p, sucursal)} u</Badge></button></li>)}
            {!ps.length && <li className="text-muted">Nada por aquí</li>}</ul>
        </Card>))}</div>
      <Card titulo="Stock por sucursal" accion={<span className="text-xs text-muted">Valor a costo promedio y a precio de venta</span>}>
        <Scroll><table className="tabla"><thead><tr><th>Sucursal</th><th>Ciudad</th><th className="num">Productos con stock</th><th className="num">Unidades</th><th className="num">Valor a costo</th><th className="num">Valor a precio</th><th className="num">En quiebre</th></tr></thead>
          <tbody>{SUCURSALES.map((s) => { const con = productos.filter((p) => (p.stock[s.id] ?? 0) > 0); return <tr key={s.id}><td className="font-mono text-xs">{s.id}</td><td>{s.ciudad}</td><td className="num">{con.length}</td><td className="num">{num(productos.reduce((a, p) => a + (p.stock[s.id] ?? 0), 0), 0)}</td><td className="num">{money(productos.reduce((a, p) => a + (p.stock[s.id] ?? 0) * p.costo, 0))}</td><td className="num">{money(productos.reduce((a, p) => a + (p.stock[s.id] ?? 0) * p.precio, 0))}</td><td className="num">{productos.filter((p) => p.stock[s.id] !== undefined && enQuiebre(p, s.id)).length}</td></tr> })}</tbody>
        </table></Scroll>
        {!SUCURSALES.length && <p className="py-6 text-center text-sm text-muted">Primero registre sus sucursales en Configuración.</p>}
      </Card>

      <Modal abierto={!!edit} onClose={() => setEdit(null)} titulo={productos.some((x) => x.id === edit?.id) ? 'Editar producto' : 'Nuevo producto'}>
        {edit && <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!edit.sku || !edit.nombre) return alert('SKU y nombre son obligatorios'); if (edit.min > edit.max) return alert('El mínimo no puede superar al máximo')
          const base: Producto = { ...edit, sku: edit.sku.trim(), nombre: edit.nombre.trim(), categoria: edit.categoria.trim(), tipo: edit.tipo?.trim() || undefined, color: edit.color?.trim() || undefined, talla: edit.talla?.trim() || undefined, cuello: usaCuello(edit.categoria, edit.tipo) ? edit.cuello || undefined : undefined }
          if (porTalla.length) { // una prenda por talla: SKU-TALLA (ej.: CAM-001-M)
            const skus = porTalla.map((t) => `${base.sku}-${t.talla}`.toUpperCase())
            const repetido = skus.find((k) => productos.some((p) => p.sku.toUpperCase() === k))
            if (repetido) return alert(`Ya existe un producto con el código ${repetido}`)
            porTalla.forEach((t, k) => guardarProducto({ ...base, id: `${base.id}-${k}`, sku: skus[k], talla: t.talla, stock: t.stock }))
          } else guardarProducto(base)
          setEdit(null) }}>
          <Campo label="SKU"><input className="inp" value={edit.sku} onChange={(e) => set('sku', e.target.value)} /></Campo>
          <Campo label="Nombre"><input className="inp" value={edit.nombre} onChange={(e) => set('nombre', e.target.value)} /></Campo>
          <Campo label="Categoría" ayuda="Agrupa todo: ej. «Ropa, calzado y textil». Elija una o escriba otra"><input className="inp" list="cats" value={edit.categoria} onChange={(e) => cambiarClase(e.target.value, tiposDe(e.target.value).includes(edit.tipo ?? '') ? edit.tipo ?? '' : '')} /><datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></Campo>
          <Campo label="Tipo" ayuda={tiposDe(edit.categoria).length ? 'Ej.: camisetas, buzos, gorras… (opcional)' : 'Opcional'}><input className="inp" list="tipos" value={edit.tipo ?? ''} onChange={(e) => cambiarClase(edit.categoria, e.target.value)} placeholder={tiposDe(edit.categoria)[0] ? `Ej.: ${tiposDe(edit.categoria)[0]}` : ''} /><datalist id="tipos">{tiposDe(edit.categoria).map((t) => <option key={t} value={t} />)}</datalist></Campo>
          <div className="sm:col-span-2"><Campo label="Proveedor"><select className="inp" value={edit.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}><option value="">— Sin proveedor —</option>{proveedores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo></div>
          <Campo label="Costo ($)"><MontoInput value={edit.costo} onChange={(v) => set('costo', v)} /></Campo>
          <Campo label="Precio ($)"><MontoInput value={edit.precio} onChange={(v) => set('precio', v)} /></Campo>
          {esPrenda(edit.categoria, edit.tipo) && <div className="space-y-3 rounded-xl border border-fg/10 p-3 sm:col-span-2">
            <div className="text-xs font-medium text-muted">Detalles de la prenda</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Campo label="Color"><input className="inp" list="colores" value={edit.color ?? ''} onChange={(e) => set('color', e.target.value)} placeholder="Ej.: Blanco" /><datalist id="colores">{COLORES.map((c) => <option key={c} value={c} />)}</datalist></Campo>
              {usaCuello(edit.categoria, edit.tipo) && <Campo label="Tipo de cuello"><select className="inp" value={edit.cuello ?? ''} onChange={(e) => set('cuello', e.target.value)}><option value="">— Elegir —</option>{CUELLOS.map((c) => <option key={c}>{c}</option>)}</select></Campo>}
              {productos.some((x) => x.id === edit.id) && <Campo label="Talla"><input className="inp" list="tallas" value={edit.talla ?? ''} onChange={(e) => set('talla', e.target.value.toUpperCase())} /><datalist id="tallas">{tallasDe(edit.categoria, edit.tipo).map((t) => <option key={t} value={t} />)}</datalist></Campo>}
            </div>
            {!productos.some((x) => x.id === edit.id) && <div>
              <div className="mb-1.5 text-xs font-medium text-muted">Tallas <span className="font-normal">(elija las que tiene; se crea un producto por talla con su cantidad)</span></div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[...new Set([...tallasDe(edit.categoria, edit.tipo), ...porTalla.map((t) => t.talla)])].map((t) => { const si = porTalla.some((x) => x.talla === t); return (
                  <button key={t} type="button" onClick={() => setPorTalla(si ? porTalla.filter((x) => x.talla !== t) : [...porTalla, { talla: t, stock: Object.fromEntries(SUCURSALES.map((x) => [x.id, 0])) }])} className={`min-w-[2.6rem] rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${si ? 'border-primario/60 bg-primario/15 text-primario' : 'border-fg/10 text-muted hover:bg-fg/5'}`}>{t}</button>) })}
                <input className="inp !w-24 !py-1.5 text-xs" placeholder="Otra talla" value={otraTalla} onChange={(e) => setOtraTalla(e.target.value.toUpperCase())} onKeyDown={(e) => { const t = otraTalla.trim(); if (e.key === 'Enter') { e.preventDefault(); if (t && !porTalla.some((x) => x.talla === t)) setPorTalla([...porTalla, { talla: t, stock: Object.fromEntries(SUCURSALES.map((x) => [x.id, 0])) }]); setOtraTalla('') } }} />
              </div>
            </div>}
          </div>}
          {porTalla.length > 0 ? <div className="sm:col-span-2"><div className="mb-1 text-xs font-medium text-muted">Cantidad por talla{SUCURSALES.length > 1 ? ' y sucursal' : ''}</div>
            <div className="max-h-60 overflow-auto rounded-xl bg-fg/5 p-2"><table className="w-full text-sm"><thead><tr className="text-xs text-muted"><th className="px-1 py-1 text-left font-medium">Talla</th>{SUCURSALES.map((x) => <th key={x.id} className="px-1 py-1 text-left font-medium">{SUCURSALES.length > 1 ? `${x.id} · ${x.ciudad}` : 'Cantidad'}</th>)}</tr></thead>
              <tbody>{porTalla.map((t, k) => <tr key={t.talla}><td className="px-1 py-1 font-semibold">{t.talla}</td>{SUCURSALES.map((x) => <td key={x.id} className="px-1 py-1"><NumInput value={t.stock[x.id] ?? 0} onChange={(v) => setPorTalla(porTalla.map((y, j) => (j === k ? { ...y, stock: { ...y.stock, [x.id]: Math.max(0, Math.round(v)) } } : y)))} /></td>)}</tr>)}</tbody></table></div>
            <p className="mt-1 text-[11px] text-muted">Se crearán {porTalla.length === 1 ? '1 producto' : `${porTalla.length} productos`}: {porTalla.map((t) => `${(edit.sku || 'SKU').toUpperCase()}-${t.talla}`).join(', ')}</p></div>
          : <div className="sm:col-span-2"><div className="mb-1 text-xs font-medium text-muted">Stock actual por sucursal ({SUCURSALES.length})</div>
            <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-xl bg-fg/5 p-2 sm:grid-cols-3">{SUCURSALES.map((x) => <Campo key={x.id} label={`${x.id} · ${x.ciudad}`}><NumInput value={edit.stock[x.id] ?? 0} onChange={(v) => set('stock', { ...edit.stock, [x.id]: Math.max(0, Math.round(v)) })} /></Campo>)}</div></div>}
          <Campo label="Stock mínimo (por sucursal)"><NumInput value={edit.min} onChange={(v) => set('min', v)} /></Campo>
          <Campo label="Stock máximo (por sucursal)"><NumInput value={edit.max} onChange={(v) => set('max', v)} /></Campo>
          <Campo label="Lote"><input className="inp" value={edit.lote} onChange={(e) => set('lote', e.target.value)} /></Campo>
          <Campo label="Fecha de vencimiento" ayuda={edit.vence ? undefined : 'Este producto no tiene fecha de vencimiento'}>
            <div className="flex items-center gap-3"><input type="date" className="inp" disabled={!edit.vence} value={edit.vence} onChange={(e) => set('vence', e.target.value)} />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs"><input type="checkbox" checked={!edit.vence} onChange={(e) => set('vence', e.target.checked ? '' : venceSugerido())} />No vence</label></div></Campo>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" onClick={() => setEdit(null)}>Cancelar</Button><Button variante="primario" type="submit">Guardar</Button></div>
        </form>}
      </Modal>

      <Modal abierto={!!codigo} onClose={() => setCodigo(null)} titulo="Etiqueta de producto" ancho="max-w-md">
        {codigo && <div className="space-y-4"><div id="etiqueta" className="flex flex-col items-center gap-3 rounded-xl bg-white p-5 text-slate-900">
          <div className="text-center text-sm font-bold">{etiquetaProducto(codigo)}</div><CodigoBarras valor={codigo.sku} />
          <QRCodeSVG value={JSON.stringify({ sku: codigo.sku, lote: codigo.lote, vence: codigo.vence })} size={110} /><div className="text-xs">{codigo.lote && `Lote ${codigo.lote} · `}{codigo.vence ? `Vence ${fecha(codigo.vence)}` : 'No vence'} · {money(codigo.precio)}</div>
        </div><Button variante="primario" className="w-full" onClick={() => { const w = window.open('', '_blank', 'width=400,height=500'); if (w) { w.document.write(`<body style="font-family:sans-serif;display:flex;justify-content:center">${document.getElementById('etiqueta')!.outerHTML}</body>`); w.document.close(); w.print() } }}><Printer size={15} />Imprimir etiqueta</Button></div>}
      </Modal>

      <Modal abierto={!!trans} onClose={() => setTrans(null)} titulo={`Transferir · ${trans ? etiquetaProducto(trans.p) : ""}`} ancho="max-w-md">
        {trans && <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Origen"><select className="inp" value={trans.de} onChange={(e) => setTrans({ ...trans, de: e.target.value as SucursalId })}>{SUCURSALES.map((s) => <option key={s.id} value={s.id}>{s.ciudad} ({(trans.p.stock[s.id] ?? 0)})</option>)}</select></Campo>
            <Campo label="Destino"><select className="inp" value={trans.a} onChange={(e) => setTrans({ ...trans, a: e.target.value as SucursalId })}>{SUCURSALES.map((s) => <option key={s.id} value={s.id}>{s.ciudad} ({(trans.p.stock[s.id] ?? 0)})</option>)}</select></Campo>
          </div>
          <Campo label="Cantidad"><NumInput min={1} value={trans.cant} onChange={(v) => setTrans({ ...trans, cant: Math.round(v), err: undefined })} /></Campo>
          {trans.err && <p className="text-xs text-peligro">{trans.err}</p>}
          <Button variante="primario" className="w-full" onClick={() => { const e = transferir(trans.p.id, trans.de, trans.a, trans.cant); if (e) setTrans({ ...trans, err: e }); else setTrans(null) }}><ArrowLeftRight size={15} />Confirmar transferencia</Button>
        </div>}
      </Modal>

      <Modal abierto={!!aj} onClose={() => setAj(null)} titulo="Registrar movimiento de inventario" ancho="max-w-md">
        {aj && <div className="space-y-3">
          <Campo label="Producto"><select className="inp" value={aj.p.id} onChange={(e) => { const p = productos.find((x) => x.id === e.target.value)!; setAj({ ...aj, p, costo: p.costo, err: undefined }) }}>{productos.map((x) => <option key={x.id} value={x.id}>{x.sku} · {etiquetaProducto(x)}</option>)}</select></Campo>
          <div className="grid grid-cols-4 gap-1.5">{(['Venta', 'Compra', 'Ajuste', 'Merma'] as const).map((t) => <button key={t} type="button" onClick={() => setAj({ ...aj, tipo: t, err: undefined })} className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${aj.tipo === t ? 'border-primario/60 bg-primario/15' : 'border-fg/10 bg-fg/5 hover:bg-fg/10'}`}>{t}</button>)}</div>
          <p className="text-xs text-muted">{{ Venta: 'Salida por venta: descuenta stock y alimenta el pronóstico de la IA.', Compra: 'Entrada directa de mercadería: suma stock y recalcula el costo promedio ponderado.', Ajuste: 'Corrección por conteo físico: positivo suma, negativo resta.', Merma: 'Pérdida por daño, robo o vencimiento: descuenta stock.' }[aj.tipo]}</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sucursal"><select className="inp" value={aj.s} onChange={(e) => setAj({ ...aj, s: e.target.value as SucursalId, err: undefined })}>{SUCURSALES.map((s) => <option key={s.id} value={s.id}>{s.ciudad} ({(aj.p.stock[s.id] ?? 0)} u)</option>)}</select></Campo>
            <Campo label="Cantidad"><NumInput value={aj.cant} onChange={(v) => setAj({ ...aj, cant: Math.round(v), err: undefined })} /></Campo>
          </div>
          {aj.tipo === 'Compra' && <Campo label="Costo unitario ($)"><MontoInput value={aj.costo} onChange={(v) => setAj({ ...aj, costo: v })} /></Campo>}
          <Campo label="Nota (opcional)"><input className="inp" value={aj.nota} onChange={(e) => setAj({ ...aj, nota: e.target.value })} placeholder="Ej.: factura 001-002-345, motivo del ajuste" /></Campo>
          {aj.err && <p className="text-xs text-peligro">{aj.err}</p>}
          <Button variante="primario" className="w-full" onClick={() => { const e = registrar(aj.p.id, aj.s, aj.tipo, aj.cant, aj.nota, aj.costo); if (e) setAj({ ...aj, err: e }); else setAj(null) }}>Registrar {aj.tipo.toLowerCase()}</Button>
        </div>}
      </Modal>

      <Modal abierto={!!kx} onClose={() => setKx(null)} titulo={`Kardex · ${kx ? etiquetaProducto(kx.p) : ""} (promedio ponderado)`} ancho="max-w-6xl">
        {kx && <div className="space-y-3">
          <div className="flex flex-wrap gap-2"><select className="inp !w-auto" value={kx.s} onChange={(e) => setKx({ ...kx, s: e.target.value as SucursalId })}><option value="TODAS">Consolidado</option>{SUCURSALES.map((s) => <option key={s.id} value={s.id}>{s.ciudad}</option>)}</select>
            <Button onClick={() => exportarTabla(`Kardex_${kx.p.sku}`, ['Fecha', 'Tipo', 'Suc.', 'Entrada', 'Salida', 'Costo unit.', 'Saldo', 'CPP', 'Valor'], filasK.map((f) => [fechaHora(f.fecha), f.tipo, f.sucursal, f.entrada, f.salida, num(f.costoUnit, 4), f.saldo, num(f.cpp, 4), money(f.valor)]), 'xlsx')}><FileSpreadsheet size={15} />Excel</Button></div>
          <div className="max-h-[60vh] overflow-auto"><Scroll><table className="tabla"><thead className="sticky top-0 bg-[var(--bg2)]"><tr><th>Fecha</th><th>Tipo</th><th>Suc.</th><th className="num">Entrada</th><th className="num">Salida</th><th className="num">Costo unit.</th><th className="num">Saldo</th><th className="num">Costo prom.</th><th className="num">Valor</th><th>Usuario</th></tr></thead>
            <tbody>{filasK.slice().reverse().map((f, k) => <tr key={k}><td>{fechaHora(f.fecha)}</td><td>{f.tipo}</td><td>{f.sucursal}</td><td className="num text-exito">{f.entrada || ''}</td><td className="num text-peligro">{f.salida || ''}</td><td className="num">{money(f.costoUnit)}</td><td className="num font-semibold">{f.saldo}</td><td className="num">{num(f.cpp, 4)}</td><td className="num">{money(f.valor)}</td><td className="text-muted">{f.usuario}</td></tr>)}</tbody></table></Scroll></div>
        </div>}
      </Modal>
    </div>
  )
}
