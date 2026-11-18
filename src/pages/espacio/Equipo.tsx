import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, AtSign, Briefcase, Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Download, Mail, MapPin, Pencil, Phone, Plus, Trash2, Upload, User, Users, Video } from 'lucide-react'
import { useApp, type Cliente, type Redes, type Usuario, tieneRol, rolesDe } from '../../store/useApp'
import { Button, Campo, Modal, cx } from '../../components/ui'
import { Marca } from '../../components/Marca'
import { abrir, urlCalendario, urlGmail, URLS } from '../../lib/google'
import { contactosGoogle, usuarioDesde, type ContactoImportado } from '../../lib/contactos'
import { MESES, hoyISO } from '../../lib/resumen'
import { fecha, fechaHora } from '../../lib/format'
import { COLORES_TAREA, iniciales } from './Tablero'
import { pedirEliminar } from '../../components/Eliminacion'

const suave = [0.16, 1, 0.3, 1] as const
const digitos = (t?: string) => (t ?? '').replace(/[^\d]/g, '')
const enlace = (v: string | undefined, base: string) => (!v ? '' : /^https?:\/\//.test(v) ? v : `${base}${v.replace(/^@/, '')}`)
const REDES: { k: keyof Redes; nombre: string; slug: string; base: string; ayuda: string }[] = [
  { k: 'linkedin', nombre: 'LinkedIn', slug: 'linkedin', base: 'https://www.linkedin.com/in/', ayuda: 'usuario o enlace' },
  { k: 'whatsapp', nombre: 'WhatsApp', slug: 'whatsapp', base: 'https://wa.me/', ayuda: 'número con código de país' },
  { k: 'discord', nombre: 'Discord', slug: 'discord', base: 'https://discord.com/users/', ayuda: 'enlace o ID' },
  { k: 'slack', nombre: 'Slack', slug: 'slack', base: 'https://', ayuda: 'enlace del perfil' },
  { k: 'instagram', nombre: 'Instagram', slug: 'instagram', base: 'https://instagram.com/', ayuda: '@usuario' },
]

/** Foto del perfil reducida a 192 px para guardarla liviana. */
function leerFoto(f: File): Promise<string> {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(f)
    img.onload = () => { const t = 192, c = document.createElement('canvas'), k = Math.max(t / img.width, t / img.height); c.width = c.height = t; c.getContext('2d')!.drawImage(img, (t - img.width * k) / 2, (t - img.height * k) / 2, img.width * k, img.height * k); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85)) }
    img.onerror = no; img.src = url
  })
}
export function Avatar({ u, tam = 40, className }: { u?: Pick<Usuario, 'nombre' | 'foto'>; tam?: number; className?: string }) {
  return u?.foto ? <img src={u.foto} alt="" className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: tam, height: tam }} />
    : <span className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 via-primario to-violeta font-bold text-black', className)} style={{ width: tam, height: tam, fontSize: tam * 0.36 }}>{iniciales(u?.nombre ?? '?')}</span>
}
function Circulo({ titulo, onClick, children, disabled }: { titulo: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <motion.button whileHover={{ y: -2, scale: 1.06 }} whileTap={{ scale: 0.94 }} title={titulo} aria-label={titulo} disabled={disabled} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full border border-fg/10 bg-fg/5 text-fg transition hover:border-primario/50 hover:bg-primario/15 disabled:opacity-30">{children}</motion.button>
}
const Dato = ({ icono, titulo, children, accion }: { icono: ReactNode; titulo: string; children: ReactNode; accion?: ReactNode }) => (
  <div className="flex items-center gap-3 border-b border-fg/5 py-2.5 last:border-0">
    <span className="text-muted">{icono}</span><div className="min-w-0 flex-1"><div className="text-[11px] text-muted">{titulo}</div><div className="truncate text-sm font-semibold">{children}</div></div>{accion}
  </div>
)

export default function Equipo() {
  const { usuarios, usuario, tareas, auditoria, sucursales, empresa, clientes, proveedores, guardarUsuario, guardarCliente, eliminarCliente, importarPersonas } = useApp()
  const [selId, setSelId] = useState(usuario?.id ?? usuarios[0]?.id)
  const sel = usuarios.find((u) => u.id === selId) ?? usuarios[0]
  const [perfil, setPerfil] = useState<Usuario | null>(null), [errP, setErrP] = useState('')
  const [importar, setImportar] = useState<(ContactoImportado & { tipo: 'omitir' | 'equipo' | 'cliente' | 'proveedor'; existe: boolean })[] | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [mes, setMes] = useState(() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() } })
  const [aviso, setAviso] = useState('')
  const archivo = useRef<HTMLInputElement>(null)
  const puedeEditar = (u: Usuario) => usuario?.id === u.id || tieneRol(usuario, 'Gerente General')

  const suyas = useMemo(() => tareas.filter((t) => sel && t.asignados.includes(sel.id)).sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999')), [tareas, sel])
  const ultimoIngreso = sel ? [...auditoria].reverse().find((e) => e.accion === 'Inicio de sesión' && e.usuario === sel.nombre)?.fecha : undefined
  const abiertas = tareas.filter((t) => t.estado === 'pendiente' || t.estado === 'progreso').length
  const hechas7 = tareas.filter((t) => t.estado === 'hecho' && Date.now() - new Date(t.actualizada).getTime() < 7 * 864e5).length
  const discordEquipo = empresa.conexiones?.discord

  const cargarArchivo = async (f: File) => {
    const lista = contactosGoogle(await f.text())
    if (!lista.length) return setAviso('No encontré contactos en ese archivo. Expórtelo desde Google Contactos en formato «Google CSV».')
    const correos = new Set([...usuarios.map((u) => u.email), ...clientes.map((c) => c.email), ...proveedores.map((p) => p.email)].filter(Boolean).map((e) => e.toLowerCase()))
    setImportar(lista.map((c) => ({ ...c, tipo: 'omitir', existe: !!c.email && correos.has(c.email.toLowerCase()) })))
  }
  const confirmarImportacion = () => {
    if (!importar) return
    const elegidos = importar.filter((x) => x.tipo !== 'omitir').map((x) => ({ ...x, tipo: x.tipo as 'equipo' | 'cliente' | 'proveedor' }))
    const r = importarPersonas(elegidos, usuarioDesde)
    setImportar(null)
    setAviso(`Listo: ${r.equipo} al equipo (usuario = primer nombre, contraseña = usuario + 2026), ${r.clientes} clientes y ${r.proveedores} proveedores.`)
  }
  const guardarPerfil = () => {
    if (!perfil) return
    const nombre = [perfil.nombres, perfil.apellidos].filter((x) => x?.trim()).join(' ').trim() || perfil.nombre
    const e = guardarUsuario({ ...perfil, nombre })
    if (e) return setErrP(e)
    setPerfil(null)
  }
  const editar = (u: Usuario) => { setErrP(''); const p = u.nombre.split(' '); setPerfil({ ...u, nombres: u.nombres ?? p.slice(0, Math.ceil(p.length / 2)).join(' '), apellidos: u.apellidos ?? p.slice(Math.ceil(p.length / 2)).join(' '), redes: { ...u.redes }, sucursales: u.sucursales ?? [] }) }

  // Calendario del mes con las tareas de la persona
  const dias = new Date(mes.a, mes.m + 1, 0).getDate(), inicio = (new Date(mes.a, mes.m, 1).getDay() + 6) % 7
  const delDia = (d: number) => { const f = `${mes.a}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; return suyas.filter((t) => t.vence === f) }
  const embudo = (['pendiente', 'progreso', 'hecho'] as const).map((e) => ({ e, n: suyas.filter((t) => t.estado === e).length }))
  const maxE = Math.max(1, ...embudo.map((x) => x.n))

  if (!sel) return null
  const tel = sel.telefono || sel.redes?.whatsapp
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {[[<Users key="a" size={15} />, usuarios.length, 'personas en el equipo'], [<Clock key="b" size={15} />, abiertas, 'tareas abiertas'], [<CalendarDays key="c" size={15} />, hechas7, 'hechas esta semana']].map(([i, v, t]) => (
          <div key={String(t)} className="flex items-center gap-2.5 rounded-2xl bg-fg/5 px-3 py-2 ring-1 ring-fg/5"><span className="grid h-8 w-8 place-items-center rounded-xl bg-fg/5 text-primario">{i}</span><div className="leading-tight"><div className="font-display text-lg font-bold">{v}</div><div className="text-[10px] text-muted">{t}</div></div></div>))}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => archivo.current?.click()}><Upload size={14} />Importar de Google Contactos</Button>
          {usuario && <Button variante="primario" onClick={() => editar(usuarios.find((u) => u.id === usuario.id) ?? usuario)}><User size={14} />Mi perfil</Button>}
        </div>
        <input ref={archivo} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) cargarArchivo(f); e.target.value = '' }} />
      </div>
      {aviso && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-exito/10 px-3 py-2 text-xs text-exito">{aviso}</motion.p>}

      {/* Personas */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{usuarios.map((u) => (
        <motion.button key={u.id} layout whileHover={{ y: -3 }} onClick={() => setSelId(u.id)} className={cx('flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition', u.id === sel.id ? 'border-primario/60 bg-primario/10' : 'border-fg/10 bg-fg/[.03] hover:bg-fg/5')}>
          <Avatar u={u} tam={34} /><div className="leading-tight"><div className="text-sm font-semibold">{u.nombre.split(' ').slice(0, 2).join(' ')}</div><div className="text-[10px] text-muted">{u.cargo || u.rol}</div></div>
        </motion.button>))}</div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {/* Historial de tareas (tarjetas de color) */}
          <section className="glass p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Tareas de {sel.nombre.split(' ')[0]}</h3><span className="text-xs text-muted">{suyas.length} en total</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">{suyas.slice(0, 6).map((t, k) => { const fondo = COLORES_TAREA[t.color] || '#D9D3BF'; return (
                <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ delay: k * 0.04, duration: 0.45, ease: suave }} whileHover={{ y: -4, rotate: -0.4 }}
                  className="relative flex min-h-[130px] flex-col rounded-3xl p-4 text-stone-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,.7)]" style={{ background: fondo }}>
                  <div className="flex items-start justify-between"><span className="text-[11px] font-semibold opacity-70">{t.vence ? fecha(t.vence + 'T12:00:00') : 'Sin fecha'}</span><span className="grid h-7 w-7 place-items-center rounded-full border border-black/15"><ArrowUpRight size={13} /></span></div>
                  <p className="mt-1 text-sm font-bold leading-snug">{t.titulo}</p>
                  <div className="mt-auto flex items-end justify-between pt-3"><span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold">{{ pendiente: 'Pendiente', progreso: 'En progreso', hecho: 'Hecho', archivado: 'Archivado' }[t.estado]}</span><span className="text-[10px] font-semibold opacity-70">{t.prioridad}</span></div>
                </motion.div>) })}</AnimatePresence>
              {!suyas.length && <p className="col-span-full rounded-2xl border border-dashed border-fg/15 p-6 text-center text-sm text-muted">Sin tareas asignadas. Asígnele una desde el Tablero.</p>}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Agenda del mes */}
            <section className="glass p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Agenda de tareas</h3>
                <div className="flex items-center gap-1"><button aria-label="Mes anterior" onClick={() => setMes(mes.m ? { a: mes.a, m: mes.m - 1 } : { a: mes.a - 1, m: 11 })} className="grid h-7 w-7 place-items-center rounded-full border border-fg/10 hover:bg-fg/10"><ChevronLeft size={14} /></button><span className="w-28 text-center text-sm font-semibold">{MESES[mes.m]} {mes.a}</span><button aria-label="Mes siguiente" onClick={() => setMes(mes.m === 11 ? { a: mes.a + 1, m: 0 } : { a: mes.a, m: mes.m + 1 })} className="grid h-7 w-7 place-items-center rounded-full border border-fg/10 hover:bg-fg/10"><ChevronRight size={14} /></button></div></div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, k) => <span key={k}>{d}</span>)}</div>
              <div className="mt-1 grid grid-cols-7 gap-1">{Array.from({ length: inicio }, (_, k) => <span key={`v${k}`} />)}{Array.from({ length: dias }, (_, k) => {
                const d = k + 1, ts = delDia(d), hoy = hoyISO() === `${mes.a}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                return <div key={d} title={ts.map((t) => t.titulo).join(' · ')} className={cx('flex aspect-square flex-col items-center justify-between rounded-lg p-1 text-[10px]', ts.length ? 'font-bold text-stone-900' : 'bg-fg/[.04] text-muted', hoy && 'ring-1 ring-primario')} style={ts.length ? { background: COLORES_TAREA[ts[0].color] || '#D9D3BF' } : undefined}>
                  <span>{d}</span>{ts.length > 0 && <span className="rounded-full bg-black/15 px-1 text-[9px]">{ts.length}</span>}</div>
              })}</div>
            </section>
            {/* Embudo de avance */}
            <section className="glass p-4 sm:p-5">
              <h3 className="mb-1 font-semibold">Avance de sus tareas</h3><p className="mb-4 text-xs text-muted">De pendiente a hecho</p>
              <div className="space-y-2.5">{embudo.map((x, k) => (
                <div key={x.e} className="mx-auto" style={{ width: `${100 - k * 12}%` }}>
                  <div className="flex items-center justify-between rounded-2xl bg-fg/5 px-4 py-3 ring-1 ring-fg/5"><span className="text-xs text-muted">{{ pendiente: 'Pendientes', progreso: 'En progreso', hecho: 'Hechas' }[x.e]}</span><span className="font-display text-xl font-bold">{x.n}</span></div>
                  <motion.div className="mt-1 h-1 rounded-full bg-gradient-to-r from-violeta to-primario" initial={{ width: 0 }} animate={{ width: `${(x.n / maxE) * 100}%` }} transition={{ duration: 0.9, delay: 0.1 * k, ease: suave }} />
                </div>))}</div>
            </section>
          </div>
        </div>

        {/* Ficha de la persona */}
        <div className="space-y-4">
          <motion.section key={sel.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: suave }} className="glass relative overflow-hidden p-5 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(80%_100%_at_50%_0%,rgb(var(--t-oro)/.35),transparent)]" />
            <div className="relative mx-auto w-fit rounded-full p-1 ring-2 ring-primario/40"><Avatar u={sel} tam={92} /></div>
            <h3 className="relative mt-3 font-display text-xl font-bold">{sel.nombre}</h3>
            <p className="relative text-xs text-muted">{sel.cargo || rolesDe(sel).join(' · ')} · {empresa.nombre || 'Mi empresa'}</p>
            <div className="relative mt-4 flex flex-wrap justify-center gap-2">
              {puedeEditar(sel) && <Circulo titulo="Editar perfil" onClick={() => editar(sel)}><Pencil size={15} /></Circulo>}
              <Circulo titulo="Escribir por Gmail" disabled={!sel.email} onClick={() => abrir(urlGmail([sel.email], '', `Hola ${sel.nombre.split(' ')[0]}:\n\n`))}><Mail size={15} /></Circulo>
              <Circulo titulo="Llamar" disabled={!sel.telefono} onClick={() => { location.href = `tel:${sel.telefono}` }}><Phone size={15} /></Circulo>
              <Circulo titulo="WhatsApp" disabled={!digitos(tel)} onClick={() => abrir(`https://wa.me/${digitos(tel)}`)}><Marca slug="whatsapp" tam={22} className="!rounded-full !shadow-none !ring-0" /></Circulo>
              <Circulo titulo="Videollamada en Meet" onClick={() => abrir(URLS.meet)}><Video size={15} /></Circulo>
              <Circulo titulo={discordEquipo || sel.redes?.discord ? 'Videollamada en Discord' : 'Agregue el Discord del equipo en Conexiones'} disabled={!discordEquipo && !sel.redes?.discord} onClick={() => abrir(discordEquipo || enlace(sel.redes?.discord, 'https://discord.com/users/'))}><Marca slug="discord" tam={22} className="!rounded-full !shadow-none !ring-0" /></Circulo>
              <Circulo titulo="Agendar reunión en Calendar" onClick={() => { const m = new Date(Date.now() + 864e5); abrir(urlCalendario({ titulo: `Reunión con ${sel.nombre}`, fecha: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`, hora: '10:00', minutos: 30, invitados: sel.email ? [sel.email] : [] })) }}><CalendarDays size={15} /></Circulo>
            </div>
          </motion.section>
          <section className="glass p-5">
            <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold">Información detallada</h3>{puedeEditar(sel) && <button onClick={() => editar(sel)} className="grid h-8 w-8 place-items-center rounded-full border border-fg/10 hover:bg-fg/10"><Pencil size={13} /></button>}</div>
            <Dato icono={<User size={15} />} titulo="Nombres">{sel.nombres || sel.nombre.split(' ').slice(0, Math.ceil(sel.nombre.split(' ').length / 2)).join(' ')}</Dato>
            <Dato icono={<User size={15} />} titulo="Apellidos">{sel.apellidos || sel.nombre.split(' ').slice(Math.ceil(sel.nombre.split(' ').length / 2)).join(' ') || '—'}</Dato>
            <Dato icono={<AtSign size={15} />} titulo="Correo">{sel.email || '—'}</Dato>
            <Dato icono={<Phone size={15} />} titulo="Celular">{sel.telefono || '—'}</Dato>
            <Dato icono={<Briefcase size={15} />} titulo={rolesDe(sel).length > 1 ? 'Roles en NEXORA' : 'Rol en NEXORA'}>{rolesDe(sel).join(' · ')} · usuario «{sel.usuario}»</Dato>
            <Dato icono={<MapPin size={15} />} titulo="Sucursales">{sel.sucursales?.length ? sel.sucursales.map((id) => sucursales.find((s) => s.id === id)?.ciudad ?? id).join(', ') : 'Todas'}</Dato>
            <div className="flex items-center gap-3 border-b border-fg/5 py-2.5"><span className="text-muted"><Building2 size={15} /></span><div className="flex-1"><div className="text-[11px] text-muted">Redes</div>
              <div className="mt-1 flex flex-wrap gap-1.5">{REDES.filter((r) => sel.redes?.[r.k]).map((r) => <button key={r.k} title={r.nombre} onClick={() => abrir(enlace(sel.redes?.[r.k], r.base))} className="transition hover:-translate-y-0.5"><Marca slug={r.slug} tam={30} /></button>)}
                {!REDES.some((r) => sel.redes?.[r.k]) && <span className="text-sm font-semibold">—</span>}</div></div></div>
            <Dato icono={<Clock size={15} />} titulo="Último ingreso">{ultimoIngreso ? fechaHora(ultimoIngreso) : 'Aún no ingresa'}</Dato>
          </section>
        </div>
      </div>

      {/* Clientes y contactos */}
      <section className="glass p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Clientes y contactos <span className="text-sm font-normal text-muted">({clientes.length})</span></h3>
          <Button className="text-xs" onClick={() => setCliente({ id: crypto.randomUUID(), nombre: '', email: '', telefono: '', empresa: '', nota: '' })}><Plus size={13} />Nuevo cliente</Button></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{clientes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-fg/5 p-3 ring-1 ring-fg/5"><Avatar u={{ nombre: c.nombre }} tam={36} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.nombre}</div><div className="truncate text-[11px] text-muted">{[c.empresa, c.email || c.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</div></div>
            <div className="flex gap-1">{c.email && <button title="Gmail" onClick={() => abrir(urlGmail([c.email], '', `Hola ${c.nombre.split(' ')[0]}:\n\n`))} className="rounded-lg p-1.5 hover:bg-fg/10"><Mail size={14} /></button>}
              {digitos(c.telefono) && <button title="WhatsApp" onClick={() => abrir(`https://wa.me/${digitos(c.telefono)}`)} className="rounded-lg p-1 hover:bg-fg/10"><Marca slug="whatsapp" tam={22} className="!shadow-none" /></button>}
              <button title="Editar" onClick={() => setCliente(c)} className="rounded-lg p-1.5 hover:bg-fg/10"><Pencil size={13} /></button>
              <button title="Eliminar" onClick={() => pedirEliminar({ titulo: `¿Eliminar a ${c.nombre}?`, detalle: 'El cliente queda en la Papelera por si lo necesita.', listo: `${c.nombre} eliminado`, accion: () => eliminarCliente(c.id) })} className="rounded-lg p-1.5 text-peligro hover:bg-peligro/10"><Trash2 size={13} /></button></div>
          </div>))}
          {!clientes.length && <p className="col-span-full text-sm text-muted">Agregue sus clientes o impórtelos desde Google Contactos.</p>}</div>
      </section>

      {/* Editar perfil */}
      <Modal abierto={!!perfil} onClose={() => setPerfil(null)} titulo="Perfil de la persona" ancho="max-w-2xl">
        {perfil && <div className="space-y-4">
          <div className="flex items-center gap-4"><Avatar u={perfil} tam={72} />
            <div className="flex flex-wrap gap-2"><label className="cursor-pointer"><span className="inline-flex items-center gap-2 rounded-xl border border-fg/10 bg-fg/5 px-3.5 py-2 text-sm hover:bg-fg/10"><Upload size={14} />Subir foto</span><input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPerfil({ ...perfil, foto: await leerFoto(f) }) }} /></label>
              {perfil.foto && <Button onClick={() => setPerfil({ ...perfil, foto: undefined })}>Quitar foto</Button>}</div></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nombres"><input className="inp" value={perfil.nombres ?? ''} onChange={(e) => setPerfil({ ...perfil, nombres: e.target.value })} /></Campo>
            <Campo label="Apellidos"><input className="inp" value={perfil.apellidos ?? ''} onChange={(e) => setPerfil({ ...perfil, apellidos: e.target.value })} /></Campo>
            <Campo label="Correo"><input className="inp" type="email" value={perfil.email} onChange={(e) => setPerfil({ ...perfil, email: e.target.value })} /></Campo>
            <Campo label="Celular"><input className="inp" placeholder="+593 99 123 4567" value={perfil.telefono ?? ''} onChange={(e) => setPerfil({ ...perfil, telefono: e.target.value })} /></Campo>
            <Campo label="Cargo"><input className="inp" placeholder="Jefa de ventas" value={perfil.cargo ?? ''} onChange={(e) => setPerfil({ ...perfil, cargo: e.target.value })} /></Campo>
          </div>
          <Campo label="Sucursales donde trabaja (vacío = todas)"><div className="flex flex-wrap gap-2">{sucursales.map((s) => { const si = perfil.sucursales?.includes(s.id); return (
            <button key={s.id} type="button" onClick={() => setPerfil({ ...perfil, sucursales: si ? perfil.sucursales!.filter((x) => x !== s.id) : [...(perfil.sucursales ?? []), s.id] })} className={cx('rounded-full border px-3 py-1 text-xs transition', si ? 'border-primario/60 bg-primario/15' : 'border-fg/10 hover:bg-fg/5')}>{s.id} · {s.ciudad}</button>) })}</div></Campo>
          <div><div className="mb-2 text-xs font-medium text-muted">Redes y mensajería</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{REDES.map((r) => <label key={r.k} className="flex items-center gap-2"><Marca slug={r.slug} tam={32} /><input className="inp" placeholder={`${r.nombre}: ${r.ayuda}`} value={perfil.redes?.[r.k] ?? ''} onChange={(e) => setPerfil({ ...perfil, redes: { ...perfil.redes, [r.k]: e.target.value } })} /></label>)}</div></div>
          {errP && <p className="text-sm text-peligro">{errP}</p>}
          <div className="flex justify-end gap-2"><Button onClick={() => setPerfil(null)}>Cancelar</Button><Button variante="primario" onClick={guardarPerfil}>Guardar perfil</Button></div>
        </div>}
      </Modal>

      {/* Importar contactos: primero se pregunta quién es cada persona */}
      <Modal abierto={!!importar} onClose={() => setImportar(null)} titulo="¿Quiénes son estas personas?" ancho="max-w-3xl">
        {importar && <div className="space-y-3">
          <p className="text-sm text-muted">Encontré {importar.length} contactos. Indique quién es cada uno; los que deje en «No importar» no se agregan.</p>
          <div className="flex flex-wrap gap-2 text-xs">{([['equipo', 'Todos al equipo'], ['cliente', 'Todos clientes'], ['proveedor', 'Todos proveedores'], ['omitir', 'Ninguno']] as const).map(([t, l]) => <Button key={t} className="text-xs" onClick={() => setImportar(importar.map((x) => ({ ...x, tipo: x.existe ? 'omitir' : t })))}>{l}</Button>)}</div>
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">{importar.map((c, k) => (
            <div key={k} className="flex items-center gap-3 rounded-xl bg-fg/5 px-3 py-2">
              <Avatar u={{ nombre: c.nombre }} tam={32} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.nombre}{c.existe && <span className="ml-2 rounded-full bg-alerta/15 px-2 text-[10px] text-alerta">ya está en NEXORA</span>}</div><div className="truncate text-[11px] text-muted">{[c.empresa, c.cargo, c.email, c.telefono].filter(Boolean).join(' · ')}</div></div>
              <select className="inp !w-40 text-xs" value={c.tipo} onChange={(e) => setImportar(importar.map((x, i) => (i === k ? { ...x, tipo: e.target.value as typeof c.tipo } : x)))}>
                <option value="omitir">No importar</option><option value="equipo">Es de mi equipo</option><option value="cliente">Es cliente</option><option value="proveedor">Es proveedor</option></select>
            </div>))}</div>
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">{importar.filter((x) => x.tipo !== 'omitir').length} para importar</span>
            <div className="flex gap-2"><Button onClick={() => setImportar(null)}>Cancelar</Button><Button variante="primario" disabled={!importar.some((x) => x.tipo !== 'omitir')} onClick={confirmarImportacion}><Download size={14} />Importar</Button></div></div>
        </div>}
      </Modal>

      {/* Cliente */}
      <Modal abierto={!!cliente} onClose={() => setCliente(null)} titulo={cliente && clientes.some((c) => c.id === cliente.id) ? 'Editar cliente' : 'Nuevo cliente'} ancho="max-w-lg">
        {cliente && <div className="space-y-3">
          {(['nombre', 'empresa', 'email', 'telefono', 'nota'] as const).map((k) => <Campo key={k} label={{ nombre: 'Nombre', empresa: 'Empresa', email: 'Correo', telefono: 'Celular', nota: 'Nota' }[k]}><input className="inp" value={cliente[k]} onChange={(e) => setCliente({ ...cliente, [k]: e.target.value })} /></Campo>)}
          <div className="flex justify-end gap-2"><Button onClick={() => setCliente(null)}>Cancelar</Button><Button variante="primario" disabled={!cliente.nombre.trim()} onClick={() => { guardarCliente({ ...cliente, nombre: cliente.nombre.trim() }); setCliente(null) }}>Guardar</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
