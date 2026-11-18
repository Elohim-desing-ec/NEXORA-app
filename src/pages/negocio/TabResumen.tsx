import { useMemo } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Boxes, Coins, FileDown, Package, Percent, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp, rolesDe } from '../../store/useApp'
import { Badge, Button, Card, Contador, Kpi, Scroll, cx } from '../../components/ui'
import { Degradados, Grafico, TooltipVidrio, ejes, rejilla } from '../../components/charts'
import { fecha, money, num, pct, plural } from '../../lib/format'
import { stockTotal, valorInventario } from '../../lib/inventario'
import { exportarTabla } from '../../lib/export'
import { EDITAN, MESES, agregar, cambioTrasCierre, estadoStock, gastosDe, idCierre, nombrePeriodo, usePeriodo, variacion, type Agregado } from '../../lib/resumen'
import { BarraPeriodo } from '../../components/BarraPeriodo'
import type { TabNegocio } from '../Resumen'

function Delta({ v }: { v: number | null }) {
  if (v === null) return <Badge>sin datos</Badge>
  return <Badge tono={v >= 0 ? 'verde' : 'rojo'}>{v >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{pct(Math.abs(v), 0)}</Badge>
}

export default function TabResumen({ irA }: { irA: (t: TabNegocio) => void }) {
  const { productos, movimientos, ventas, gastos, cierres, sucursal, usuario, quitarCierre, ir } = useApp()
  // Periodo compartido con Inventario (-1 = todo el año)
  const { anio, mes, setAnio, setMes } = usePeriodo()
  const puede = !!usuario && rolesDe(usuario).some((r) => EDITAN.includes(r))

  const d = useMemo(() => {
    const agg = (y: number, m: number, s = sucursal) => agregar(movimientos, productos, gastos, y, m, s, ventas)
    const a = agg(anio, mes)
    const meses = MESES.map((nombre, i) => ({ i, nombre, mes: nombre.slice(0, 3), ...agg(anio, i), cerrado: cierres.some((c) => c.id === idCierre(anio, i)) }))
    const anterior = mes === 0 ? [anio - 1, 11] : [anio, mes - 1]
    const comparar: [string, Agregado][] = mes < 0
      ? [[`Contra todo ${anio - 1}`, agg(anio - 1, -1)]]
      : [[`Mes anterior · ${nombrePeriodo(anterior[0], anterior[1])}`, agg(anterior[0], anterior[1])], [`Mismo mes del año pasado · ${nombrePeriodo(anio - 1, mes)}`, agg(anio - 1, mes)]]
    const estados = productos.map((p) => estadoStock(p, sucursal))
    return {
      a, meses, total: agg(anio, -1), comparar, nGastos: gastosDe(gastos, anio, mes, sucursal).length,
      stockU: productos.reduce((s, p) => s + stockTotal(p, sucursal), 0), stockV: valorInventario(productos, sucursal),
      bajos: estados.filter((e) => e !== 'OK').length, agotados: estados.filter((e) => e === 'Agotado').length,
      consolidado: (y: number, m: number) => agg(y, m, 'TODAS'),
    }
  }, [productos, movimientos, ventas, gastos, cierres, sucursal, anio, mes])

  const { a } = d
  const cierre = cierres.find((c) => c.id === idCierre(anio, mes))
  const cambio = cierre ? cambioTrasCierre(cierre, d.consolidado(anio, mes)) : false
  const lista = [...cierres].sort((x, y) => y.id.localeCompare(x.id))
  const periodo = nombrePeriodo(anio, mes)

  const exportar = (f: 'xlsx' | 'pdf') => exportarTabla(`Resumen ${anio}`, ['Mes', 'Ventas', 'Costo', 'Gastos', 'Ganancia neta', 'Unidades'],
    [...d.meses.map((m) => [m.nombre, money(m.ventas), money(m.costo), money(m.gastos), money(m.neta), m.unidades]), [`Total ${anio}`, money(d.total.ventas), money(d.total.costo), money(d.total.gastos), money(d.total.neta), d.total.unidades]], f)

  return (
    <div className="space-y-5">
      <BarraPeriodo />

      {/* Ganancia neta del periodo */}
      <Card className="relative overflow-hidden border-primario/30">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primario/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[.2em] text-muted">Ganancia neta · {periodo}</div>
            <div className={cx('mt-1 font-display text-4xl font-bold sm:text-6xl', a.neta < 0 ? 'text-peligro' : 'texto-oro')}><Contador valor={a.neta} formato={money} /></div>
            <p className="mt-2 text-sm text-muted">Ganancia bruta <b className="text-fg">{money(a.bruta)}</b> menos gastos <b className="text-fg">{money(a.gastos)}</b></p>
          </div>
          <div className="text-sm text-muted sm:text-right">Margen neto<div className={cx('font-display text-3xl font-bold', a.margen < 0 ? 'text-peligro' : 'text-fg')}>{pct(a.margen, 1)}</div></div>
        </div>
      </Card>

      {cierre && <div className={cx('rounded-xl border px-4 py-3 text-sm', cambio ? 'border-alerta/30 bg-alerta/10' : 'border-exito/30 bg-exito/10')}>
        <b>{periodo}</b> se cerró el {fecha(cierre.cerradoEl)}{cierre.cerradoPor && ` (${cierre.cerradoPor})`}. {cambio ? `Hubo cambios después del cierre: ganancia neta guardada ${money(cierre.neta)}, actual ${money(d.consolidado(anio, mes).neta)}.` : 'Los números actuales coinciden con el cierre.'}
      </div>}

      {/* Ventas y ganancia del periodo */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
        <Kpi titulo="Ventas totales" valor={a.ventas} formato={money} icono={<Coins size={15} />} sub={a.servicios ? `Incluye ${money(a.servicios)} en servicios` : undefined} />
        <Kpi titulo="Costo de lo vendido" valor={a.costo} formato={money} icono={<Package size={15} />} tono="ambar" sub="Al costo promedio" />
        <Kpi titulo="Ganancia bruta" valor={a.bruta} formato={money} icono={<TrendingUp size={15} />} tono="verde" sub="Ventas − costo" />
        <Kpi titulo="Gastos del negocio" valor={a.gastos} formato={money} icono={<Receipt size={15} />} tono="rojo" sub={<button className="underline-offset-2 hover:text-primario hover:underline" onClick={() => ir('gastos')}>{plural(d.nGastos, 'gasto', 'gastos')} · ver</button>} />
        <Kpi titulo="Margen neto" valor={a.margen * 100} formato={(v) => `${num(v, 1)} %`} icono={<Percent size={15} />} tono="violeta" sub="Ganancia neta ÷ ventas" />
        <Kpi titulo="Unidades vendidas" valor={a.unidades} formato={(v) => num(v, 0)} icono={<ShoppingBag size={15} />} tono="cian" />
      </div>

      {/* Stock hoy */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2"><h2 className="text-sm font-semibold">Stock hoy</h2><span className="text-xs text-muted">No depende del periodo elegido</span></div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2">
          <Kpi titulo="Unidades en stock" valor={d.stockU} formato={(v) => num(v, 0)} icono={<Boxes size={15} />} sub={plural(productos.length, 'producto registrado', 'productos registrados')} />
          <Kpi titulo="Dinero invertido en stock" valor={d.stockV} formato={money} icono={<Wallet size={15} />} tono="ambar" sub="Stock × costo promedio" />
          <Kpi titulo="Stock bajo o agotados" valor={d.bajos} formato={(v) => num(v, 0)} icono={<AlertTriangle size={15} />} tono="rojo"
            sub={d.bajos ? <>{plural(d.agotados, 'agotado', 'agotados')} · <button className="text-primario underline" onClick={() => irA('inventario')}>Ver inventario</button></> : 'Todo con stock suficiente'} />
        </div>
      </div>

      {/* Comparación */}
      <Card titulo="Comparación">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{d.comparar.map(([t, b]) => (
          <div key={t} className="rounded-xl bg-fg/5 p-4">
            <div className="mb-3 text-xs font-medium text-muted">{t}</div>
            {([['Ventas', a.ventas, b.ventas, money], ['Ganancia neta', a.neta, b.neta, money], ['Unidades vendidas', a.unidades, b.unidades, (v: number) => num(v, 0)]] as const).map(([n, ahora, antes, f]) => (
              <div key={n} className="flex flex-col gap-1 border-b border-fg/5 py-2 text-sm last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>{n}</span><span className="flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap tnum"><span className="text-muted">{f(antes)} →</span><b>{f(ahora)}</b><Delta v={variacion(ahora, antes)} /></span>
              </div>))}
          </div>))}</div>
      </Card>

      {/* Mes a mes */}
      <Card titulo={`Mes a mes · ${anio}`} accion={<div className="flex gap-2"><Button onClick={() => exportar('xlsx')}><FileDown size={14} />Excel</Button><Button onClick={() => exportar('pdf')}><FileDown size={14} />PDF</Button></div>}>
        <Grafico alto={260}>
          <BarChart data={d.meses} onClick={(e) => { if (e?.activeTooltipIndex != null) setMes(Number(e.activeTooltipIndex)) }}>
            <Degradados /><CartesianGrid {...rejilla} /><XAxis dataKey="mes" {...ejes} /><YAxis {...ejes} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${num(v / 1000, 0)}k` : num(v, 0))} />
            <Tooltip content={<TooltipVidrio />} cursor={{ fill: 'rgb(var(--fg) / .05)' }} /><Legend /><ReferenceLine y={0} stroke="rgb(var(--muted) / .4)" />
            <Bar dataKey="ventas" name="Ventas" fill="url(#g0)" radius={[6, 6, 0, 0]} /><Bar dataKey="neta" name="Ganancia neta" fill="url(#g3)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </Grafico>
        <Scroll><table className="tabla mt-4">
          <thead><tr><th>Mes</th><th className="num">Ventas</th><th className="num">Costo</th><th className="num">Gastos</th><th className="num">Ganancia neta</th><th className="num">Unidades</th></tr></thead>
          <tbody>{d.meses.map((m) => (
            <tr key={m.i} onClick={() => setMes(m.i)} className={cx('cursor-pointer', m.i === mes && 'bg-primario/10')}>
              <td><b>{m.nombre}</b> {m.cerrado && <Badge tono="azul">Cerrado</Badge>}</td><td className="num">{money(m.ventas)}</td><td className="num">{money(m.costo)}</td><td className="num">{money(m.gastos)}</td>
              <td className={cx('num font-semibold', m.neta < 0 && 'text-peligro')}>{money(m.neta)}</td><td className="num">{num(m.unidades, 0)}</td>
            </tr>))}
            <tr className="font-semibold"><td>Total {anio}</td><td className="num">{money(d.total.ventas)}</td><td className="num">{money(d.total.costo)}</td><td className="num">{money(d.total.gastos)}</td><td className={cx('num', d.total.neta < 0 ? 'text-peligro' : 'text-primario')}>{money(d.total.neta)}</td><td className="num">{num(d.total.unidades, 0)}</td></tr>
          </tbody>
        </table></Scroll>
        <p className="mt-2 text-[11px] text-muted">Toque un mes (en la tabla o en el gráfico) para verlo arriba.</p>
      </Card>

      {/* Historial de cierres */}
      <Card titulo="Historial de cierres" accion={<span className="text-xs text-muted">Fotos fijas de toda la empresa guardadas con «Cerrar mes»</span>}>
        <Scroll><table className="tabla">
          <thead><tr><th>Periodo</th><th className="num">Ventas</th><th className="num">Costo</th><th className="num">Gastos</th><th className="num">Ganancia neta</th><th className="num">Unidades</th><th className="num">Stock al cierre</th><th className="num">Valor del stock</th><th>Cerrado el</th><th></th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.id}>
              <td><b>{nombrePeriodo(c.anio, c.mes)}</b> {c.mes < 0 && <Badge tono="azul">Año</Badge>} {cambioTrasCierre(c, d.consolidado(c.anio, c.mes)) && <Badge tono="ambar">Cambió después</Badge>}</td>
              <td className="num">{money(c.ventas)}</td><td className="num">{money(c.costo)}</td><td className="num">{money(c.gastos)}</td><td className={cx('num font-semibold', c.neta < 0 && 'text-peligro')}>{money(c.neta)}</td>
              <td className="num">{num(c.unidades, 0)}</td><td className="num">{num(c.stockUnidades, 0)}</td><td className="num">{money(c.stockValor)}</td><td>{fecha(c.cerradoEl)}{c.cerradoPor && <span className="text-xs text-muted"> · {c.cerradoPor}</span>}</td>
              <td className="whitespace-nowrap text-right"><Button variante="fantasma" className="px-2 py-1 text-xs" onClick={() => { setAnio(c.anio); setMes(c.mes) }}>Ver</Button>{puede && <Button variante="fantasma" className="px-2 py-1 text-xs text-peligro" onClick={() => confirm(`¿Quitar el cierre de ${nombrePeriodo(c.anio, c.mes)}? Las ventas y gastos no se borran.`) && quitarCierre(c.id)}>Quitar</Button>}</td>
            </tr>))}
            {!lista.length && <tr><td colSpan={10} className="py-6 text-center text-muted">Todavía no ha cerrado ningún mes. Elija el periodo arriba y pulse «Cerrar mes» al terminar cada mes.</td></tr>}
          </tbody>
        </table></Scroll>
      </Card>
    </div>
  )
}
