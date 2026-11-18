import { lazy, Suspense, useMemo, useState } from 'react'
import { Globe2, RotateCcw, ScrollText, Trash2 } from 'lucide-react'
import { useApp, soloLectura, COLECCIONES_PAPELERA, nombreEnPapelera } from '../store/useApp'
import { Badge, Button, Card, Scroll, Titulo, Tabs } from '../components/ui'
import { fechaHora, money } from '../lib/format'
import { stockTotal, valorInventario } from '../lib/inventario'
import { pedirEliminar } from '../components/Eliminacion'

const Globo = lazy(() => import('../components/Globo'))

export default function Auditoria() {
  const { auditoria, movimientos, productos, sucursales: SUCURSALES, papelera, recuperar, vaciarPapelera, usuario } = useApp()
  const [tab, setTab] = useState<'bitacora' | 'papelera' | 'mapa'>('bitacora')
  const [aviso, setAviso] = useState('')
  const [q, setQ] = useState(''), [vista, setVista] = useState<'eventos' | 'movimientos'>('eventos')
  const ev = useMemo(() => auditoria.slice().reverse().filter((e) => `${e.usuario} ${e.accion} ${e.detalle} ${e.sucursal}`.toLowerCase().includes(q.toLowerCase())).slice(0, 300), [auditoria, q])
  const mv = useMemo(() => movimientos.slice(-400).reverse().filter((m) => `${m.usuario} ${m.tipo} ${m.sucursal} ${productos.find((p) => p.id === m.productoId)?.nombre}`.toLowerCase().includes(q.toLowerCase())).slice(0, 300), [movimientos, productos, q])
  return (
    <div className="space-y-5">
      <Titulo titulo="Trazabilidad y auditoría" sub="Quién hizo qué, cuándo y dónde — registro inmutable de cada acción" />
      <Tabs items={[{ id: 'bitacora', label: 'Bitácora', icon: <ScrollText size={14} /> }, { id: 'papelera', label: `Papelera${papelera.length ? ` (${papelera.length})` : ''}`, icon: <Trash2 size={14} /> }, { id: 'mapa', label: 'Mapa de sucursales', icon: <Globe2 size={14} /> }]} valor={tab} onChange={setTab} />
        {tab === 'papelera' && <Card titulo="Papelera" accion={papelera.length > 0 && !soloLectura(usuario) && <Button variante="fantasma" className="text-xs text-peligro" onClick={() => pedirEliminar({ titulo: '¿Vaciar la papelera?', detalle: 'Lo que está aquí ya no se podrá recuperar en este equipo.', boton: 'Vaciar', listo: 'Papelera vaciada', accion: () => vaciarPapelera() })}>Vaciar papelera</Button>}>
          <p className="mb-3 text-sm text-muted">Todo lo que desaparece de una lista (lo haya eliminado alguien o lo haya quitado la sincronización) queda aquí. Pulse «Recuperar» y vuelve a su lugar en todos los equipos. Cada equipo guarda su propia papelera (las últimas 1.000 cosas).</p>
          {aviso && <p className="mb-3 rounded-lg bg-exito/10 px-3 py-2 text-sm text-exito">{aviso}</p>}
          <div className="max-h-[560px] overflow-auto"><Scroll><table className="tabla">
            <thead><tr><th>Qué</th><th>Cuándo</th><th>Quién lo quitó</th><th /></tr></thead>
            <tbody>{papelera.map((e) => <tr key={e.id}>
              <td><Badge tono="gris">{COLECCIONES_PAPELERA[e.coleccion]}</Badge> <span className="font-medium">{nombreEnPapelera(e)}</span></td>
              <td className="whitespace-nowrap">{fechaHora(e.fecha)}</td>
              <td className="text-sm">{e.por}</td>
              <td className="text-right">{!soloLectura(usuario) && <Button className="!py-1 text-xs" onClick={() => { const r = recuperar(e.id); setAviso(r ?? `Recuperado: ${COLECCIONES_PAPELERA[e.coleccion]} ${nombreEnPapelera(e)}`) }}><RotateCcw size={13} />Recuperar</Button>}</td>
            </tr>)}</tbody>
          </table></Scroll></div>
          {!papelera.length && <p className="py-8 text-center text-sm text-muted">La papelera está vacía.</p>}
        </Card>}
        {tab === 'bitacora' && <Card titulo="Bitácora" accion={<div className="flex w-full flex-wrap gap-2 sm:w-auto"><select className="inp !w-auto" value={vista} onChange={(e) => setVista(e.target.value as 'eventos')}><option value="eventos">Eventos del sistema</option><option value="movimientos">Movimientos de inventario</option></select><input className="inp min-w-0 flex-1 sm:!w-56 sm:flex-none" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>}>
          <div className="max-h-[520px] overflow-auto"><Scroll><table className="tabla">
            {vista === 'eventos' ? <><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th><th>Sucursal</th></tr></thead>
              <tbody>{ev.map((e) => <tr key={e.id}><td>{fechaHora(e.fecha)}</td><td>{e.usuario}</td><td><Badge tono="azul">{e.accion}</Badge></td><td className="max-w-xs truncate">{e.detalle}</td><td>{e.sucursal}</td></tr>)}</tbody></>
              : <><thead><tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Producto</th><th>Sucursal</th><th className="num">Cant.</th></tr></thead>
                <tbody>{mv.map((m) => <tr key={m.id}><td>{fechaHora(m.fecha)}</td><td>{m.usuario}</td><td><Badge tono={m.cantidad > 0 ? 'verde' : m.tipo === 'Merma' ? 'ambar' : 'gris'}>{m.tipo}</Badge></td><td>{productos.find((p) => p.id === m.productoId)?.nombre}</td><td>{m.sucursal}</td><td className={`num ${m.cantidad > 0 ? 'text-exito' : 'text-peligro'}`}>{m.cantidad}</td></tr>)}</tbody></>}
          </table></Scroll></div>
        </Card>}
        {tab === 'mapa' && <Card titulo="Mapa global de sucursales">
          <Suspense fallback={<div className="espacio h-[420px] rounded-xl" />}>
            <Globo className="h-[420px]" puntos={SUCURSALES.map((s) => ({ id: s.id, nombre: `${s.nombre}`, lat: s.lat, lng: s.lng, valor: valorInventario(productos, s.id) + 1, detalle: `${s.direccion || s.ciudad}\nInventario: ${money(valorInventario(productos, s.id), 0)}` }))} />
          </Suspense>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs">{SUCURSALES.map((s) => <li key={s.id} className="flex justify-between gap-2"><span className="truncate">{s.nombre}</span><span className="tnum text-muted">{productos.reduce((a, p) => a + stockTotal(p, s.id), 0)} u</span></li>)}<li className="flex justify-between font-semibold"><span>Total</span><span className="tnum">{productos.reduce((a, p) => a + stockTotal(p), 0)} u</span></li></ul>
        </Card>}
    </div>
  )
}
