import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, Boxes, Briefcase, Coins, DollarSign, HeartPulse, PiggyBank, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, TrendingDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp, tieneRol } from '../store/useApp'
import { useEcon } from '../store/useEcon'
import { Badge, Card, Contador, Titulo, cx } from '../components/ui'
import { COLORES, Degradados, Grafico, ejes, rejilla } from '../components/charts'
import { money, num, pct, fechaHora, plural } from '../lib/format'
import { enQuiebre, stockTotal, valorInventario } from '../lib/inventario'
import { anomalias } from '../lib/ai'
import { MESES, periodoDe, serviciosDe, variacion } from '../lib/resumen'
import { bandera } from '../data/paises'
import { saludNegocio, type NivelSalud } from '../lib/salud'
import { indicadoresSector, perfilDe } from '../lib/sectores'
import * as F from '../lib/finance'

const suave = [0.16, 1, 0.3, 1] as const
const f$ = (v: number) => money(v, 0), fU = (v: number) => num(v, 0), fX = (v: number) => `${num(v, 1)}×`, fP = (v: number) => `${num(v, 1)} %`
const corto = (v: number) => (Math.abs(v) >= 1e6 ? `${num(v / 1e6, 1)}M` : Math.abs(v) >= 1e3 ? `${num(v / 1e3, 1)}k` : num(v, 0))
const ANILLOS = [COLORES[0], COLORES[2], COLORES[1]]
const BURBUJAS = [{ x: 192, y: 112, c: COLORES[0], t: '#0A0907' }, { x: 94, y: 150, c: COLORES[2], t: '#0A0907' }, { x: 102, y: 64, c: COLORES[1], t: '#0A0907' }, { x: 266, y: 188, c: 'rgb(var(--t-oro)/.45)', t: 'rgb(var(--fg))' }]

/** Insignia de variación (+/− %) frente al periodo anterior. */
function Cambio({ v, invertir = false, oscuro = false }: { v: number | null; invertir?: boolean; oscuro?: boolean }) {
  if (v === null || !Number.isFinite(v)) return <span className={cx('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px]', oscuro ? 'bg-black/15 text-black/70' : 'bg-fg/10 text-muted')}>sin datos previos</span>
  const bueno = invertir ? v <= 0 : v >= 0
  return <span className={cx('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tnum sm:text-[11px]', oscuro ? 'bg-black/80 text-primario' : bueno ? 'bg-exito/15 text-exito' : 'bg-peligro/15 text-peligro')}>{v >= 0 ? '+' : '−'}{num(Math.abs(v) * 100, 1)} %</span>
}
const Etiqueta = ({ children, tono = 'gris' }: { children: ReactNode; tono?: 'gris' | 'verde' | 'rojo' }) =>
  <span className={cx('inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px]', { gris: 'bg-fg/10 text-muted', verde: 'bg-exito/15 text-exito', rojo: 'bg-peligro/15 text-peligro' }[tono])}>{children}</span>

/** Tarjeta de indicador: ícono, variación, título, cifra animada y nota. La destacada va en dorado. */
function Tarjeta({ titulo, valor, formato, icono, cambio, nota, destacada, compacta, onClick, i = 0 }: { titulo: string; valor: number; formato: (v: number) => string; icono: ReactNode; cambio?: ReactNode; nota?: ReactNode; destacada?: boolean; compacta?: boolean; onClick?: () => void; i?: number }) {
  return (
    <motion.button type="button" onClick={onClick} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.7, ease: suave }} whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }}
      className={cx('group relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-4 text-left sm:p-5', compacta ? 'min-h-[120px] sm:min-h-[132px]' : 'min-h-[150px] sm:min-h-[172px]', destacada ? 'bg-gradient-to-br from-amber-200 via-primario to-violeta text-black shadow-[0_24px_70px_-24px_rgb(var(--t-oro)/.75)]' : 'glass glass-hover')}>
      {destacada && <><span className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/30 blur-2xl" /><span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/10 blur-2xl" /></>}
      <div className="relative flex items-start justify-between gap-2 [&>*:last-child]:min-w-0 [&>*:last-child]:text-right">
        <span className={cx('grid shrink-0 place-items-center rounded-xl transition group-hover:scale-105', compacta ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-9 w-9 sm:h-11 sm:w-11', destacada ? 'bg-black/85 text-primario' : 'bg-fg/5 text-primario ring-1 ring-fg/10')}>{icono}</span>
        {cambio}
      </div>
      <div className={cx('relative mt-auto pt-3 text-xs font-medium leading-snug sm:pt-4 sm:text-sm', destacada ? 'text-black/70' : 'text-muted')}>{titulo}</div>
      <div className="relative mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className={cx('min-w-0 break-words font-display font-bold tracking-tight', compacta ? 'text-lg sm:text-2xl' : 'text-xl sm:text-3xl')}><Contador valor={valor} formato={formato} /></span>
        {nota && <span className={cx('text-[11px] leading-tight sm:text-xs', destacada ? 'text-black/60' : 'text-muted')}>{nota}</span>}
      </div>
    </motion.button>
  )
}

/** Panel con título, subtítulo y control a la derecha. */
function Panel({ titulo, sub, accion, children, className }: { titulo: ReactNode; sub?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, ease: suave }} className={cx('glass flex min-w-0 flex-col p-5 sm:p-6', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold tracking-tight">{titulo}</h3>{sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}</div>{accion}</header>
      {children}
    </motion.section>
  )
}

/** Control segmentado tipo píldora. */
function Selector<T extends string>({ id, opciones, valor, onChange }: { id: string; opciones: [T, string][]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full border border-fg/10 bg-fg/5 p-0.5 text-[11px] font-medium">
      {opciones.map(([v, t]) => <button key={v} type="button" onClick={() => onChange(v)} className={cx('relative rounded-full px-2.5 py-1 transition', valor === v ? 'text-black' : 'text-muted hover:text-fg')}>
        {valor === v && <motion.span layoutId={`sel-${id}`} className="absolute inset-0 rounded-full bg-gradient-to-r from-primario to-violeta" transition={{ type: 'spring', duration: 0.45 }} />}<span className="relative">{t}</span></button>)}
    </div>
  )
}

type PT = { active?: boolean; label?: string; payload?: { dataKey?: string | number; name?: string; value?: number }[] }
/** Tooltip oscuro con puntos de color (como una burbuja de chat). */
function TooltipOscuro({ active, payload, label, colores }: PT & { colores: Record<string, string> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-[#0A0907]/95 px-3 py-2 text-xs text-stone-100 shadow-2xl ring-1 ring-primario/30 backdrop-blur">
      <div className="mb-1 font-semibold text-primario">{label}</div>
      {payload.filter((p) => p.value).map((p) => <div key={String(p.dataKey)} className="flex items-center justify-between gap-5 tnum"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: colores[String(p.dataKey)] }} />{p.name}</span><b>{money(p.value ?? 0)}</b></div>)}
    </div>
  )
}

/** Anillos concéntricos: cada anillo es la parte de una categoría en el total (sobre un arco de 270°). */
function Anillos({ datos, total, activo, onActivo }: { datos: { nombre: string; valor: number }[]; total: number; activo: number | null; onActivo: (i: number | null) => void }) {
  const t = 210, c = t / 2, g = 13, sep = 7
  return (
    <svg viewBox={`0 0 ${t} ${t}`} className="h-[210px] w-[210px] shrink-0">
      {[0, 1, 2].map((k) => {
        const r = c - g / 2 - 2 - k * (g + sep), d = datos[k], parte = d && total ? d.valor / total : 0
        return <g key={k} transform={`rotate(45 ${c} ${c})`} onMouseEnter={() => d && onActivo(k)} onMouseLeave={() => onActivo(null)} className={d ? 'cursor-pointer' : ''}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="rgb(var(--fg) / .08)" strokeWidth={g} strokeLinecap="round" pathLength={100} strokeDasharray="75 100" />
          {d && <motion.circle cx={c} cy={c} r={r} fill="none" stroke={ANILLOS[k]} strokeWidth={g} strokeLinecap="round" pathLength={100}
            initial={{ strokeDasharray: '0 100' }} animate={{ strokeDasharray: `${Math.max(1.5, 75 * parte)} 100`, opacity: activo === null || activo === k ? 1 : 0.3 }} transition={{ duration: 1.3, delay: 0.15 * k, ease: suave }} />}
        </g>
      })}
    </svg>
  )
}

/** Medidor semicircular del puntaje de salud (0-100). */
function Medidor({ puntaje, nivel }: { puntaje: number; nivel: NivelSalud }) {
  const tono = { Alto: 'text-exito', Medio: 'text-alerta', Bajo: 'text-peligro', 'Sin datos': 'text-muted' }[nivel]
  const arco = 'M 16 112 A 94 94 0 0 1 204 112'
  return (
    <div className="relative mx-auto w-[230px]">
      <svg viewBox="0 0 220 124" className="w-full">
        <defs><linearGradient id="saludG" x1="0" x2="1"><stop offset="0%" stopColor={COLORES[1]} /><stop offset="60%" stopColor={COLORES[0]} /><stop offset="100%" stopColor={COLORES[2]} /></linearGradient></defs>
        <path d={arco} fill="none" stroke="rgb(var(--fg) / .08)" strokeWidth={16} strokeLinecap="round" />
        <motion.path d={arco} fill="none" stroke="url(#saludG)" strokeWidth={16} strokeLinecap="round" pathLength={100} initial={{ strokeDasharray: '0 100' }} whileInView={{ strokeDasharray: `${Math.max(0.5, puntaje)} 100` }} viewport={{ once: true }} transition={{ duration: 1.5, ease: suave }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="font-display text-4xl font-bold tracking-tight"><Contador valor={puntaje} formato={fU} /><span className="text-base font-medium text-muted"> /100</span></div>
        <div className={cx('text-sm font-semibold', tono)}>{nivel === 'Sin datos' ? 'Registre ventas para medirla' : `Rendimiento ${nivel.toLowerCase()}`}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { productos, movimientos, ventas, sucursal, auditoria, empresa, sucursales: SUCURSALES, proveedores, usuario, ir, setSucursal } = useApp()
  const perfil = perfilDe(empresa.sector)
  const p = useEcon((s) => s.p)
  const [vista, setVista] = useState<'resumen' | 'sucursal'>('resumen')
  const [rango, setRango] = useState<'anio' | 'doce'>('anio')
  const [metrica, setMetrica] = useState<'ventas' | 'stock'>('ventas')
  const [catP, setCatP] = useState<'mes' | 'anioC' | null>(null)
  const [activo, setActivo] = useState<number | null>(null)
  const [burbuja, setBurbuja] = useState<string | null>(null)

  const d = useMemo(() => {
    const hoy = new Date(), Y = hoy.getFullYear(), M = hoy.getMonth(), hace30 = Date.now() - 30 * 864e5
    const precio = new Map(productos.map((x) => [x.id, x.precio])), cat = new Map(productos.map((x) => [x.id, x.categoria]))
    const valor = productos.reduce((s, x) => s + stockTotal(x, sucursal) * x.costo, 0)
    // Un solo recorrido de los movimientos: meses, categorías, ventas de 30 días por sucursal y valor del stock hace 30 días.
    const meses = new Map<string, { ventas: number; costo: number; unidades: number; suc: Record<string, number> }>()
    const cats = new Map<string, { mes: number; mesAnt: number; anio: number; anioAnt: number; uMes: number; uMesAnt: number; uAnio: number; uAnioAnt: number }>()
    const v30: Record<string, number> = {}
    let cmv30 = 0, cambio30 = 0
    const ant = M === 0 ? { a: Y - 1, m: 11 } : { a: Y, m: M - 1 }
    for (const m of movimientos) {
      const t = new Date(m.fecha).getTime(), aqui = sucursal === 'TODAS' || m.sucursal === sucursal
      if (t > hace30 && aqui && !(sucursal === 'TODAS' && m.tipo === 'Transferencia')) cambio30 += m.cantidad * m.costoUnit
      if (m.tipo !== 'Venta') continue
      const q = -m.cantidad, v = q * (m.precioUnit ?? precio.get(m.productoId) ?? 0), pd = periodoDe(m.fecha)
      if (t > hace30) v30[m.sucursal] = (v30[m.sucursal] ?? 0) + v
      const k = `${pd.anio}-${pd.mes}`, mm = meses.get(k) ?? { ventas: 0, costo: 0, unidades: 0, suc: {} }
      mm.suc[m.sucursal] = (mm.suc[m.sucursal] ?? 0) + v
      if (aqui) { mm.ventas += v; mm.costo += q * m.costoUnit; mm.unidades += q }
      meses.set(k, mm)
      if (!aqui) continue
      if (t > hace30) cmv30 += q * m.costoUnit
      const c = cat.get(m.productoId) ?? 'Otros', cc = cats.get(c) ?? { mes: 0, mesAnt: 0, anio: 0, anioAnt: 0, uMes: 0, uMesAnt: 0, uAnio: 0, uAnioAnt: 0 }
      if (pd.anio === Y && pd.mes === M) { cc.mes += v; cc.uMes += q }
      if (pd.anio === ant.a && pd.mes === ant.m) { cc.mesAnt += v; cc.uMesAnt += q }
      if (pd.anio === Y) { cc.anio += v; cc.uAnio += q }
      if (pd.anio === Y - 1) { cc.anioAnt += v; cc.uAnioAnt += q }
      cats.set(c, cc)
    }
    // Servicios y otros ingresos (no pasan por el inventario): suman en ventas, barras y en la categoría «Servicios»
    for (const x of serviciosDe(ventas)) {
      const t = new Date(x.fecha).getTime(), aqui = sucursal === 'TODAS' || x.sucursal === sucursal, pd = periodoDe(x.fecha)
      if (t > hace30) v30[x.sucursal] = (v30[x.sucursal] ?? 0) + x.monto
      const k = `${pd.anio}-${pd.mes}`, mm = meses.get(k) ?? { ventas: 0, costo: 0, unidades: 0, suc: {} }
      mm.suc[x.sucursal] = (mm.suc[x.sucursal] ?? 0) + x.monto
      if (aqui) { mm.ventas += x.monto; mm.costo += x.costo }
      meses.set(k, mm)
      if (!aqui) continue
      const cc = cats.get('Servicios') ?? { mes: 0, mesAnt: 0, anio: 0, anioAnt: 0, uMes: 0, uMesAnt: 0, uAnio: 0, uAnioAnt: 0 }
      if (pd.anio === Y && pd.mes === M) cc.mes += x.monto
      if (pd.anio === ant.a && pd.mes === ant.m) cc.mesAnt += x.monto
      if (pd.anio === Y) cc.anio += x.monto
      if (pd.anio === Y - 1) cc.anioAnt += x.monto
      cats.set('Servicios', cc)
    }
    const de = (a: number, m: number) => meses.get(`${a}-${m}`) ?? { ventas: 0, costo: 0, unidades: 0, suc: {} as Record<string, number> }
    const mes = de(Y, M), mesAnt = de(ant.a, ant.m)
    // Barras: este año (enero → mes actual) o los últimos 12 meses
    const lista = rango === 'anio' ? Array.from({ length: M + 1 }, (_, i) => ({ a: Y, m: i })) : Array.from({ length: 12 }, (_, k) => { const f = new Date(Y, M - 11 + k, 1); return { a: f.getFullYear(), m: f.getMonth() } })
    const v180: Record<string, number> = {}
    for (const { a, m } of lista) for (const [s, v] of Object.entries(de(a, m).suc)) v180[s] = (v180[s] ?? 0) + v
    const top = [...SUCURSALES].sort((a, b) => (v180[b.id] ?? 0) - (v180[a.id] ?? 0)).slice(0, 6).map((s) => s.id)
    const barras = lista.map(({ a, m }) => { const x = de(a, m), otras = Object.entries(x.suc).filter(([s]) => !top.includes(s)).reduce((s, [, v]) => s + v, 0); return { mes: `${MESES[m].slice(0, 3)}${rango === 'doce' ? ` ${String(a).slice(2)}` : ''}`, ventas: x.ventas, costo: x.costo, ...Object.fromEntries(top.map((s) => [s, x.suc[s] ?? 0])), OTRAS: otras } })
    // Categorías: top 3 del periodo
    const periodo = catP ?? ([...cats.values()].some((c) => c.mes > 0) ? 'mes' : 'anioC')
    const catLista = [...cats.entries()].map(([nombre, c]) => periodo === 'mes' ? { nombre, valor: c.mes, antes: c.mesAnt, u: c.uMes, uAntes: c.uMesAnt } : { nombre, valor: c.anio, antes: c.anioAnt, u: c.uAnio, uAntes: c.uAnioAnt }).filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor)
    // Burbujas: todas las sucursales (no depende del filtro), por ventas de 30 días o valor del stock
    const porSuc = SUCURSALES.map((s) => ({ s, v: metrica === 'ventas' ? v30[s.id] ?? 0 : valorInventario(productos, s.id) })).sort((a, b) => b.v - a.v)
    // Exactitud = 1 − (unidades corregidas por ajustes y mermas / unidades movidas)
    const movidas = movimientos.reduce((a, m) => a + Math.abs(m.cantidad), 0)
    const corregidas = movimientos.filter((m) => m.tipo === 'Ajuste' || m.tipo === 'Merma').reduce((a, m) => a + Math.abs(m.cantidad), 0)
    return {
      valor, valorAntes: valor - cambio30, mes, mesAnt, barras, top, periodo, catLista, catTotal: catLista.reduce((a, c) => a + c.valor, 0),
      catU: catLista.reduce((a, c) => a + c.u, 0), catUAntes: catLista.reduce((a, c) => a + c.uAntes, 0), porSuc,
      rotacion: (cmv30 * 12) / Math.max(1, valor), exactitud: movidas ? 1 - corregidas / movidas : 1,
      salud: saludNegocio(movimientos, productos, Date.now(), perfil.margenMeta), sector: indicadoresSector(perfil, { productos, movimientos, ventas, sucursales: SUCURSALES }), quiebres: productos.filter((x) => enQuiebre(x, sucursal)), anom: anomalias(movimientos).slice(0, 5), hayVentas: meses.size > 0,
    }
  }, [productos, movimientos, ventas, sucursal, SUCURSALES, rango, metrica, catP, perfil])

  const hayEval = useEcon((s) => !!s.activa)
  const ahorro = hayEval ? F.ahorroAnual(p) : 0, vpn = hayEval ? F.indicadores(p).VPN : 0
  const hoyTxt = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const colores: Record<string, string> = { ventas: COLORES[0], costo: 'rgb(var(--muted))', OTRAS: '#A8A29E', ...Object.fromEntries(d.top.map((s, k) => [s, COLORES[k % COLORES.length]])) }
  const top3 = d.catLista.slice(0, 3), act = activo !== null ? top3[activo] : null
  const maxSuc = Math.max(1, ...d.porSuc.map((x) => x.v)), bur = d.porSuc.slice(0, 4).filter((x) => x.v > 0)

  return (
    <div className="space-y-5">
      <Titulo titulo="Dashboard ejecutivo" sub={`${hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1)} · ${empresa.nombre || 'Su empresa'} · ${sucursal === 'TODAS' ? `Consolidado · ${plural(SUCURSALES.length, 'sucursal', 'sucursales')} en ${plural(new Set(SUCURSALES.map((s) => s.pais)).size, 'país', 'países')}` : SUCURSALES.find((s) => s.id === sucursal)?.nombre}`}>
        {sucursal !== 'TODAS' && <button onClick={() => setSucursal('TODAS')} className="rounded-full border border-primario/30 bg-primario/10 px-3 py-1 text-xs font-medium text-primario hover:bg-primario/20">Ver todas las sucursales ✕</button>}
        <Badge tono="verde"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-exito" />En vivo</Badge>
      </Titulo>

      {!productos.length && <Card className="border-primario/30" titulo="Primeros pasos con sus datos reales">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">{([
          ['1', 'Datos de la empresa', 'Razón social, RUC y sucursales', 'configuracion', tieneRol(usuario, 'Gerente General')],
          ['2', 'Proveedores', `${proveedores.length} registrados`, 'compras', true],
          ['3', 'Productos', 'Uno por uno o con plantilla Excel', 'productos', true],
          ['4', 'Análisis económico', 'Costos actuales vs NEXORA', 'economico', true],
        ] as const).map(([n, t, dd, pag, ok]) => <button key={n} disabled={!ok} onClick={() => ir(pag)} className="flex gap-3 rounded-xl bg-fg/5 p-3 text-left transition hover:bg-primario/15 disabled:opacity-40"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-sm font-bold text-black">{n}</span><span><span className="block text-sm font-semibold">{t}</span><span className="text-xs text-muted">{dd}</span></span></button>)}</div>
        <p className="mt-3 text-xs text-muted">Los indicadores y gráficos se llenan automáticamente a medida que registre productos, ventas y compras. ¿Dudas? Pregúntele al asistente (botón ✦ abajo a la derecha).</p>
      </Card>}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
        {/* Indicadores principales */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Tarjeta i={0} destacada titulo="Ventas del mes" valor={d.mes.ventas} formato={f$} icono={<Coins size={20} />} cambio={<Cambio oscuro v={variacion(d.mes.ventas, d.mesAnt.ventas)} />} nota="vs mes anterior" onClick={() => ir('resumen')} />
          <Tarjeta i={1} titulo="Valor del inventario" valor={d.valor} formato={f$} icono={<DollarSign size={20} />} cambio={<Cambio v={variacion(d.valor, d.valorAntes)} />} nota="vs hace 30 días" onClick={() => ir('productos')} />
          <Tarjeta i={2} titulo="Unidades vendidas" valor={d.mes.unidades} formato={fU} icono={<ShoppingBag size={20} />} cambio={<Cambio v={variacion(d.mes.unidades, d.mesAnt.unidades)} />} nota="este mes vs el anterior" onClick={() => ir('resumen')} />
          <Tarjeta i={3} titulo="Productos en quiebre" valor={d.quiebres.length} formato={fU} icono={<AlertTriangle size={20} />} cambio={d.quiebres.length ? <Etiqueta tono="rojo">{pct(d.quiebres.length / Math.max(1, productos.length), 0)} del catálogo</Etiqueta> : <Etiqueta tono="verde">Todo en orden</Etiqueta>} nota="Stock < 1/3 del mínimo" onClick={() => ir('productos')} />
        </div>

        {/* Ventas mes a mes: barras dobles */}
        <Panel titulo="Ventas mes a mes" sub={vista === 'resumen' ? 'Lo que vendió frente a lo que le costó' : 'Ventas de cada sucursal'}
          accion={<div className="flex flex-wrap gap-2"><Selector id="vista" opciones={[['resumen', 'Ventas vs costo'], ['sucursal', 'Por sucursal']]} valor={vista} onChange={setVista} /><Selector id="rango" opciones={[['anio', 'Este año'], ['doce', '12 meses']]} valor={rango} onChange={setRango} /></div>}>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">{(vista === 'resumen' ? ['costo', 'ventas'] : [...d.top, ...(d.barras.some((b) => b.OTRAS) ? ['OTRAS'] : [])]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colores[k] }} />{k === 'costo' ? 'Costo de lo vendido' : k === 'ventas' ? 'Ventas' : k === 'OTRAS' ? 'Otras' : k}</span>)}</div>
          <div className="relative">
            <Grafico alto={290}>
              <BarChart data={d.barras} barGap={5} barCategoryGap={vista === 'resumen' ? '28%' : '22%'}>
                <Degradados /><CartesianGrid {...rejilla} /><XAxis dataKey="mes" {...ejes} /><YAxis {...ejes} width={44} tickFormatter={corto} />
                <Tooltip content={<TooltipOscuro colores={colores} />} cursor={{ fill: 'rgb(var(--fg) / .05)', radius: 12 } as object} />
                {vista === 'resumen'
                  ? <><Bar dataKey="costo" name="Costo de lo vendido" fill="rgb(var(--fg) / .16)" radius={[8, 8, 8, 8]} maxBarSize={18} /><Bar dataKey="ventas" name="Ventas" fill="url(#g0)" radius={[8, 8, 8, 8]} maxBarSize={18} /></>
                  : [...d.top, 'OTRAS'].map((s, k, arr) => <Bar key={s} dataKey={s} name={s === 'OTRAS' ? 'Otras' : s} stackId="s" fill={colores[s]} radius={k === arr.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]} maxBarSize={30} />)}
              </BarChart>
            </Grafico>
            {!d.hayVentas && <div className="pointer-events-none absolute inset-0 grid place-items-center"><p className="rounded-xl bg-fg/5 px-4 py-2 text-sm text-muted">Aún no hay ventas. Regístrelas en Resumen → Ventas.</p></div>}
          </div>
        </Panel>

          {/* Indicadores de gestión */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Tarjeta compacta i={4} titulo="Rotación anual" valor={d.rotacion} formato={fX} icono={<RefreshCw size={17} />} cambio={<Etiqueta>últimos 30 días</Etiqueta>} nota="Costo de ventas / inventario" onClick={() => ir('productos')} />
            <Tarjeta compacta i={5} titulo="Exactitud de inventario" valor={d.exactitud * 100} formato={fP} icono={<ShieldCheck size={17} />} cambio={<Etiqueta tono={d.exactitud >= 0.98 ? 'verde' : 'rojo'}>{d.exactitud >= 0.98 ? 'Excelente' : 'Revisar ajustes'}</Etiqueta>} nota="Ajustes y mermas vs movimientos" onClick={() => ir('auditoria')} />
            <Tarjeta compacta i={6} titulo="Ahorro anual de su inversión" valor={ahorro} formato={f$} icono={<PiggyBank size={17} />} cambio={hayEval ? <Etiqueta tono={ahorro >= 0 ? 'verde' : 'rojo'}>{F.etq(p).retador}</Etiqueta> : <Etiqueta>sin evaluar</Etiqueta>} nota={hayEval ? F.etq(p).evaluacion : 'Cree una evaluación en Análisis económico'} onClick={() => ir('economico')} />
            <Tarjeta compacta i={7} titulo="VPN de su inversión" valor={vpn} formato={f$} icono={<TrendingDown size={17} />} cambio={hayEval ? <Etiqueta tono={vpn >= 0 ? 'verde' : 'rojo'}>{vpn >= 0 ? 'Conviene' : 'No conviene'}</Etiqueta> : <Etiqueta>sin evaluar</Etiqueta>} nota={hayEval ? `TMAR ${pct(p.i, 0)}` : 'Valor presente neto'} onClick={() => ir('economico')} />
          </div>
        </div>
        <div className="space-y-4">
        {/* Ventas por categoría: anillos */}
        <Panel titulo="Ventas por categoría" sub="Las 3 categorías que más venden" accion={<Selector id="cat" opciones={[['mes', 'Este mes'], ['anioC', 'Este año']]} valor={d.periodo} onChange={setCatP} />}>
          <div className="relative flex items-center">
            <Anillos datos={top3} total={d.catTotal} activo={activo} onActivo={setActivo} />
            <div className="pointer-events-none absolute left-[58%] top-[14%]">
              <div className="font-display text-3xl font-bold tracking-tight"><Contador valor={act ? act.u : d.catU} formato={fU} /></div>
              <div className="text-xs text-muted">{act ? act.nombre : 'unidades vendidas'}</div>
              <div className="mt-1.5"><Cambio v={act ? variacion(act.u, act.uAntes) : variacion(d.catU, d.catUAntes)} /></div>
            </div>
          </div>
          <ul className="mt-4 space-y-1">{top3.map((c, k) => (
            <li key={c.nombre} onMouseEnter={() => setActivo(k)} onMouseLeave={() => setActivo(null)} className={cx('flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition', activo === k ? 'bg-fg/5' : '')}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-fg/5" style={{ background: ANILLOS[k] }} />
              <span className="min-w-0 flex-1 truncate">{c.nombre}</span><b className="tnum">{f$(c.valor)}</b><Cambio v={variacion(c.valor, c.antes)} />
            </li>))}
            {!top3.length && <li className="py-2 text-center text-sm text-muted">Sin ventas en el periodo. Registre ventas en Resumen → Ventas.</li>}
          </ul>
          {d.catLista.length > 3 && <p className="mt-1 text-[11px] text-muted">+{plural(d.catLista.length - 3, 'categoría más', 'categorías más')}</p>}
        </Panel>

        {/* Ventas o stock por sucursal: burbujas */}
        <Panel titulo="Red de sucursales" sub={metrica === 'ventas' ? 'Ventas de los últimos 30 días' : 'Valor del stock en cada sucursal'} accion={<Selector id="metrica" opciones={[['ventas', 'Ventas'], ['stock', 'Stock']]} valor={metrica} onChange={setMetrica} />}>
          <svg viewBox="0 0 320 236" className="mx-auto h-[210px] w-full max-w-[340px] overflow-visible">
            {bur.map((x, k) => {
              const b = BURBUJAS[k], r = 18 + 38 * Math.sqrt(x.v / maxSuc), sel = sucursal === x.s.id, hov = burbuja === x.s.id
              return <g key={x.s.id} className="cursor-pointer" onMouseEnter={() => setBurbuja(x.s.id)} onMouseLeave={() => setBurbuja(null)} onClick={() => setSucursal(sel ? 'TODAS' : x.s.id)}>
                <motion.circle cx={b.x} cy={b.y} fill={b.c} stroke={sel ? 'rgb(var(--fg))' : 'var(--bg2)'} strokeWidth={sel ? 3 : 4} initial={{ r: 0 }} animate={{ r: hov ? r * 1.07 : r, opacity: burbuja && !hov ? 0.55 : 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: hov || burbuja ? 0 : 0.1 * k }} />
                <motion.text x={b.x} y={b.y + 5} textAnchor="middle" fill={b.t} className="font-display text-[15px] font-bold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + 0.1 * k }}>{corto(x.v)}</motion.text>
              </g>
            })}
            {!bur.length && <text x="160" y="122" textAnchor="middle" fill="rgb(var(--muted))" className="text-[12px]">{SUCURSALES.length ? 'Sin datos todavía' : 'Registre sus sucursales'}</text>}
          </svg>
          <ul className="mt-3 space-y-2.5">{d.porSuc.slice(0, 5).map((x, k) => (
            <li key={x.s.id}><button onClick={() => setSucursal(sucursal === x.s.id ? 'TODAS' : x.s.id)} onMouseEnter={() => setBurbuja(x.s.id)} onMouseLeave={() => setBurbuja(null)} className={cx('w-full rounded-lg px-1.5 py-1 text-left transition hover:bg-fg/5', sucursal === x.s.id && 'bg-primario/10')}>
              <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate"><span className="mr-1.5">{bandera(x.s.pais)}</span><b className="font-medium">{x.s.ciudad || x.s.nombre}</b> <span className="text-xs text-muted">{x.s.id}</span></span><span className="text-xs font-semibold tnum">{f$(x.v)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10"><motion.div className="h-full rounded-full" style={{ background: k < 4 ? BURBUJAS[k].c : COLORES[0] }} initial={{ width: 0 }} animate={{ width: `${(x.v / maxSuc) * 100}%` }} transition={{ duration: 1.1, delay: 0.08 * k, ease: suave }} /></div>
            </button></li>))}</ul>
          {SUCURSALES.length > 0 && <p className="mt-2 text-[11px] text-muted">Toque una sucursal para ver el Dashboard solo de ella.</p>}
        </Panel>
        </div>
      </div>

      {/* Salud del negocio: rendimiento bajo, medio o alto, y qué hacer */}
      <Panel titulo={<span className="flex items-center gap-2"><HeartPulse size={16} className="text-primario" />Salud del negocio</span>} sub={`${empresa.tamano || 'Emprendimientos y empresas de cualquier tamaño'}${empresa.sector ? ` · ${empresa.sector}` : ''} · qué tan bien rinde y qué hacer para mejorar (toda la empresa)`}
        accion={<button onClick={() => ir('reportes')} className="text-xs text-primario hover:underline">Ver reporte completo</button>}>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[250px_1fr_1fr]">
          <Medidor puntaje={d.salud.puntaje} nivel={d.salud.nivel} />
          <ul className="space-y-3">{d.salud.factores.map((f, k) => (
            <li key={f.nombre}>
              <div className="flex justify-between gap-2 text-sm"><span>{f.nombre}</span><span className="font-semibold tnum">{f.valor}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-violeta via-primario to-amber-100" initial={{ width: 0 }} whileInView={{ width: `${(f.puntos / f.max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.08 * k, ease: suave }} /></div>
              <div className="mt-0.5 flex justify-between text-[11px] text-muted"><span>Meta: {f.meta}</span><span className="tnum">{num(f.puntos, 0)} / {f.max} pts</span></div>
            </li>))}</ul>
          <div className="rounded-2xl bg-fg/5 p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[.22em] text-muted">Cómo mejorar</div>
            <ol className="space-y-3">{d.salud.mejorar.map((f, k) => (
              <li key={f.nombre} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-xs font-bold text-black">{k + 1}</span>
                <div><div className="text-sm font-semibold">{f.nombre} <span className="font-normal text-muted">· {f.valor}</span></div><p className="text-xs leading-relaxed text-muted">{f.consejo}</p></div></li>))}
              {!d.salud.mejorar.length && <li className="text-sm text-muted">{d.salud.nivel === 'Sin datos' ? 'Registre sus ventas en Resumen → Ventas y aquí verá qué mejorar.' : '¡Excelente! Todos los indicadores están en su meta. Mantenga el control mes a mes.'}</li>}</ol>
          </div>
        </div>
      </Panel>

      {/* Para su sector: lo que más importa en este tipo de negocio */}
      <Panel titulo={<span className="flex items-center gap-2"><Briefcase size={16} className="text-primario" />Para su sector · {perfil.nombre}</span>} sub={perfil.foco}
        accion={<button onClick={() => ir('configuracion')} className="text-xs text-primario hover:underline">{empresa.sector ? 'Cambiar sector' : 'Elegir mi sector'}</button>}>
        {!empresa.sector && <p className="mb-4 rounded-xl border border-primario/25 bg-primario/10 px-3 py-2 text-xs">Aún no eligió su sector: se muestra el perfil general. En Configuración → Empresa elija el suyo (salud, construcción, restaurantes, moda…) y NEXORA se adapta.</p>}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{d.sector.map((x, k) => (
            <motion.div key={x.titulo} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.07 * k, duration: 0.6, ease: suave }} className="rounded-2xl bg-fg/5 p-4 ring-1 ring-fg/5">
              <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-muted">{x.titulo}</span><span className={cx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', { verde: 'bg-exito', ambar: 'bg-alerta', rojo: 'bg-peligro', gris: 'bg-fg/30' }[x.tono])} /></div>
              <div className="mt-1 truncate font-display text-2xl font-bold tracking-tight">{x.valor}</div>
              <div className="mt-0.5 text-[11px] text-muted">{x.nota}</div>
            </motion.div>))}</div>
          <div className="rounded-2xl bg-fg/5 p-4">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[.22em] text-muted">Consejos para {perfil.nombre.toLowerCase()}</div>
            <ul className="space-y-2.5 text-xs leading-relaxed">{perfil.consejos.map((c) => <li key={c} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primario" /><span>{c}</span></li>)}</ul>
            <div className="mt-4 border-t border-fg/10 pt-3 text-[11px] text-muted">En su negocio: productos = <b className="text-fg">{perfil.productos}</b> · clientes = <b className="text-fg">{perfil.clientes}</b> · sucursales = <b className="text-fg">{perfil.sucursales}</b></div>
          </div>
        </div>
      </Panel>

      {/* Alertas y actividad */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel titulo={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-peligro" />Quiebres de stock</span>} sub="Productos que hay que reponer">
          <ul className="space-y-2 text-sm">{d.quiebres.slice(0, 6).map((x) => <li key={x.id}><button onClick={() => ir('productos')} className="flex w-full items-center justify-between gap-2 rounded-xl bg-fg/5 px-3 py-2 text-left transition hover:bg-fg/10"><span className="truncate">{x.nombre}</span><Badge tono="rojo">{stockTotal(x, sucursal)} u</Badge></button></li>)}{!d.quiebres.length && <li className="text-muted">Sin quiebres 🎉</li>}</ul>
        </Panel>
        <Panel titulo={<span className="flex items-center gap-2"><Sparkles size={16} className="text-cian" />Anomalías detectadas por IA</span>} sub="Movimientos fuera de lo normal">
          <ul className="space-y-2 text-sm">{d.anom.map(({ m, z }) => <li key={m.id} className="rounded-xl bg-fg/5 px-3 py-2"><div className="flex justify-between gap-2"><span className="truncate">{productos.find((x) => x.id === m.productoId)?.nombre}</span><Badge tono={m.tipo === 'Merma' ? 'ambar' : 'violeta'}>{m.tipo}</Badge></div><div className="text-xs text-muted">{Math.abs(m.cantidad)} u · {m.sucursal} · z = {num(z, 1)}</div></li>)}{!d.anom.length && <li className="text-muted">Todo normal por ahora.</li>}</ul>
        </Panel>
        <Panel titulo={<span className="flex items-center gap-2"><Activity size={16} className="text-primario" />Actividad reciente</span>} sub="Lo último que pasó en el sistema" accion={<button onClick={() => ir('auditoria')} className="text-xs text-primario hover:underline">Ver todo</button>}>
          <ul className="space-y-2.5 text-sm">{auditoria.slice(-6).reverse().map((e) => <li key={e.id} className="border-l-2 border-primario/50 pl-3"><div className="font-medium">{e.accion}</div><div className="truncate text-xs text-muted">{e.detalle} · {fechaHora(e.fecha)}</div></li>)}{!auditoria.length && <li className="text-muted"><Boxes size={14} className="mr-1 inline" />Sin actividad todavía.</li>}</ul>
        </Panel>
      </div>
    </div>
  )
}
