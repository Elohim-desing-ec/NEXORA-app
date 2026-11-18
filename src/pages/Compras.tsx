import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, MapPin, Pencil, Phone, Plus, Trash2, Truck, Trophy, Building2, ClipboardList, ArrowUpCircle } from 'lucide-react'
import { useApp, tieneRol, soloLectura as esSoloLectura } from '../store/useApp'
import { Badge, Button, Campo, Card, Modal, MontoInput, NumInput, Scroll, Titulo, Tabs, cx } from '../components/ui'
import { UbicacionMapa } from '../components/UbicacionMapa'
import { IconoNivel } from '../components/Iconos'
import { LUGARES_TRABAJO, NIVELES_PROVEEDOR, cumplimientoReal, nivelSugerido, sucursalCercana, textoKm, tieneUbicacion, type NivelProveedor } from '../lib/proveedores'
import { pais } from '../data/paises'
import { money, fecha, num } from '../lib/format'
import type { Orden, Proveedor, SucursalId } from '../data/base'

export const totalOC = (o: Orden) => o.items.reduce((s, i) => s + i.cantidad * i.costo, 0)
const nuevoProv = (): Proveedor => ({ id: crypto.randomUUID(), nombre: '', ruc: '', ciudad: '', contacto: '', telefono: '', email: '', cumplimiento: 100, indicePrecio: 1, nivel: 'Junior', provee: '', lugar: '' })
const TONO_NIVEL: Record<NivelProveedor, 'verde' | 'azul' | 'ambar' | 'violeta'> = { Emprendedor: 'verde', Junior: 'azul', Senior: 'ambar', Experimentado: 'violeta' }

export default function Compras() {
  const { ordenes, productos, proveedores, sucursales, usuario, empresa, crearOrden, avanzarOrden, guardarProveedor, eliminarProveedor, ir } = useApp()
  const [filtroNivel, setFiltroNivel] = useState<NivelProveedor | 'todos'>('todos'), [masDatos, setMasDatos] = useState(false), [verMapa, setVerMapa] = useState(false)
  const centro = pais(empresa.pais) ?? { lat: -1.8, lng: -78.2 }
  const abrirProv = (p: Proveedor) => { setErr(''); setMasDatos(!!(p.ruc || p.contacto || p.email)); setVerMapa(tieneUbicacion(p)); setProv(p) }
  const [tab, setTab] = useState<'ordenes' | 'proveedores'>('ordenes')
  const [nueva, setNueva] = useState<{ proveedorId: string; sucursal: SucursalId; items: { productoId: string; cantidad: number; costo: number }[] } | null>(null)
  const [prov, setProv] = useState<Proveedor | null>(null), [err, setErr] = useState('')
  const puedeAprobar = tieneRol(usuario, 'Gerente General', 'Gerente Financiero', 'Analista Financiero', 'Gerente de Sucursal')
  const puedeRecibir = tieneRol(usuario, 'Gerente General', 'Jefe de Bodega', 'Jefe de Logística', 'Gerente de Sucursal')
  const puedeEditar = !esSoloLectura(usuario)
  // Cumplimiento real: % de órdenes aprobadas que ya fueron recibidas (si hay historial); si no, el valor registrado.
  const ranking = useMemo(() => proveedores.map((p) => {
    const os = ordenes.filter((o) => o.proveedorId === p.id && o.estado !== 'Borrador')
    const { cumplimiento } = cumplimientoReal(p, ordenes)
    return { ...p, cumplimiento, compras: os.reduce((s, o) => s + totalOC(o), 0), puntaje: cumplimiento * 0.6 + (2 - p.indicePrecio) * 100 * 0.4 }
  }).sort((a, b) => b.puntaje - a.puntaje), [proveedores, ordenes])
  const tono = { Borrador: 'gris', Aprobada: 'azul', Recibida: 'verde' } as const
  const item = () => ({ productoId: productos[0].id, cantidad: 10, costo: productos[0].costo })
  const sinDatos = !sucursales.length ? 'Primero registre una sucursal en Configuración' : !productos.length ? 'Primero registre productos en Inventario' : !proveedores.length ? 'Primero registre un proveedor' : ''
  return (
    <div className="space-y-5">
      <Titulo titulo="Compras y proveedores" sub="Flujo: Borrador → Aprobada → Recibida (al recibir se actualizan el stock, el costo promedio y el kardex)">
        {puedeEditar && <Button onClick={() => abrirProv(nuevoProv())}><Building2 size={15} />Nuevo proveedor</Button>}
        {puedeEditar && <Button variante="primario" disabled={!!sinDatos} title={sinDatos} onClick={() => setNueva({ proveedorId: proveedores[0].id, sucursal: sucursales[0]?.id ?? '', items: [item()] })}><Plus size={15} />Nueva orden</Button>}
      </Titulo>
      {sinDatos && <Card><div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">«Nueva orden» se activa cuando hay sucursal, productos y proveedor. {sinDatos} para poder crear órdenes de compra.</p>
        {puedeEditar && (!sucursales.length ? <Button onClick={() => ir('configuracion')}>Ir a Configuración</Button>
          : !productos.length ? <Button onClick={() => ir('productos')}>Ir a Inventario</Button>
          : <Button variante="primario" onClick={() => abrirProv(nuevoProv())}><Building2 size={15} />Nuevo proveedor</Button>)}
      </div></Card>}
      <Tabs items={[{ id: 'ordenes', label: 'Órdenes de compra', icon: <ClipboardList size={14} /> }, { id: 'proveedores', label: 'Proveedores', icon: <Building2 size={14} /> }]} valor={tab} onChange={setTab} />
      {tab === 'ordenes' && <>
        <Card titulo="Órdenes de compra"><Scroll><table className="tabla">
          <thead><tr><th>N.°</th><th>Fecha</th><th>Proveedor</th><th>Sucursal</th><th className="num">Ítems</th><th className="num">Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>{ordenes.slice().reverse().map((o) => <tr key={o.id}>
            <td className="font-mono text-xs">{o.id}</td><td>{fecha(o.fecha)}</td><td>{proveedores.find((p) => p.id === o.proveedorId)?.nombre ?? '—'}</td><td>{o.sucursal}</td><td className="num">{o.items.length}</td><td className="num font-semibold">{money(totalOC(o))}</td>
            <td><Badge tono={tono[o.estado]}>{o.estado}</Badge></td>
            <td>{o.estado === 'Borrador' && <Button variante="exito" disabled={!puedeAprobar} title={puedeAprobar ? '' : 'Requiere Gerente o Analista'} className="!py-1 text-xs" onClick={() => avanzarOrden(o.id)}><CheckCircle2 size={14} />Aprobar</Button>}
              {o.estado === 'Aprobada' && <Button disabled={!puedeRecibir} className="!py-1 text-xs" onClick={() => avanzarOrden(o.id)}><Truck size={14} />Recibir</Button>}</td>
          </tr>)}</tbody></table></Scroll>
          {!ordenes.length && <p className="py-8 text-center text-sm text-muted">Aún no hay órdenes de compra.</p>}</Card>
      </>}
      {tab === 'proveedores' && <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2" titulo={`Proveedores (${proveedores.length})`}>
        {proveedores.length > 0 && <div className="sin-barra mb-3 flex gap-1.5 overflow-x-auto">{(['todos', ...NIVELES_PROVEEDOR.map((n) => n.nivel)] as const).map((n) => {
          const k = n === 'todos' ? proveedores.length : proveedores.filter((p) => p.nivel === n).length
          return <button key={n} type="button" onClick={() => setFiltroNivel(n)} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition', filtroNivel === n ? 'border-primario/50 bg-primario/15 text-primario' : 'border-fg/10 text-muted hover:bg-fg/5')}>{n !== 'todos' && <IconoNivel nivel={n} size={12} className="mr-1 inline -mt-0.5" />}{n === 'todos' ? 'Todos' : n} · {k}</button>
        })}</div>}
        <Scroll><table className="tabla">
        <thead><tr><th>Proveedor</th><th>Nivel</th><th>Dónde trabaja</th><th>Contacto</th><th>Ubicación</th><th /></tr></thead>
        <tbody>{proveedores.filter((p) => filtroNivel === 'todos' || p.nivel === filtroNivel).map((p) => {
          const sube = nivelSugerido(p, ordenes), cerca = sucursalCercana(p, sucursales)
          return <tr key={p.id}>
            <td><div className="font-medium">{p.nombre}</div>{p.provee && <div className="text-xs text-muted">{p.provee}</div>}{p.ruc && <div className="font-mono text-[11px] text-muted">RUC {p.ruc}</div>}</td>
            <td><div className="flex flex-col items-start gap-1">{p.nivel ? <Badge tono={TONO_NIVEL[p.nivel]}><IconoNivel nivel={p.nivel} size={11} className="mr-1 inline -mt-0.5" />{p.nivel}</Badge> : <span className="text-xs text-muted">—</span>}
              {sube && puedeEditar && <button type="button" onClick={() => guardarProveedor({ ...p, nivel: sube })} className="flex items-center gap-1 text-[11px] font-medium text-exito hover:underline" title="Ya cumplió varias entregas a tiempo"><ArrowUpCircle size={12} />Subir a {sube}</button>}</div></td>
            <td className="text-sm">{p.lugar || '—'}{p.ciudad && <div className="text-xs text-muted">{p.ciudad}</div>}</td>
            <td className="text-sm">{p.contacto && <div>{p.contacto}</div>}{p.telefono && <a href={`tel:${p.telefono.replace(/\s/g, '')}`} className="flex items-center gap-1 text-primario hover:underline"><Phone size={12} />{p.telefono}</a>}{p.email && <div className="text-xs text-muted">{p.email}</div>}{!p.contacto && !p.telefono && !p.email && <span className="text-muted">—</span>}</td>
            <td className="text-xs">{tieneUbicacion(p) ? <span className="flex items-center gap-1 text-cian"><MapPin size={12} />{cerca ? `a ${textoKm(cerca.km)} de ${cerca.s.nombre}` : 'En el mapa'}</span> : puedeEditar ? <button type="button" onClick={() => { abrirProv({ ...p }); setVerMapa(true) }} className="text-muted hover:text-primario hover:underline">+ Agregar</button> : <span className="text-muted">—</span>}</td>
            <td>{puedeEditar && <div className="flex gap-1"><Button variante="fantasma" className="!p-1.5" title="Editar" onClick={() => abrirProv({ ...p })}><Pencil size={15} /></Button><Button variante="fantasma" className="!p-1.5 text-peligro" title="Eliminar" onClick={() => { if (confirm(`¿Eliminar ${p.nombre}?`)) { const e = eliminarProveedor(p.id); if (e) alert(e) } }}><Trash2 size={15} /></Button></div>}</td></tr>
        })}</tbody></table></Scroll>
        {!proveedores.length && <p className="py-6 text-center text-sm text-muted">Registre sus proveedores con "Nuevo proveedor": desde quien recién empieza en su casa hasta una fábrica.</p>}</Card>
        <Card titulo={<span className="flex items-center gap-2"><Trophy size={15} className="text-alerta" />Ranking de proveedores</span>}>
          <ol className="space-y-2">{ranking.map((p, k) => <li key={p.id} className="flex items-center gap-3 rounded-xl bg-fg/5 px-3 py-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${k < 3 ? 'bg-gradient-to-br from-alerta to-peligro text-white' : 'bg-fg/10'}`}>{k + 1}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{p.nombre}</div><div className="text-xs text-muted">Cumplimiento {num(p.cumplimiento, 0)} % · Precio {num(p.indicePrecio, 2)} · Compras {money(p.compras, 0)}</div>
              <div className="mt-1 h-1.5 rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-primario to-cian" style={{ width: `${p.cumplimiento}%` }} /></div></div>
            <span className="text-sm font-bold tnum">{num(p.puntaje, 1)}</span></li>)}</ol>
          {!ranking.length && <p className="text-sm text-muted">Sin proveedores registrados.</p>}
          <p className="mt-3 text-[11px] text-muted">Puntaje = 60 % cumplimiento (órdenes recibidas / aprobadas) + 40 % competitividad de precio (1 = precio de mercado).</p>
        </Card>
      </div>}

      <Modal abierto={!!prov} onClose={() => setProv(null)} titulo={proveedores.some((x) => x.id === prov?.id) ? 'Editar proveedor' : 'Nuevo proveedor'} ancho="max-w-2xl">
        {prov && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const r = guardarProveedor({ ...prov, nombre: prov.nombre.trim(), provee: prov.provee?.trim(), ruc: prov.ruc.trim() }); if (r) setErr(r); else setProv(null) }}>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">¿Qué tipo de proveedor es?</div>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">{NIVELES_PROVEEDOR.map((n) => (
              <button key={n.nivel} type="button" onClick={() => setProv({ ...prov, nivel: n.nivel })} className={cx('rounded-xl border px-3 py-2 text-left transition', prov.nivel === n.nivel ? 'border-primario/60 bg-primario/10' : 'border-fg/10 hover:bg-fg/5')}>
                <div className="flex items-center gap-1.5 text-sm font-semibold"><IconoNivel nivel={n.nivel} size={14} className="text-primario" />{n.nivel}</div>
                <div className="text-[11px] leading-snug text-muted">{n.descripcion}</div>
                <div className="text-[11px] italic text-muted/80">{n.ejemplo}</div>
              </button>))}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nombre (o como usted le dice)"><input autoFocus className="inp" value={prov.nombre} onChange={(e) => setProv({ ...prov, nombre: e.target.value })} placeholder="Ej.: Don Luis camisetas" /></Campo>
            <Campo label="¿Qué le provee?"><input className="inp" value={prov.provee ?? ''} onChange={(e) => setProv({ ...prov, provee: e.target.value })} placeholder="Ej.: camisetas estampadas" /></Campo>
            <Campo label="Teléfono o WhatsApp"><input className="inp" inputMode="tel" value={prov.telefono} onChange={(e) => setProv({ ...prov, telefono: e.target.value })} placeholder="Ej.: 099 123 4567" /></Campo>
            <Campo label="¿Dónde trabaja?"><select className="inp" value={prov.lugar ?? ''} onChange={(e) => setProv({ ...prov, lugar: e.target.value })}><option value="">— Elegir —</option>{LUGARES_TRABAJO.map((l) => <option key={l}>{l}</option>)}</select></Campo>
            <Campo label="Ciudad"><input className="inp" value={prov.ciudad} onChange={(e) => setProv({ ...prov, ciudad: e.target.value })} /></Campo>
          </div>
          {prov.nivel === 'Emprendedor' && <p className="rounded-lg bg-exito/10 px-3 py-2 text-xs text-exito">Para un emprendedor basta con el nombre y el teléfono. El RUC, el correo y la ubicación son opcionales.</p>}

          <div className="rounded-xl border border-fg/10">
            <button type="button" onClick={() => setVerMapa(!verMapa)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"><span className="flex items-center gap-2"><MapPin size={15} className="text-cian" />Ubicación en el mapa <span className="text-xs font-normal text-muted">(opcional · {tieneUbicacion(prov) ? 'ubicado' : 'sin ubicar'})</span></span><ChevronDown size={16} className={cx('transition', verMapa && 'rotate-180')} /></button>
            {verMapa && <div className="space-y-2 border-t border-fg/10 p-3">
              <UbicacionMapa nombre={prov.nombre} inicio={centro} valor={{ lat: prov.lat, lng: prov.lng, ciudad: prov.ciudad, pais: prov.pais, direccion: prov.direccion }}
                onChange={(u) => setProv({ ...prov, lat: u.lat, lng: u.lng, ciudad: prov.ciudad || u.ciudad || '', pais: u.pais, direccion: u.direccion })} />
              <Campo label="Referencia o dirección"><input className="inp" value={prov.direccion ?? ''} onChange={(e) => setProv({ ...prov, direccion: e.target.value })} placeholder="Ej.: junto a la escuela, casa esquinera" /></Campo>
              <p className="text-[11px] text-muted">Con la ubicación, NEXORA le avisa qué proveedor queda más cerca cuando falte mercadería y lo muestra en la Red global.</p>
            </div>}
          </div>

          <div className="rounded-xl border border-fg/10">
            <button type="button" onClick={() => setMasDatos(!masDatos)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"><span>Más datos <span className="text-xs font-normal text-muted">(opcional: RUC, contacto, correo, precios)</span></span><ChevronDown size={16} className={cx('transition', masDatos && 'rotate-180')} /></button>
            {masDatos && <div className="grid grid-cols-1 gap-3 border-t border-fg/10 p-3 sm:grid-cols-2">
              <Campo label="RUC o cédula" ayuda="Déjelo vacío si no tiene"><input className="inp" inputMode="numeric" maxLength={13} value={prov.ruc} onChange={(e) => setProv({ ...prov, ruc: e.target.value.replace(/\D/g, '') })} /></Campo>
              <Campo label="Persona de contacto"><input className="inp" value={prov.contacto} onChange={(e) => setProv({ ...prov, contacto: e.target.value })} /></Campo>
              <Campo label="Correo"><input type="email" className="inp" value={prov.email} onChange={(e) => setProv({ ...prov, email: e.target.value })} /></Campo>
              <Campo label="Cumplimiento inicial (%)" ayuda="Se recalcula solo con las órdenes recibidas"><NumInput min={0} max={100} value={prov.cumplimiento} onChange={(v) => setProv({ ...prov, cumplimiento: Math.max(0, Math.min(100, v)) })} /></Campo>
              <Campo label="Índice de precio" ayuda="1 = precio de mercado · 0,95 = 5 % más barato"><NumInput step={0.01} value={prov.indicePrecio} onChange={(v) => setProv({ ...prov, indicePrecio: v })} /></Campo>
            </div>}
          </div>
          {err && <p className="text-sm text-peligro">{err}</p>}
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setProv(null)}>Cancelar</Button><Button variante="primario" type="submit">Guardar</Button></div>
        </form>}
      </Modal>

      <Modal abierto={!!nueva} onClose={() => setNueva(null)} titulo="Nueva orden de compra">
        {nueva && <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Proveedor"><select className="inp" value={nueva.proveedorId} onChange={(e) => setNueva({ ...nueva, proveedorId: e.target.value })}>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo>
            <Campo label="Sucursal de destino"><select className="inp" value={nueva.sucursal} onChange={(e) => setNueva({ ...nueva, sucursal: e.target.value as SucursalId })}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.ciudad}</option>)}</select></Campo>
          </div>
          {nueva.items.map((it, k) => <div key={k} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-fg/10 p-2 sm:grid-cols-[1fr_90px_110px_auto] sm:rounded-none sm:border-0 sm:p-0">
            <div className="col-span-3 sm:col-span-1"><Campo label="Producto"><select className="inp" value={it.productoId} onChange={(e) => { const p = productos.find((x) => x.id === e.target.value)!; const items = [...nueva.items]; items[k] = { ...it, productoId: p.id, costo: p.costo }; setNueva({ ...nueva, items }) }}>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo></div>
            <Campo label="Cant."><NumInput value={it.cantidad} onChange={(v) => { const items = [...nueva.items]; items[k] = { ...it, cantidad: Math.max(1, Math.round(v)) }; setNueva({ ...nueva, items }) }} /></Campo>
            <Campo label="Costo"><MontoInput value={it.costo} onChange={(v) => { const items = [...nueva.items]; items[k] = { ...it, costo: v }; setNueva({ ...nueva, items }) }} /></Campo>
            <Button variante="fantasma" className="text-peligro" onClick={() => setNueva({ ...nueva, items: nueva.items.filter((_, j) => j !== k) })}><Trash2 size={15} /></Button>
          </div>)}
          <div className="flex items-center justify-between"><Button onClick={() => setNueva({ ...nueva, items: [...nueva.items, item()] })}><Plus size={15} />Ítem</Button>
            <div className="text-sm">Total: <b className="tnum">{money(nueva.items.reduce((s, i) => s + i.cantidad * i.costo, 0))}</b></div></div>
          <Button variante="primario" className="w-full" disabled={!nueva.items.length} onClick={() => { crearOrden(nueva); setNueva(null) }}>Crear como borrador</Button>
        </div>}
      </Modal>
    </div>
  )
}
