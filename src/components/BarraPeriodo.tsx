import { Lock } from 'lucide-react'
import { useApp, rolesDe } from '../store/useApp'
import { Button } from './ui'
import { stockTotal, valorInventario } from '../lib/inventario'
import { fecha, money, num } from '../lib/format'
import { EDITAN, MESES, agregar, anios, idCierre, nombrePeriodo, usePeriodo } from '../lib/resumen'

/**
 * Año, mes y «Cerrar mes». Es la misma barra en Resumen y en los dos Inventarios: comparten el periodo elegido
 * y los cierres (cerrar desde cualquiera guarda la misma foto de toda la empresa).
 */
export function BarraPeriodo() {
  const { productos, movimientos, ventas, gastos, cierres, usuario, cerrarPeriodo } = useApp()
  const { anio, mes, setAnio, setMes } = usePeriodo()
  const puede = !!usuario && rolesDe(usuario).some((r) => EDITAN.includes(r))
  const cierre = cierres.find((c) => c.id === idCierre(anio, mes))

  const cerrar = () => {
    if (!confirm(`¿${cierre ? 'Actualizar el cierre de' : 'Cerrar'} ${nombrePeriodo(anio, mes)}? Se guarda una foto fija de las ventas, gastos, ganancia y stock de toda la empresa.`)) return
    const t = agregar(movimientos, productos, gastos, anio, mes, 'TODAS', ventas)
    cerrarPeriodo({ id: idCierre(anio, mes), anio, mes, ventas: t.ventas, costo: t.costo, gastos: t.gastos, neta: t.neta, unidades: t.unidades, stockUnidades: productos.reduce((s, p) => s + stockTotal(p), 0), stockValor: valorInventario(productos), cerradoEl: new Date().toISOString(), cerradoPor: usuario?.nombre ?? '' })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select className="inp w-auto" aria-label="Año" value={anio} onChange={(e) => setAnio(+e.target.value)}>{anios(movimientos, gastos, cierres, ventas).map((y) => <option key={y}>{y}</option>)}</select>
      <select className="inp w-auto" aria-label="Mes" value={mes} onChange={(e) => setMes(+e.target.value)}><option value={-1}>Todo el año</option>{MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
      {puede && <Button variante="primario" onClick={cerrar}><Lock size={15} />{cierre ? 'Actualizar cierre' : mes < 0 ? 'Cerrar año' : 'Cerrar mes'}</Button>}
    </div>
  )
}

/** Una línea con el estado del cierre del periodo elegido (para los Inventarios: stock y valor guardados al cerrar). */
export function EstadoCierre() {
  const cierres = useApp((s) => s.cierres)
  const { anio, mes } = usePeriodo()
  const c = cierres.find((x) => x.id === idCierre(anio, mes))
  const periodo = nombrePeriodo(anio, mes)
  return (
    <p className="text-xs text-muted">
      {c ? <><b className="text-fg">{periodo}</b> cerrado el {fecha(c.cerradoEl)}{c.cerradoPor && ` (${c.cerradoPor})`} · stock al cierre {num(c.stockUnidades, 0)} u · {money(c.stockValor)}</>
        : <><b className="text-fg">{periodo}</b> sin cerrar. Al cerrar se guarda el stock y su valor de ese momento.</>}
    </p>
  )
}
