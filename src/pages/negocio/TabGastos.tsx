import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useApp, rolesDe } from '../../store/useApp'
import type { Gasto } from '../../data/base'
import { Badge, Button, Campo, Card, Modal, MontoInput, Scroll } from '../../components/ui'
import { fecha, money, pct, plural } from '../../lib/format'
import { CATEGORIAS_GASTO, EDITAN, MESES, anios, enPeriodo, hoyISO, nombrePeriodo } from '../../lib/resumen'

const nuevoGasto = (): Gasto => ({ id: crypto.randomUUID(), fecha: hoyISO(), concepto: '', categoria: CATEGORIAS_GASTO[0], monto: 0, sucursal: '', nota: '' })

export default function TabGastos() {
  const { gastos, movimientos, cierres, sucursales, sucursal, usuario, guardarGasto, eliminarGasto } = useApp()
  const puede = !!usuario && rolesDe(usuario).some((r) => EDITAN.includes(r))
  const [q, setQ] = useState(''), [anio, setAnio] = useState(new Date().getFullYear()), [mes, setMes] = useState(-1), [cat, setCat] = useState('')
  const [form, setForm] = useState<Gasto | null>(null)
  const [error, setError] = useState('')

  const t = q.trim().toLowerCase()
  const lista = useMemo(() => gastos
    .filter((g) => (sucursal === 'TODAS' || g.sucursal === sucursal) && (!anio || enPeriodo(g.fecha, anio, mes)) && (!cat || g.categoria === cat) && (!t || `${g.concepto} ${g.nota ?? ''}`.toLowerCase().includes(t)))
    .sort((x, y) => y.fecha.localeCompare(x.fecha)), [gastos, sucursal, anio, mes, cat, t])
  const total = lista.reduce((a, g) => a + g.monto, 0)
  const porCategoria = CATEGORIAS_GASTO.map((c) => ({ c, v: lista.filter((g) => g.categoria === c).reduce((a, g) => a + g.monto, 0) })).filter((x) => x.v > 0).sort((x, y) => y.v - x.v)

  const guardar = () => {
    if (!form) return
    if (!form.fecha) return setError('Elija la fecha.')
    if (!form.concepto.trim()) return setError('Describa el gasto (por ejemplo: "Arriendo del local").')
    if (!(form.monto > 0)) return setError('El monto debe ser mayor que 0.')
    guardarGasto({ ...form, concepto: form.concepto.trim(), monto: Math.round(form.monto * 100) / 100 })
    setForm(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Arriendo, sueldos, luz, publicidad, envíos y todo lo que cuesta mover el negocio. Se restan de la ganancia bruta en el Resumen.</p>
        {puede && <Button variante="primario" onClick={() => { setError(''); setForm(nuevoGasto()) }}><Plus size={15} />Agregar gasto</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-9" type="search" placeholder="Buscar concepto o nota…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp w-auto" aria-label="Año" value={anio} onChange={(e) => setAnio(+e.target.value)}><option value={0}>Todos los años</option>{anios(movimientos, gastos, cierres).map((y) => <option key={y}>{y}</option>)}</select>
        <select className="inp w-auto" aria-label="Mes" value={mes} disabled={!anio} onChange={(e) => setMes(+e.target.value)}><option value={-1}>Todos los meses</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
        <select className="inp w-auto" aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas las categorías</option>{CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}</select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card titulo="Por categoría" accion={<span className="text-xs text-muted">{anio ? nombrePeriodo(anio, mes) : 'Todos los años'}</span>}>
          <div className="mb-4"><div className="text-xs text-muted">Total</div><div className="texto-oro font-display text-3xl font-bold tnum">{money(total)}</div><div className="text-xs text-muted">{plural(lista.length, 'gasto', 'gastos')}</div></div>
          <ul className="space-y-3 text-sm">{porCategoria.map(({ c, v }) => (
            <li key={c}><div className="mb-1 flex justify-between"><span>{c}</span><span className="tnum">{money(v)} · {pct(v / total, 0)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-fg/5"><div className="h-full rounded-full bg-gradient-to-r from-primario to-violeta" style={{ width: `${(v / porCategoria[0].v) * 100}%` }} /></div></li>))}
            {!porCategoria.length && <li className="text-muted">Sin gastos en este periodo.</li>}
          </ul>
        </Card>
        <Card titulo="Detalle" className="lg:col-span-2">
          <Scroll><table className="tabla">
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Sucursal</th><th className="num">Monto</th>{puede && <th></th>}</tr></thead>
            <tbody>{lista.map((g) => (
              <tr key={g.id}><td>{fecha(g.fecha + 'T12:00:00')}</td><td className="max-w-[16rem] truncate" title={g.nota || g.concepto}>{g.concepto}{g.nota && <span className="block truncate text-[11px] text-muted">{g.nota}</span>}</td><td><Badge>{g.categoria}</Badge></td><td>{g.sucursal || 'General'}</td><td className="num font-semibold">{money(g.monto)}</td>
                {puede && <td className="whitespace-nowrap text-right"><button aria-label="Editar gasto" className="rounded-lg p-1.5 hover:bg-fg/10" onClick={() => { setError(''); setForm(g) }}><Pencil size={14} /></button><button aria-label="Eliminar gasto" className="rounded-lg p-1.5 text-peligro hover:bg-peligro/10" onClick={() => confirm(`¿Eliminar el gasto "${g.concepto}" de ${money(g.monto)}?`) && eliminarGasto(g.id)}><Trash2 size={14} /></button></td>}
              </tr>))}
              {!lista.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No hay gastos con estos filtros.</td></tr>}
            </tbody>
          </table></Scroll>
        </Card>
      </div>

      <Modal abierto={!!form} onClose={() => setForm(null)} titulo={form && gastos.some((g) => g.id === form.id) ? 'Editar gasto' : 'Agregar gasto'} ancho="max-w-xl">
        {form && <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Fecha"><input type="date" className="inp" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Campo>
            <Campo label="Monto"><MontoInput value={form.monto} onChange={(v) => setForm({ ...form, monto: v })} /></Campo>
            <div className="sm:col-span-2"><Campo label="Concepto"><input className="inp" placeholder="Arriendo del local" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></Campo></div>
            <Campo label="Categoría"><select className="inp" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS_GASTO.map((c) => <option key={c}>{c}</option>)}</select></Campo>
            <Campo label="Sucursal" ayuda="General = gasto de toda la empresa"><select className="inp" value={form.sucursal} onChange={(e) => setForm({ ...form, sucursal: e.target.value })}><option value="">General</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.ciudad}</option>)}</select></Campo>
            <div className="sm:col-span-2"><Campo label="Nota (opcional)"><input className="inp" value={form.nota ?? ''} onChange={(e) => setForm({ ...form, nota: e.target.value })} /></Campo></div>
          </div>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <div className="flex justify-end gap-2"><Button onClick={() => setForm(null)}>Cancelar</Button><Button variante="primario" onClick={guardar}>Guardar gasto</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
