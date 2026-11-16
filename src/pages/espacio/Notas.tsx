import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, CheckSquare, Code2, Folder, Heading1, Heading2, Link2, List, Minus, Pin, Plus, Quote, Search, Trash2, Type, X } from 'lucide-react'
import { useApp } from '../../store/useApp'
import type { Bloque, Nota, TipoBloque } from '../../data/base'
import { Button, cx } from '../../components/ui'
import { fecha } from '../../lib/format'
import { Marca, servicioDe } from '../../components/Marca'
import { abrir } from '../../lib/google'

const uid = () => crypto.randomUUID()
const ICONOS = ['📝', '💡', '📌', '📊', '🚀', '✅', '📦', '🧾', '🗓️', '⭐', '🤝', '🎯']
/** Fondos de nota: adhesivos de color (texto oscuro) o vidrio con el tema. */
const COLORES_NOTA: Record<string, string> = {
  naranja: 'linear-gradient(145deg,#FFB65C,#F2862B)', azul: 'linear-gradient(145deg,#8DBBFF,#4A85F2)', amarillo: 'linear-gradient(145deg,#FFE88A,#F4C443)',
  verde: 'linear-gradient(145deg,#9FEBC4,#4CC98D)', morado: 'linear-gradient(145deg,#D2BCFF,#9D7BF2)', vidrio: '',
}
const TIPOS: { tipo: TipoBloque; nombre: string; ayuda: string; icono: JSX.Element }[] = [
  { tipo: 'texto', nombre: 'Texto', ayuda: 'Párrafo normal', icono: <Type size={15} /> },
  { tipo: 'h1', nombre: 'Título grande', ayuda: 'Atajo: # y espacio', icono: <Heading1 size={15} /> },
  { tipo: 'h2', nombre: 'Subtítulo', ayuda: 'Atajo: ## y espacio', icono: <Heading2 size={15} /> },
  { tipo: 'lista', nombre: 'Lista', ayuda: 'Atajo: - y espacio', icono: <List size={15} /> },
  { tipo: 'tarea', nombre: 'Casilla de tarea', ayuda: 'Atajo: [] y espacio', icono: <CheckSquare size={15} /> },
  { tipo: 'cita', nombre: 'Cita', ayuda: 'Atajo: > y espacio', icono: <Quote size={15} /> },
  { tipo: 'codigo', nombre: 'Código', ayuda: 'Atajo: ``` ', icono: <Code2 size={15} /> },
  { tipo: 'separador', nombre: 'Separador', ayuda: 'Atajo: ---', icono: <Minus size={15} /> },
  { tipo: 'enlace', nombre: 'Enlace con logo', ayuda: 'Drive, Docs, Sheets, Meet, Notion, Figma… (o pegue un enlace)', icono: <Link2 size={15} /> },
]
const ATAJOS: [string, TipoBloque][] = [['# ', 'h1'], ['## ', 'h2'], ['- ', 'lista'], ['* ', 'lista'], ['[] ', 'tarea'], ['> ', 'cita'], ['```', 'codigo'], ['---', 'separador']]
const b = (tipo: TipoBloque, texto = '', hecho?: boolean): Bloque => ({ id: uid(), tipo, texto, ...(hecho !== undefined ? { hecho } : {}) })
const PLANTILLAS: { nombre: string; icono: string; color: string; bloques: () => Bloque[] }[] = [
  { nombre: 'Página en blanco', icono: '📝', color: 'vidrio', bloques: () => [b('texto')] },
  { nombre: 'Acta de reunión', icono: '🤝', color: 'azul', bloques: () => [b('h2', 'Asistentes'), b('lista', ''), b('h2', 'Temas'), b('lista', ''), b('h2', 'Acuerdos'), b('tarea', '', false)] },
  { nombre: 'Plan de la semana', icono: '🗓️', color: 'amarillo', bloques: () => [b('h2', 'Objetivo'), b('texto', ''), b('h2', 'Pendientes'), b('tarea', 'Revisar productos en quiebre', false), b('tarea', 'Registrar gastos de la semana', false), b('tarea', 'Cerrar caja del viernes', false)] },
  { nombre: 'Lluvia de ideas', icono: '💡', color: 'naranja', bloques: () => [b('cita', '¿Cómo vendemos más este mes?'), b('lista', '')] },
]
const resumen = (n: Nota) => n.bloques.filter((x) => x.tipo !== 'separador').map((x) => x.texto).filter(Boolean).join(' · ').slice(0, 110)

/** Área de texto que crece con el contenido. */
function AutoTexto({ valor, onCambio, onTecla, refe, className, placeholder }: { valor: string; onCambio: (v: string) => void; onTecla: (e: KeyboardEvent<HTMLTextAreaElement>) => void; refe: (el: HTMLTextAreaElement | null) => void; className?: string; placeholder?: string }) {
  const r = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => { const el = r.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }, [valor])
  return <textarea rows={1} ref={(el) => { r.current = el; refe(el) }} value={valor} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} onKeyDown={onTecla}
    className={cx('w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted/60 focus-visible:!outline-none', className)} />
}

function Editor({ inicial, carpetas, onGuardar, onEliminar, onVolver }: { inicial: Nota; carpetas: string[]; onGuardar: (n: Nota) => void; onEliminar: () => void; onVolver: () => void }) {
  const [n, setN] = useState(inicial)
  const [foco, setFoco] = useState<string | null>(null)
  const borrada = useRef(false) // si se elimina, no se vuelve a guardar al cerrar
  const [menu, setMenu] = useState<{ id: string; i: number } | null>(null)
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  // Guardado automático (con pausa para no escribir en cada tecla) y al salir
  const ultimo = useRef(n); ultimo.current = n
  useEffect(() => { const t = setTimeout(() => onGuardar(n), 450); return () => clearTimeout(t) }, [n]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (!borrada.current) onGuardar(ultimo.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (foco) { const el = refs.current[foco]; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } setFoco(null) } }, [foco, n.bloques])

  const setB = (id: string, c: Partial<Bloque>) => setN((x) => ({ ...x, bloques: x.bloques.map((y) => (y.id === id ? { ...y, ...c } : y)) }))
  const insertar = (despues: string, tipo: TipoBloque = 'texto') => {
    const nb = b(tipo, '', tipo === 'tarea' ? false : undefined)
    setN((x) => { const i = x.bloques.findIndex((y) => y.id === despues), bs = [...x.bloques]; bs.splice(i + 1, 0, nb); return { ...x, bloques: bs } })
    setFoco(nb.id)
  }
  const quitar = (id: string) => setN((x) => {
    const i = x.bloques.findIndex((y) => y.id === id), bs = x.bloques.filter((y) => y.id !== id)
    if (i > 0) setFoco(x.bloques[i - 1].id)
    return { ...x, bloques: bs.length ? bs : [b('texto')] }
  })
  const opciones = (texto: string) => { const f = texto.slice(1).toLowerCase(); return TIPOS.filter((t) => !f || t.nombre.toLowerCase().includes(f)) }
  const elegir = (id: string, tipo: TipoBloque) => {
    setB(id, { tipo, texto: '', ...(tipo === 'tarea' ? { hecho: false } : {}) }); setMenu(null)
    if (tipo === 'separador') insertar(id); else setFoco(id)
  }
  const cambiar = (bl: Bloque, v: string) => {
    const atajo = bl.tipo === 'texto' && ATAJOS.find(([a]) => v === a)
    if (atajo) return elegir(bl.id, atajo[1])
    // Pegar un enlace solo en un bloque vacío lo convierte en tarjeta con el logo del servicio (como Notion)
    if (bl.tipo === 'texto' && !bl.texto && /^https?:\/\/\S+$/.test(v.trim())) return setB(bl.id, { tipo: 'enlace', texto: v.trim() })
    setB(bl.id, { texto: v })
    setMenu(v.startsWith('/') && !v.includes(' ') ? { id: bl.id, i: 0 } : null)
  }
  const tecla = (bl: Bloque, e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu?.id === bl.id) {
      const ops = opciones(bl.texto)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setMenu({ id: bl.id, i: (menu.i + (e.key === 'ArrowDown' ? 1 : ops.length - 1)) % Math.max(1, ops.length) }); return }
      if (e.key === 'Enter') { e.preventDefault(); if (ops[menu.i]) elegir(bl.id, ops[menu.i].tipo); return }
      if (e.key === 'Escape') { setMenu(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && bl.tipo !== 'codigo') {
      e.preventDefault()
      if ((bl.tipo === 'lista' || bl.tipo === 'tarea') && !bl.texto) return setB(bl.id, { tipo: 'texto' })
      insertar(bl.id, bl.tipo === 'lista' || bl.tipo === 'tarea' ? bl.tipo : 'texto')
    }
    if (e.key === 'Backspace' && !bl.texto) { e.preventDefault(); if (bl.tipo !== 'texto') setB(bl.id, { tipo: 'texto' }); else quitar(bl.id) }
  }

  const fondo = COLORES_NOTA[n.color]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="glass min-h-[560px] overflow-hidden">
      <div className="h-24" style={{ background: fondo || 'linear-gradient(120deg, rgb(var(--t-oscuro)/.5), rgb(var(--t-oro)/.25), transparent)' }} />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-10">
        <div className="-mt-8 flex items-end justify-between gap-3">
          <button title="Cambiar ícono" onClick={() => setN({ ...n, icono: ICONOS[(ICONOS.indexOf(n.icono) + 1) % ICONOS.length] })} className="grid h-16 w-16 place-items-center rounded-2xl bg-[color:var(--bg2)] text-4xl shadow-xl ring-1 ring-fg/10 transition hover:scale-105">{n.icono}</button>
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <Button variante="fantasma" className="px-2 py-1 text-xs" onClick={onVolver}><ArrowLeft size={14} />Notas</Button>
            <Button variante="fantasma" className={cx('px-2 py-1 text-xs', n.fijada && 'text-primario')} onClick={() => setN({ ...n, fijada: !n.fijada })}><Pin size={14} />{n.fijada ? 'Fijada' : 'Fijar'}</Button>
            <Button variante="fantasma" className="px-2 py-1 text-xs text-peligro" onClick={() => { if (confirm('¿Eliminar esta nota?')) { borrada.current = true; onEliminar() } }}><Trash2 size={14} /></Button>
          </div>
        </div>
        <input autoFocus={!n.titulo} className="mt-4 w-full bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted/50 focus-visible:!outline-none" placeholder="Sin título" value={n.titulo} onChange={(e) => setN({ ...n, titulo: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setFoco(n.bloques[0]?.id ?? null) } }} />
        <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-fg/10 pb-4 text-xs text-muted">
          <label className="flex items-center gap-1.5"><Folder size={13} /><input list="carpetasNotas" className="w-36 rounded-lg bg-fg/5 px-2 py-1 outline-none focus:bg-fg/10" placeholder="Carpeta" value={n.carpeta} onChange={(e) => setN({ ...n, carpeta: e.target.value })} /></label>
          <datalist id="carpetasNotas">{carpetas.map((c) => <option key={c} value={c} />)}</datalist>
          <span className="flex gap-1.5">{Object.entries(COLORES_NOTA).map(([k, c]) => <button key={k} title={k} onClick={() => setN({ ...n, color: k })} className={cx('h-4 w-4 rounded-full', n.color === k ? 'ring-2 ring-primario ring-offset-1 ring-offset-[color:var(--bg2)]' : 'ring-1 ring-fg/20')} style={{ background: c || 'rgb(var(--fg) / .1)' }} />)}</span>
          <span>Visible para todo el equipo · {inicial.creadoPor || 'NEXORA'}</span>
        </div>

        <div className="mt-5 space-y-1">
          {n.bloques.map((bl) => {
            const comun = { valor: bl.texto, onCambio: (v: string) => cambiar(bl, v), onTecla: (e: KeyboardEvent<HTMLTextAreaElement>) => tecla(bl, e), refe: (el: HTMLTextAreaElement | null) => { refs.current[bl.id] = el } }
            const ops = menu?.id === bl.id ? opciones(bl.texto) : []
            return (
              <div key={bl.id} className="group relative flex items-start gap-2 rounded-lg px-1 py-0.5 hover:bg-fg/[.03]">
                <button title="Agregar bloque debajo" onClick={() => insertar(bl.id)} className="mt-1 rounded p-0.5 text-muted opacity-0 transition hover:bg-fg/10 group-hover:opacity-100"><Plus size={14} /></button>
                <div className="min-w-0 flex-1">
                  {bl.tipo === 'h1' && <AutoTexto {...comun} className="font-display text-3xl font-bold leading-tight" placeholder="Título" />}
                  {bl.tipo === 'h2' && <AutoTexto {...comun} className="font-display text-xl font-semibold leading-snug" placeholder="Subtítulo" />}
                  {bl.tipo === 'texto' && <AutoTexto {...comun} className="text-[15px] leading-relaxed" placeholder="Escriba, o pulse «/» para elegir un bloque…" />}
                  {bl.tipo === 'lista' && <div className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primario" /><AutoTexto {...comun} className="text-[15px] leading-relaxed" placeholder="Elemento de la lista" /></div>}
                  {bl.tipo === 'tarea' && <div className="flex gap-2"><button onClick={() => setB(bl.id, { hecho: !bl.hecho })} className={cx('mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition', bl.hecho ? 'border-primario bg-primario text-black' : 'border-fg/30 hover:border-primario')}>{bl.hecho && '✓'}</button><AutoTexto {...comun} className={cx('text-[15px] leading-relaxed', bl.hecho && 'text-muted line-through')} placeholder="Tarea por hacer" /></div>}
                  {bl.tipo === 'cita' && <div className="border-l-[3px] border-primario pl-3"><AutoTexto {...comun} className="text-[15px] italic leading-relaxed" placeholder="Cita" /></div>}
                  {bl.tipo === 'codigo' && <div className="rounded-xl bg-black/40 p-3 ring-1 ring-fg/10"><AutoTexto {...comun} className="font-mono text-xs leading-relaxed text-amber-100" placeholder="Código o texto sin formato" /></div>}
                  {bl.tipo === 'enlace' && (/^https?:\/\/\S+$/.test(bl.texto) ? (() => { const sv = servicioDe(bl.texto); return (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group/en flex items-center gap-3 rounded-2xl border border-fg/10 bg-fg/[.04] p-2.5 transition hover:border-primario/40 hover:bg-fg/[.07]">
                      <Marca slug={sv.slug} tam={40} /><button onClick={() => abrir(bl.texto)} className="min-w-0 flex-1 text-left"><div className="text-sm font-semibold">{sv.nombre}</div><div className="truncate text-[11px] text-muted">{bl.texto}</div></button>
                      <button title="Abrir" onClick={() => abrir(bl.texto)} className="grid h-8 w-8 place-items-center rounded-full border border-fg/10 hover:bg-fg/10"><ArrowUpRight size={14} /></button>
                      <button title="Quitar enlace" onClick={() => setB(bl.id, { tipo: 'texto', texto: '' })} className="grid h-8 w-8 place-items-center rounded-full text-muted opacity-0 hover:bg-fg/10 group-hover/en:opacity-100"><X size={14} /></button>
                    </motion.div>) })() : <div className="flex items-center gap-2 rounded-xl bg-fg/5 px-3 py-2"><Link2 size={14} className="text-primario" /><AutoTexto {...comun} className="text-sm" placeholder="Pegue el enlace de Drive, Docs, Sheets, Meet, Notion…" /></div>)}
                  {bl.tipo === 'separador' && <div className="flex items-center gap-2 py-3"><hr className="flex-1 border-fg/15" /><button onClick={() => quitar(bl.id)} className="text-muted opacity-0 group-hover:opacity-100"><X size={13} /></button></div>}
                  {ops.length > 0 && (
                    <div className="glass absolute left-8 top-full z-30 mt-1 w-64 p-1.5" style={{ background: 'color-mix(in srgb, var(--bg2) 94%, transparent)' }}>
                      <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[.2em] text-muted">Bloques</div>
                      {ops.map((o, k) => <button key={o.tipo} onMouseDown={(e) => { e.preventDefault(); elegir(bl.id, o.tipo) }} className={cx('flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm', k === menu?.i ? 'bg-primario/15' : 'hover:bg-fg/5')}><span className="grid h-7 w-7 place-items-center rounded-md bg-fg/5 text-primario">{o.icono}</span><span><span className="block font-medium">{o.nombre}</span><span className="text-[11px] text-muted">{o.ayuda}</span></span></button>)}
                    </div>)}
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={() => insertar(n.bloques[n.bloques.length - 1].id)} className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-fg/5 hover:text-fg"><Plus size={13} />Agregar bloque</button>
      </div>
    </motion.div>
  )
}

export default function Notas() {
  const { notas, usuario, guardarNota, eliminarNota } = useApp()
  const [sel, setSel] = useState<string | null>(null)
  const [carpeta, setCarpeta] = useState<string | null>(null)
  const [q, setQ] = useState(''), [plantillas, setPlantillas] = useState(false)
  const carpetas = useMemo(() => [...new Set(notas.map((n) => n.carpeta).filter(Boolean))].sort(), [notas])
  const t = q.trim().toLowerCase()
  const lista = notas.filter((n) => (!carpeta || n.carpeta === carpeta) && (!t || `${n.titulo} ${resumen(n)}`.toLowerCase().includes(t)))
  const actual = notas.find((n) => n.id === sel)

  const crear = (p: (typeof PLANTILLAS)[number]) => {
    const n: Nota = { id: uid(), titulo: p.nombre === 'Página en blanco' ? '' : p.nombre, icono: p.icono, carpeta: carpeta ?? '', fijada: false, color: p.color, bloques: p.bloques(), creadoPor: usuario?.nombre ?? '', actualizada: '' }
    guardarNota(n); setSel(n.id); setPlantillas(false)
  }
  const Tarjeta = ({ n }: { n: Nota }) => {
    const fondo = COLORES_NOTA[n.color]
    return (
      <motion.button layout whileHover={{ y: -4, rotate: fondo ? -0.6 : 0 }} onClick={() => setSel(n.id)} style={fondo ? { background: fondo } : undefined}
        className={cx('relative flex min-h-[150px] flex-col overflow-hidden rounded-2xl p-4 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,.6)]', fondo ? 'text-stone-900' : 'glass glass-hover')}>
        {fondo && <span className="pointer-events-none absolute -bottom-3 -right-3 h-10 w-10 rotate-45 bg-black/10" />}
        <div className="flex items-start justify-between gap-2"><span className="text-2xl">{n.icono}</span>{n.fijada && <Pin size={13} className="opacity-60" />}</div>
        <div className="mt-2 font-semibold leading-snug">{n.titulo || 'Sin título'}</div>
        <p className={cx('mt-1 line-clamp-3 text-xs', fondo ? 'text-stone-800/80' : 'text-muted')}>{resumen(n) || 'Nota vacía'}</p>
        <div className={cx('mt-auto flex items-center justify-between pt-3 text-[10px]', fondo ? 'text-stone-800/70' : 'text-muted')}><span>{n.actualizada ? fecha(n.actualizada) : ''}</span>{n.carpeta && <span className={cx('rounded-md px-1.5 py-0.5 font-semibold', fondo ? 'bg-black/10' : 'bg-fg/10')}>{n.carpeta}</span>}</div>
      </motion.button>
    )
  }

  if (actual) return <Editor key={actual.id} inicial={actual} carpetas={carpetas} onGuardar={guardarNota} onEliminar={() => { eliminarNota(actual.id); setSel(null) }} onVolver={() => setSel(null)} />

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <aside className="glass h-fit space-y-4 p-3">
        <div className="relative">
          <Button variante="primario" className="w-full" onClick={() => setPlantillas(!plantillas)}><Plus size={15} />Nueva nota</Button>
          {plantillas && <div className="glass absolute inset-x-0 top-11 z-20 p-1.5" style={{ background: 'color-mix(in srgb, var(--bg2) 94%, transparent)' }}>{PLANTILLAS.map((p) => <button key={p.nombre} onClick={() => crear(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-fg/5"><span className="text-lg">{p.icono}</span>{p.nombre}</button>)}</div>}
        </div>
        <div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp pl-8" type="search" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div>
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[.2em] text-muted">Carpetas</div>
          {[null, ...carpetas].map((c) => <button key={c ?? '·'} onClick={() => setCarpeta(c)} className={cx('flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm transition', carpeta === c ? 'border border-primario/30 bg-gradient-to-r from-primario/20 to-transparent' : 'hover:bg-fg/5')}>
            <span className="flex items-center gap-2"><Folder size={14} className="text-primario" />{c ?? 'Todas las notas'}</span><span className="text-xs text-muted">{c ? notas.filter((n) => n.carpeta === c).length : notas.length}</span></button>)}
        </div>
      </aside>
      <div className="space-y-5">
        {lista.some((n) => n.fijada) && <section><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Pin size={14} className="text-primario" />Fijadas</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.filter((n) => n.fijada).map((n) => <Tarjeta key={n.id} n={n} />)}</div></section>}
        <section><div className="mb-2 text-sm font-semibold">{carpeta ?? 'Todas las notas'}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.filter((n) => !n.fijada).map((n) => <Tarjeta key={n.id} n={n} />)}
            {!lista.length && <div className="glass col-span-full grid place-items-center gap-3 p-10 text-center"><span className="text-4xl">📝</span><p className="max-w-sm text-sm text-muted">{notas.length ? 'Ninguna nota coincide.' : 'Cree la primera nota del equipo: actas de reunión, planes, ideas o procesos. Escriba «/» para ver todos los bloques.'}</p><Button variante="primario" onClick={() => setPlantillas(true)}><Plus size={15} />Nueva nota</Button></div>}
          </div></section>
      </div>
    </div>
  )
}
