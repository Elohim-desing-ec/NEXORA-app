import { useMemo, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Mail, Plus, Search, Trash2, Video } from 'lucide-react'
import { useApp } from '../../store/useApp'
import type { EstadoTarea, Prioridad, Tarea } from '../../data/base'
import { Button, Campo, Modal, cx } from '../../components/ui'
import { abrir, urlCalendario, urlGmail, URLS } from '../../lib/google'
import { hoyISO } from '../../lib/resumen'
import { fecha } from '../../lib/format'

export const COLUMNAS: { id: EstadoTarea; nombre: string; punto: string }[] = [
  { id: 'pendiente', nombre: 'Pendiente', punto: 'bg-sky-400' }, { id: 'progreso', nombre: 'En progreso', punto: 'bg-primario' }, { id: 'hecho', nombre: 'Hecho', punto: 'bg-exito' }, { id: 'archivado', nombre: 'Archivado', punto: 'bg-fg/30' },
]
/** Colores de tarjeta (pastel con texto oscuro, como un tablero de notas adhesivas); "vidrio" usa el tema. */
export const COLORES_TAREA: Record<string, string> = { cian: '#8BE3EA', naranja: '#F7BE7A', morado: '#C9B3F7', verde: '#A7EBC6', rosa: '#F6B8D1', vidrio: '' }
const PRIORIDAD: Record<Prioridad, string> = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' }
export const iniciales = (n: string) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export function Avatares({ ids, max = 3, claro }: { ids: string[]; max?: number; claro?: boolean }) {
  const usuarios = useApp((s) => s.usuarios)
  const us = ids.map((id) => usuarios.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u)
  return (
    <div className="flex -space-x-2">
      {us.slice(0, max).map((u) => u.foto ? <img key={u.id} src={u.foto} alt={u.nombre} title={u.nombre} className={cx('h-6 w-6 rounded-full object-cover ring-2', claro ? 'ring-white/60' : 'ring-[color:var(--bg2)]')} /> : <span key={u.id} title={u.nombre} className={cx('grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-200 via-primario to-violeta text-[9px] font-bold text-black ring-2', claro ? 'ring-white/60' : 'ring-[color:var(--bg2)]')}>{iniciales(u.nombre)}</span>)}
      {us.length > max && <span className="grid h-6 w-6 place-items-center rounded-full bg-fg/20 text-[9px] font-bold ring-2 ring-[color:var(--bg2)]">+{us.length - max}</span>}
    </div>
  )
}

function chipFecha(vence: string) {
  if (!vence) return null
  const hoy = hoyISO(), man = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  if (vence < hoy) return { txt: `Venció ${fecha(vence + 'T12:00:00')}`, vencida: true }
  return { txt: vence === hoy ? 'Hoy' : vence === man ? 'Mañana' : fecha(vence + 'T12:00:00'), vencida: false }
}

export default function Tablero() {
  const { tareas, usuarios, usuario, guardarTarea, moverTarea, eliminarTarea } = useApp()
  const [q, setQ] = useState(''), [filtro, setFiltro] = useState<'todas' | 'mias' | 'alta'>('todas')
  const [form, setForm] = useState<Tarea | null>(null), [error, setError] = useState('')
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<{ col: EstadoTarea; antes?: string } | null>(null)
  const [fiesta, setFiesta] = useState<{ x: number; y: number; k: number } | null>(null)

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return tareas.filter((x) => (!t || `${x.titulo} ${x.descripcion} ${x.etiquetas.join(' ')}`.toLowerCase().includes(t)) && (filtro !== 'mias' || x.asignados.includes(usuario?.id ?? '')) && (filtro !== 'alta' || x.prioridad === 'alta'))
  }, [tareas, q, filtro, usuario])
  const mias = tareas.filter((x) => x.asignados.includes(usuario?.id ?? '') && (x.estado === 'pendiente' || x.estado === 'progreso')).length

  const nueva = (estado: EstadoTarea = 'pendiente') => {
    setError('')
    setForm({ id: crypto.randomUUID(), titulo: '', descripcion: '', estado, prioridad: 'media', vence: '', asignados: usuario ? [usuario.id] : [], etiquetas: [], color: 'cian', creadoPor: usuario?.nombre ?? '', creada: '', actualizada: '', orden: Math.max(0, ...tareas.filter((x) => x.estado === estado).map((x) => x.orden)) + 1 })
  }
  const guardar = () => {
    if (!form) return
    if (!form.titulo.trim()) return setError('Escriba el título de la tarea.')
    guardarTarea({ ...form, titulo: form.titulo.trim(), etiquetas: form.etiquetas.map((e) => e.trim()).filter(Boolean) })
    setForm(null)
  }
  const soltar = (e: DragEvent, col: EstadoTarea, antes?: string) => {
    e.preventDefault(); e.stopPropagation()
    const id = e.dataTransfer.getData('text/plain') || arrastrando
    if (id && id !== antes) {
      if (col === 'hecho' && tareas.find((t) => t.id === id)?.estado !== 'hecho') { setFiesta({ x: e.clientX, y: e.clientY, k: Date.now() }); setTimeout(() => setFiesta(null), 1100) }
      moverTarea(id, col, antes)
    }
    setArrastrando(null); setSobre(null)
  }
  const correos = (t: Tarea) => usuarios.filter((u) => t.asignados.includes(u.id)).map((u) => u.email).filter(Boolean)
  const nombres = (t: Tarea) => usuarios.filter((u) => t.asignados.includes(u.id)).map((u) => u.nombre).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">{visibles.length} tareas</span>
        <Button variante="primario" onClick={() => nueva()}><Plus size={15} />Nueva tarea</Button>
        {mias > 0 && <button onClick={() => setFiltro('mias')} className="rounded-full border border-primario/30 bg-primario/10 px-3 py-1 text-xs text-primario">Usted tiene {mias} por hacer</button>}
        <div className="ml-auto flex flex-wrap gap-2">
          <div className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="inp w-56 pl-8" type="search" placeholder="Buscar tareas…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex rounded-xl border border-fg/10 bg-fg/5 p-0.5 text-xs">{([['todas', 'Todas'], ['mias', 'Mis tareas'], ['alta', 'Prioridad alta']] as const).map(([v, t]) => <button key={v} onClick={() => setFiltro(v)} className={cx('rounded-lg px-2.5 py-1.5 transition', filtro === v ? 'bg-gradient-to-r from-primario to-violeta font-semibold text-black' : 'text-muted hover:text-fg')}>{t}</button>)}</div>
        </div>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {COLUMNAS.map((c) => {
          const lista = visibles.filter((t) => t.estado === c.id).sort((a, b) => a.orden - b.orden)
          return (
            <div key={c.id} onDragOver={(e) => { e.preventDefault(); if (sobre?.col !== c.id || sobre.antes) setSobre({ col: c.id }) }} onDrop={(e) => soltar(e, c.id)}
              className={cx('glass flex w-[280px] shrink-0 flex-col p-3 transition', sobre?.col === c.id && 'ring-1 ring-primario/60')}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em]"><span className={cx('h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]', c.punto)} />{c.nombre}<span className="rounded-full bg-fg/10 px-2 py-0.5 text-[10px] tracking-normal text-muted">{lista.length}</span></span>
                <button aria-label={`Nueva tarea en ${c.nombre}`} onClick={() => nueva(c.id)} className="rounded-lg p-1 text-muted hover:bg-fg/10 hover:text-fg"><Plus size={15} /></button>
              </div>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {lista.map((t) => {
                    const ch = chipFecha(t.vence), fondo = COLORES_TAREA[t.color]
                    return (
                      <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: arrastrando === t.id ? 0.4 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                        {sobre?.antes === t.id && <div className="mb-2 h-0.5 rounded-full bg-primario" />}
                        <div draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando(t.id) }} onDragEnd={() => { setArrastrando(null); setSobre(null) }}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (sobre?.antes !== t.id) setSobre({ col: c.id, antes: t.id }) }} onDrop={(e) => soltar(e, c.id, t.id)}
                          onClick={() => { setError(''); setForm(t) }} style={fondo ? { background: fondo } : undefined}
                          className={cx('group cursor-grab rounded-2xl p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,.5)] transition hover:-translate-y-0.5 active:cursor-grabbing', fondo ? 'text-stone-900' : 'border border-fg/10 bg-fg/[.06]')}>
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            {ch ? <span className={cx('flex items-center gap-1', ch.vencida && (fondo ? 'text-red-700' : 'text-peligro'))}><CalendarDays size={12} />{ch.txt}</span> : <span className="opacity-60">Sin fecha</span>}
                            <span className={cx('grid h-6 w-6 place-items-center rounded-full border transition group-hover:rotate-[-45deg]', fondo ? 'border-black/15' : 'border-fg/15')}><ArrowRight size={12} /></span>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold leading-snug">{t.titulo}</p>
                          {t.etiquetas.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{t.etiquetas.slice(0, 3).map((e) => <span key={e} className={cx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', fondo ? 'bg-black/10' : 'bg-fg/10')}>#{e}</span>)}</div>}
                          <div className="mt-2.5 flex items-center justify-between"><span className={cx('text-[11px]', t.prioridad === 'alta' ? 'font-bold' : 'opacity-70')}>{PRIORIDAD[t.prioridad]}</span><Avatares ids={t.asignados} claro={!!fondo} /></div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                {!lista.length && <button onClick={() => nueva(c.id)} className="grid flex-1 place-items-center rounded-2xl border border-dashed border-fg/15 py-6 text-xs text-muted transition hover:border-primario/50 hover:text-fg">Arrastre una tarea aquí<br />o cree una nueva</button>}
              </div>
            </div>
          )
        })}
      </div>
      {fiesta && <div className="pointer-events-none fixed z-50" style={{ left: fiesta.x, top: fiesta.y }} key={fiesta.k}>{Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, r = 50 + (i % 3) * 18; return <motion.span key={i} className="absolute h-2 w-2 rounded-full" style={{ background: Object.values(COLORES_TAREA).filter(Boolean)[i % 5] }} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.4 }} transition={{ duration: 0.9, ease: 'easeOut' }} /> })}</div>}
      <p className="text-[11px] text-muted">Arrastre las tarjetas entre columnas. Las tareas son del equipo: quien tenga una asignada la ve en «Mis tareas» y en la campana de avisos al ingresar.</p>

      <Modal abierto={!!form} onClose={() => setForm(null)} titulo={form && tareas.some((x) => x.id === form.id) ? 'Editar tarea' : 'Nueva tarea'} ancho="max-w-2xl">
        {form && <div className="space-y-4">
          <input autoFocus className="inp !text-lg font-semibold" placeholder="¿Qué hay que hacer?" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <textarea className="inp min-h-[80px]" placeholder="Detalles (opcional)" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Columna"><select className="inp" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoTarea })}>{COLUMNAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
            <Campo label="Prioridad"><select className="inp" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></Campo>
            <Campo label="Fecha límite"><input type="date" className="inp" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} /></Campo>
          </div>
          <Campo label="Asignar a">
            <div className="flex flex-wrap gap-2">{usuarios.map((u) => { const si = form.asignados.includes(u.id); return (
              <button key={u.id} type="button" onClick={() => setForm({ ...form, asignados: si ? form.asignados.filter((x) => x !== u.id) : [...form.asignados, u.id] })}
                className={cx('flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition', si ? 'border-primario/60 bg-primario/15' : 'border-fg/10 hover:bg-fg/5')}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-amber-200 via-primario to-violeta text-[8px] font-bold text-black">{iniciales(u.nombre)}</span>{u.nombre.split(' ')[0]}<span className="text-muted">· {u.rol}</span></button>) })}</div>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Etiquetas (separadas por coma)"><input className="inp" placeholder="Inventario, Urgente" value={form.etiquetas.join(', ')} onChange={(e) => setForm({ ...form, etiquetas: e.target.value.split(',') })} /></Campo>
            <Campo label="Color"><div className="flex gap-2 pt-1">{Object.entries(COLORES_TAREA).map(([k, c]) => <button key={k} type="button" title={k} onClick={() => setForm({ ...form, color: k })} className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-[color:var(--bg2)] transition', form.color === k ? 'ring-2 ring-primario' : 'ring-1 ring-fg/15')} style={{ background: c || 'rgb(var(--fg) / .08)' }} />)}</div></Campo>
          </div>
          <div className="rounded-2xl bg-fg/5 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-muted">Con Google</div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!form.vence || !form.titulo} title={form.vence ? '' : 'Ponga una fecha límite'} onClick={() => abrir(urlCalendario({ titulo: `Tarea: ${form.titulo}`, detalle: `${form.descripcion}\n\nResponsables: ${nombres(form)}\nCreada en NEXORA.`, fecha: form.vence, invitados: correos(form) }))}><CalendarDays size={14} />Agregar a Calendar</Button>
              <Button onClick={() => abrir(URLS.meet)}><Video size={14} />Reunión en Meet</Button>
              <Button disabled={!form.titulo} onClick={() => abrir(urlGmail(correos(form), `Tarea asignada: ${form.titulo}`, `Hola ${nombres(form) || 'equipo'}:\n\nSe le asignó la tarea «${form.titulo}»${form.vence ? ` para el ${fecha(form.vence + 'T12:00:00')}` : ''} (prioridad ${form.prioridad}).\n\n${form.descripcion}\n\nVea el tablero en NEXORA → Espacio de trabajo.`))}><Mail size={14} />Avisar por Gmail</Button>
            </div>
          </div>
          {error && <p className="text-sm text-peligro">{error}</p>}
          <div className="flex justify-between gap-2">
            {tareas.some((x) => x.id === form.id) ? <Button variante="peligro" onClick={() => { if (confirm(`¿Eliminar la tarea «${form.titulo}»?`)) { eliminarTarea(form.id); setForm(null) } }}><Trash2 size={14} />Eliminar</Button> : <span />}
            <div className="flex gap-2"><Button onClick={() => setForm(null)}>Cancelar</Button><Button variante="primario" onClick={guardar}>Guardar tarea</Button></div>
          </div>
        </div>}
      </Modal>
    </div>
  )
}
