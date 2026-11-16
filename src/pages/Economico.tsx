import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calculator, Copy, FileSpreadsheet, FileText, MessageCircleQuestion, Plus, Save, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useEcon } from '../store/useEcon'
import { useApp } from '../store/useApp'
import { Badge, Button, Campo, Modal, NumInput, Tabs, Titulo, cx } from '../components/ui'
import Parametros from './econ/Parametros'
import Asesor from './econ/Asesor'
import * as A from './econ/TabsA'
import * as B from './econ/TabsB'
import { exportarAnalisisExcel, exportarAnalisisPDF } from '../lib/export'
import { etq, reemplazo, type Concepto } from '../lib/finance'
import { PLANTILLAS, crearParams, gastosAnuales, type Plantilla } from '../lib/evaluaciones'
import { money } from '../lib/format'
import { PROYECTO } from '../data/proyecto'

export const TABS = [
  { id: 'comparacion', label: 'a · Costos', C: A.Comparacion }, { id: 'reemplazo', label: 'b · Reemplazo', C: A.Reemplazo },
  { id: 'enfoques', label: 'c · Enfoques', C: A.Enfoques }, { id: 'estudio', label: 'd · Período de estudio', C: A.Estudio },
  { id: 'vida', label: 'e · Vida útil', C: A.VidaUtil }, { id: 'depreciacion', label: 'f · Depreciación', C: B.Depreciacion },
  { id: 'impuestos', label: 'g · Después de impuestos', C: B.Impuestos }, { id: 'indicadores', label: 'h · Indicadores', C: B.Indicadores },
  { id: 'sensibilidad', label: 'i · Sensibilidad', C: B.Sensibilidad }, { id: 'inflacion', label: 'j · Inflación', C: B.Inflacion },
  { id: 'recomendacion', label: 'k · ¿Con mi dinero?', C: B.Recomendacion }, { id: 'escenarios', label: 'Escenarios', C: B.Escenarios },
  { id: 'asesor', label: '✦ Asesor', C: Asesor },
] as const

/** Asistente para crear una evaluación de la empresa con sus propios valores. */
function NuevaEvaluacion({ abierto, cerrar, inicial = 'nexora' }: { abierto: boolean; cerrar: () => void; inicial?: Plantilla }) {
  const nuevaEvaluacion = useEcon((s) => s.nuevaEvaluacion)
  const gastos = useApp((s) => s.gastos)
  const reales = gastosAnuales(gastos)
  const [pl, setPl] = useState<Plantilla>(inicial)
  const [et, setEt] = useState({ ...PLANTILLAS[inicial].etiquetas })
  const [inv, setInv] = useState<[number, number, number]>([0, 0, 0])
  const [conceptos, setConceptos] = useState<Concepto[]>(PLANTILLAS[inicial].conceptos.map((nombre) => ({ nombre, actual: 0, nuevo: 0 })))
  const [d, setD] = useState({ vmHoy: 0, costoOriginal: 0, edad: 5, vidaRestante: 4, rescate: 0, n: 5, tmar: 12 })
  const [error, setError] = useState('')
  const elegir = (x: Plantilla) => { setPl(x); setEt({ ...PLANTILLAS[x].etiquetas }); setConceptos(PLANTILLAS[x].conceptos.map((nombre) => ({ nombre, actual: 0, nuevo: 0 }))) }
  const setC = (k: number, c: Partial<Concepto>) => setConceptos(conceptos.map((x, i) => (i === k ? { ...x, ...c } : x)))
  const crear = () => {
    if (!et.evaluacion.trim()) return setError('Ponga un nombre a la evaluación.')
    if (inv[0] + inv[1] + inv[2] <= 0) return setError('Escriba cuánto cuesta la alternativa (la inversión).')
    if (!conceptos.some((c) => c.actual > 0 || c.nuevo > 0)) return setError('Escriba al menos un costo anual de hoy y con la alternativa.')
    nuevaEvaluacion(crearParams({ etiquetas: et, inversion: inv, conceptos: conceptos.filter((c) => c.nombre.trim()), ...d, tmar: d.tmar / 100 }))
    cerrar()
  }
  const total = (k: 'actual' | 'nuevo') => conceptos.reduce((a, c) => a + c[k], 0)
  return (
    <Modal abierto={abierto} onClose={cerrar} titulo="Nueva evaluación de inversión" ancho="max-w-4xl">
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(PLANTILLAS) as Plantilla[]).map((x) => (
          <button key={x} onClick={() => elegir(x)} className={cx('rounded-2xl border p-3 text-left transition', pl === x ? 'border-primario/60 bg-primario/10' : 'border-fg/10 hover:bg-fg/5')}>
            <div className="text-sm font-semibold">{PLANTILLAS[x].titulo}</div><div className="text-xs text-muted">{PLANTILLAS[x].ayuda}</div></button>))}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Nombre de la evaluación"><input className="inp" value={et.evaluacion} onChange={(e) => setEt({ ...et, evaluacion: e.target.value })} /></Campo>
          <Campo label="Lo que tiene hoy (defensor)"><input className="inp" value={et.defensor} onChange={(e) => setEt({ ...et, defensor: e.target.value })} /></Campo>
          <Campo label="La alternativa nueva (retador)"><input className="inp" value={et.retador} onChange={(e) => setEt({ ...et, retador: e.target.value })} /></Campo>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-[.18em] text-muted">Inversión en «{et.retador}»</span>{pl === 'nexora' && <Button className="text-xs" onClick={() => setInv([PROYECTO.licencia, PROYECTO.implementacion, PROYECTO.capacitacion])}>Usar el precio de NEXORA Pro ({money(PROYECTO.licencia + PROYECTO.implementacion + PROYECTO.capacitacion, 0)})</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-3">{et.inversion.map((n, k) => <Campo key={k} label={n}><NumInput step={100} min={0} value={inv[k]} onChange={(v) => setInv(inv.map((x, i) => (i === k ? v : x)) as [number, number, number])} /></Campo>)}</div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[.18em] text-muted">Costos anuales</span>
            {reales.length > 0 && <Button className="text-xs" onClick={() => setConceptos(reales)}>Usar mis gastos reales del último año</Button>}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_8rem_2rem] gap-2 text-[11px] text-muted"><span>Concepto</span><span>Hoy ({et.defensor})</span><span>Con {et.retador}</span><span /></div>
            {conceptos.map((c, k) => <div key={k} className="grid grid-cols-[1fr_8rem_8rem_2rem] items-center gap-2">
              <input className="inp" value={c.nombre} onChange={(e) => setC(k, { nombre: e.target.value })} />
              <NumInput step={100} min={0} value={c.actual} onChange={(v) => setC(k, { actual: v })} /><NumInput step={100} min={0} value={c.nuevo} onChange={(v) => setC(k, { nuevo: v })} />
              <button aria-label="Quitar" className="rounded-lg p-1.5 text-muted hover:bg-fg/10" onClick={() => setConceptos(conceptos.filter((_, i) => i !== k))}><X size={14} /></button></div>)}
            <div className="flex items-center justify-between"><Button className="text-xs" onClick={() => setConceptos([...conceptos, { nombre: '', actual: 0, nuevo: 0 }])}><Plus size={13} />Agregar costo</Button>
              <span className="text-xs text-muted">Ahorro anual: <b className={cx('tnum', total('actual') - total('nuevo') >= 0 ? 'text-exito' : 'text-peligro')}>{money(total('actual') - total('nuevo'))}</b></span></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo label={`Valor de venta hoy (${et.defensor})`}><NumInput step={100} min={0} value={d.vmHoy} onChange={(v) => setD({ ...d, vmHoy: v })} /></Campo>
          <Campo label="Lo que costó cuando se compró"><NumInput step={100} min={0} value={d.costoOriginal} onChange={(v) => setD({ ...d, costoOriginal: v })} /></Campo>
          <Campo label="Años de uso"><NumInput min={0} value={d.edad} onChange={(v) => setD({ ...d, edad: v })} /></Campo>
          <Campo label="Años que le quedan"><NumInput min={1} max={8} value={d.vidaRestante} onChange={(v) => setD({ ...d, vidaRestante: v })} /></Campo>
          <Campo label={`Valor de rescate de ${et.retador}`} ayuda="Lo que valdrá al final"><NumInput step={100} min={0} value={d.rescate} onChange={(v) => setD({ ...d, rescate: v })} /></Campo>
          <Campo label="Años a evaluar (n)"><NumInput min={1} max={8} value={d.n} onChange={(v) => setD({ ...d, n: v })} /></Campo>
          <Campo label="TMAR (%)" ayuda="Rendimiento mínimo que exige"><NumInput step={0.5} min={0} value={d.tmar} onChange={(v) => setD({ ...d, tmar: v })} /></Campo>
        </div>
        <p className="text-[11px] text-muted">NEXORA arma el resto del caso con supuestos razonables (el valor de mercado y los costos cambian año a año); puede ajustar todo después en «Parámetros».</p>
        {error && <p className="text-sm text-peligro">{error}</p>}
        <div className="flex justify-end gap-2"><Button onClick={cerrar}>Cancelar</Button><Button variante="primario" onClick={crear}>Crear y analizar</Button></div>
      </div>
    </Modal>
  )
}

export default function Economico() {
  const { p, tab, setTab, guardar, evaluaciones, activa, abrirEvaluacion, duplicarEvaluacion, eliminarEvaluacion } = useEcon()
  const presentacion = useApp((s) => s.presentacion)
  const [panel, setPanel] = useState(true)
  const [nueva, setNueva] = useState<Plantilla | null>(null)
  const T = TABS.find((t) => t.id === tab) ?? TABS[0]
  const R = reemplazo(p), E = etq(p)
  if (!activa) return (
    <div>
      <Titulo titulo="Análisis económico" sub="Evalúe sus inversiones con fórmulas reales: CAUE, VPN, TIR, depreciación, impuestos, sensibilidad e inflación" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="glass relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-primario/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 via-primario to-violeta text-black"><Calculator size={22} /></span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">Cree su primera evaluación</h2>
          <p className="mt-2 text-muted">Ingrese lo que tiene hoy, la alternativa que piensa comprar y cuánto invertiría. NEXORA calcula si le conviene reemplazar y le muestra cada fórmula paso a paso; el Asesor responde sus preguntas con esos mismos números.</p>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(PLANTILLAS) as Plantilla[]).map((x, k) => (
          <motion.button key={x} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + k * 0.06 }} whileHover={{ y: -4 }} onClick={() => setNueva(x)}
            className={cx('rounded-2xl border p-4 text-left transition', k === 0 ? 'border-primario/60 bg-primario/10' : 'border-fg/10 bg-fg/[.03] hover:bg-fg/5')}>
            <div className="font-semibold">{PLANTILLAS[x].titulo}</div><div className="mt-1 text-xs text-muted">{PLANTILLAS[x].ayuda}</div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primario"><Plus size={13} />Empezar</div>
          </motion.button>))}</div>
      </motion.div>
      <NuevaEvaluacion key={nueva ?? 'cerrado'} abierto={!!nueva} inicial={nueva ?? 'nexora'} cerrar={() => setNueva(null)} />
    </div>
  )
  return (
    <div>
      <Titulo titulo="Análisis económico" sub={`${E.evaluacion} · ${E.defensor} (defensor) frente a ${E.retador} (retador) — todo se recalcula en tiempo real`}>
        <Badge tono={R.reemplazarAhora ? 'verde' : 'ambar'}>{R.veredicto}</Badge>
        <Button onClick={() => setPanel(!panel)}><SlidersHorizontal size={15} />Parámetros</Button>
        <Button onClick={() => { const n = prompt('Nombre del escenario:', `Escenario TMAR ${(p.i * 100).toFixed(0)} %`); if (n) { guardar(n); setTab('escenarios') } }}><Save size={15} />Guardar escenario</Button>
        <Button onClick={() => exportarAnalisisExcel(p)}><FileSpreadsheet size={15} />Excel</Button>
        <Button onClick={() => exportarAnalisisPDF(p)}><FileText size={15} />PDF</Button>
        <Button variante="primario" onClick={() => setTab('asesor')}><MessageCircleQuestion size={15} />Asesor</Button>
      </Titulo>

      {/* Evaluaciones de la empresa */}
      <div className="glass mb-4 flex flex-wrap items-center gap-2 p-2">
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[.2em] text-muted">Evaluaciones</span>
        {evaluaciones.map((e) => (
          <motion.button layout key={e.id} onClick={() => abrirEvaluacion(e.id)} className={cx('relative rounded-xl px-3 py-1.5 text-left text-xs transition', e.id === activa ? 'text-black' : 'text-muted hover:bg-fg/5 hover:text-fg')}>
            {e.id === activa && <motion.span layoutId="evalActiva" className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-200 via-primario to-violeta" transition={{ type: 'spring', duration: 0.45 }} />}
            <span className="relative font-semibold">{etq(e.params).evaluacion}</span>
          </motion.button>))}
        <div className="ml-auto flex gap-1.5">
          <Button className="text-xs" onClick={duplicarEvaluacion} title="Duplicar la evaluación abierta"><Copy size={13} />Duplicar</Button>
          {activa && <Button variante="peligro" className="text-xs" onClick={() => { if (confirm(`¿Eliminar la evaluación «${E.evaluacion}»?`)) eliminarEvaluacion(activa) }}><Trash2 size={13} /></Button>}
          <Button variante="primario" className="text-xs" onClick={() => setNueva('nexora')}><Plus size={13} />Nueva evaluación</Button>
        </div>
      </div>

      <Tabs items={TABS.map((t) => ({ id: t.id, label: t.label }))} valor={T.id} onChange={setTab} />
      <div className={cx('mt-4 grid gap-4', panel && !presentacion && T.id !== 'asesor' && 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
        <div className="min-w-0 space-y-4"><T.C /></div>
        {panel && !presentacion && T.id !== 'asesor' && (
          <aside className="glass fixed inset-y-3 right-3 z-40 w-[min(360px,calc(100vw-1.5rem))] overflow-y-auto p-4 xl:sticky xl:top-24 xl:z-0 xl:h-[calc(100vh-7rem)] xl:w-auto" style={{ background: 'color-mix(in srgb, var(--bg2) 80%, transparent)' }}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Parámetros</h3><button aria-label="Cerrar panel" className="rounded-lg p-1 hover:bg-fg/10" onClick={() => setPanel(false)}><X size={16} /></button></div>
            <Parametros />
          </aside>
        )}
      </div>
      <NuevaEvaluacion key={nueva ?? 'cerrado'} abierto={!!nueva} inicial={nueva ?? 'nexora'} cerrar={() => setNueva(null)} />
    </div>
  )
}
