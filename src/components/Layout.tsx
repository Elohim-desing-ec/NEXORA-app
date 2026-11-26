import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { diasRestantes } from '../lib/cuenta'
import { guardarYa, salir, useEstadoNube } from '../lib/nube'
import { useVersionNueva } from '../lib/version'
import { Ficha, datosFicha, leerFicha, type DatosFicha } from './Ficha'
import { SIMBOLOS } from '../data/paises'
import { stockTotal } from '../lib/inventario'
import type { Producto } from '../data/base'
import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Bell, Boxes, Brain, ChevronsLeft, Cloud, CloudOff, Gift, RefreshCw, FileDown, LayoutDashboard, LogOut, Settings, Globe2, Maximize2, Minimize2, Moon, Receipt, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sun, Menu, Wallet, SquareKanban, X } from 'lucide-react'
import { useApp, permisosDe, rolesDe, type Pagina } from '../store/useApp'
import { useEcon } from '../store/useEcon'
import { Logo } from './Logo'
import { Asistente } from './Asistente'
import { cx } from './ui'
import { plural } from '../lib/format'
import { enQuiebre, etiquetaProducto } from '../lib/inventario'
import { avisosProveedores } from '../lib/proveedores'
import { normalizar } from '../lib/preguntas'
import { useTx } from '../lib/idioma'
import { SelectorIdioma } from './SelectorIdioma'
import { SelectorTema } from './SelectorTema'

/** Menú agrupado: arriba el Dashboard y el Espacio de trabajo; Operación (inventario, compras, ventas, gastos), Control (trazabilidad, reportes, red) y Finanzas; abajo Configuración y la IA. */
export const MENU: { id: Pagina; label: string; icon: ReactNode; grupo?: 'Operación' | 'Control' | 'Finanzas' | 'pie' }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'espacio', label: 'Espacio de trabajo', icon: <SquareKanban size={18} /> },
  { id: 'productos', label: 'Inventario', icon: <Boxes size={18} />, grupo: 'Operación' },
  { id: 'compras', label: 'Compras', icon: <ShoppingCart size={18} />, grupo: 'Operación' },
  { id: 'ventas', label: 'Ventas', icon: <ShoppingBag size={18} />, grupo: 'Operación' },
  { id: 'gastos', label: 'Gastos', icon: <Receipt size={18} />, grupo: 'Operación' },
  { id: 'auditoria', label: 'Trazabilidad', icon: <ShieldCheck size={18} />, grupo: 'Control' },
  { id: 'reportes', label: 'Reportes', icon: <FileDown size={18} />, grupo: 'Control' },
  { id: 'red', label: 'Red global', icon: <Globe2 size={18} />, grupo: 'Control' },
  { id: 'economico', label: 'Análisis económico', icon: <BarChart3 size={18} />, grupo: 'Finanzas' },
  { id: 'resumen', label: 'Resumen', icon: <Wallet size={18} />, grupo: 'Finanzas' },
  { id: 'configuracion', label: 'Configuración', icon: <Settings size={18} />, grupo: 'pie' },
  { id: 'ia', label: 'IA NEXORA', icon: <Brain size={18} />, grupo: 'pie' },
]
const GRUPOS = ['Operación', 'Control', 'Finanzas'] as const
/** Nombres del menú en inglés y portugués (el español está en MENU y GRUPOS). */
const TRAD: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Painel'], espacio: ['Workspace', 'Espaço de trabalho'], productos: ['Inventory', 'Estoque'], compras: ['Purchasing', 'Compras'], ventas: ['Sales', 'Vendas'], gastos: ['Expenses', 'Despesas'], red: ['Global network', 'Rede global'],
  auditoria: ['Traceability', 'Rastreabilidade'], reportes: ['Reports', 'Relatórios'], economico: ['Economic analysis', 'Análise econômica'], resumen: ['Summary', 'Resumo'],
  configuracion: ['Settings', 'Configurações'], ia: ['NEXORA AI', 'IA NEXORA'], 'Operación': ['Operations', 'Operação'], Control: ['Control', 'Controle'], Finanzas: ['Finance', 'Finanças'],
}

/**
 * Fondo "obsidiana": resplandor cenital, haces de luz diagonales y textura de grano.
 * `quieto`: sin animaciones (dentro del sistema hay muchas tarjetas de vidrio encima y moverse detrás obliga a redibujar su desenfoque en cada cuadro).
 */
export function Fondo({ quieto = false }: { quieto?: boolean }) {
  const anim = (c: string) => (quieto ? '' : c)
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-[-38rem] h-[70rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--t-oro)/.16),rgb(var(--t-oscuro)/.05)_55%,transparent)]" />
      <div className={`haz absolute -left-48 -top-40 h-[150%] w-[30rem] rotate-[24deg] ${anim('animate-destello')}`} />
      <div className={`haz absolute left-[16%] -top-40 h-[150%] w-[9rem] rotate-[24deg] ${anim('animate-destello [animation-delay:-2s]')}`} />
      <div className={`haz absolute right-[8%] -top-40 h-[150%] w-[14rem] -rotate-[18deg] opacity-60 ${anim('animate-destello [animation-delay:-1s]')}`} />
      <div className={`absolute -bottom-72 -right-48 h-[42rem] w-[42rem] rounded-full bg-violeta/10 blur-[150px] ${anim('animate-orbe')}`} />
      <div className="ruido absolute inset-0" />
    </div>
  )
}

function Paleta({ abierta, cerrar }: { abierta: boolean; cerrar: () => void }) {
  const tx = useTx()
  const { usuario, ir, productos } = useApp()
  const setTab = useEcon((s) => s.setTab)
  const [q, setQ] = useState('')
  const permitidas = usuario ? permisosDe(usuario) : []
  const res = useMemo(() => {
    const n = normalizar(q)
    const items: { tipo: string; label: string; go: () => void }[] = [
      ...MENU.filter((m) => permitidas.includes(m.id)).map((m) => ({ tipo: 'Página', label: m.label, go: () => ir(m.id) })),
      ...(permitidas.includes('productos') ? productos.map((p) => ({ tipo: 'Producto', label: `${p.sku} · ${p.nombre}`, go: () => { sessionStorage.setItem('nx-p', p.id); ir('productos') } })) : []),
      ...(permitidas.includes('economico') ? ['comparacion', 'reemplazo', 'vida', 'depreciacion', 'indicadores', 'sensibilidad'].map((t) => ({ tipo: 'Análisis', label: `Pestaña ${t}`, go: () => { setTab(t); ir('economico') } })) : []),
    ]
    return (n.trim() ? items.filter((i) => normalizar(i.label).includes(n.trim())) : items.slice(0, 8)).slice(0, 12)
  }, [q, productos, permitidas, ir, setTab])
  useEffect(() => { if (abierta) setQ('') }, [abierta])
  return (
    <AnimatePresence>
      {abierta && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <motion.div initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="glass w-full max-w-xl overflow-hidden" style={{ background: 'color-mix(in srgb, var(--bg2) 90%, transparent)' }}>
            <div className="flex items-center gap-2 border-b border-fg/10 px-4"><Search size={16} className="text-muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) { res[0].go(); cerrar() } }} placeholder={tx('Buscar páginas, productos y pestañas…', 'Search pages, products and tabs…', 'Buscar páginas, produtos e abas…')} className="w-full bg-transparent py-3.5 text-sm outline-none" />
              <kbd className="rounded border border-fg/20 px-1.5 text-[10px] text-muted [@media(hover:none)]:hidden">ESC</kbd></div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {res.map((r, k) => <li key={k}><button onClick={() => { r.go(); cerrar() }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-fg/10"><span className="truncate">{r.label}</span><span className="shrink-0 text-[10px] uppercase text-muted">{r.tipo}</span></button></li>)}
              {!res.length && <li className="p-4 text-center text-sm text-muted">{tx('Sin resultados', 'No results', 'Sem resultados')}</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const tx = useTx()
  const nombre = (id: string, es: string) => (TRAD[id] ? tx(es, TRAD[id][0], TRAD[id][1]) : es)
  const { usuario, pagina, ir, tema, licencia, setTema, presentacion, setPresentacion, sucursal, setSucursal, productos, ordenes, tareas, proveedores, empresa, sucursales: SUCURSALES, menuColapsado: colapsado, setMenuColapsado: setColapsado } = useApp()
  const [movil, setMovil] = useState(false)
  const [paleta, setPaleta] = useState(false)
  const [notif, setNotif] = useState(false)
  const [escaneado, setEscaneado] = useState<{ d: DatosFicha; p?: Producto } | null>(null)
  // Pistola lectora: escribe el código muy rápido y termina con Enter. Si es un producto (o el QR de su etiqueta), se muestra su ficha.
  useEffect(() => {
    let buf = '', ultimo = 0
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const ahora = Date.now()
      if (ahora - ultimo > 80) buf = ''
      ultimo = ahora
      if (e.key === 'Enter') {
        const leido = buf.trim(); buf = ''
        if (leido.length < 3) return
        const st = useApp.getState(), ficha = leerFicha(leido)
        const p = st.productos.find((x) => x.sku.toUpperCase() === (ficha?.s ?? leido).toUpperCase())
        if (p) setEscaneado({ d: datosFicha(p, st.empresa.nombre, SIMBOLOS[st.empresa.moneda] ?? st.empresa.moneda), p })
        else if (ficha) setEscaneado({ d: ficha })
        return
      }
      if (e.key.length === 1) buf += e.key
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v) } if (e.key === 'Escape') { setPaleta(false); setEscaneado(null); if (presentacion) togglePres(false) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })
  // Menú del celular abierto: el fondo no se desplaza (en iPhone se movía la página detrás del menú)
  useEffect(() => {
    if (!movil) return
    const b = document.body.style, prev = b.overflow
    b.overflow = 'hidden'
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMovil(false) }
    window.addEventListener('keydown', k)
    return () => { b.overflow = prev; window.removeEventListener('keydown', k) }
  }, [movil])
  // Deslizar el menú hacia la izquierda lo cierra
  const [toque, setToque] = useState<number | null>(null)
  const togglePres = (v: boolean) => { setPresentacion(v); try { if (v) document.documentElement.requestFullscreen?.(); else if (document.fullscreenElement) document.exitFullscreen() } catch { /* sin pantalla completa */ } }
  if (!usuario) return null
  const permitidas = permisosDe(usuario)
  const hoy = new Date().toISOString().slice(0, 10)
  // Quien ve Compras recibe los avisos de proveedores (a quién pedir lo que falta y a qué distancia, etc.)
  const conProveedores = permitidas.includes('compras') && proveedores.length > 0
  const tieneProv = new Set(proveedores.map((p) => p.id))
  const alertas: { t: string; m: string; ir?: Pagina }[] = [
    // Tareas asignadas a quien ingresó (las vencidas primero)
    ...tareas.filter((t) => t.asignados.includes(usuario.id) && (t.estado === 'pendiente' || t.estado === 'progreso')).sort((a, b) => (a.vence || '9999').localeCompare(b.vence || '9999')).slice(0, 5)
      .map((t) => ({ t: t.vence && t.vence < hoy ? 'rojo' : 'ambar', m: `${tx('Tarea para usted', 'Task for you', 'Tarefa para você')}: ${t.titulo}${t.vence ? ` · ${t.vence < hoy ? tx('venció', 'overdue', 'venceu') : tx('vence', 'due', 'vence')} ${t.vence.slice(8)}/${t.vence.slice(5, 7)}` : ''}`, ir: 'espacio' as Pagina })),
    ...productos.filter((p) => enQuiebre(p) && !(conProveedores && tieneProv.has(p.proveedorId))).slice(0, 6).map((p) => ({ t: 'rojo', m: `Quiebre de stock: ${etiquetaProducto(p)}`, ir: 'productos' as Pagina })),
    ...(conProveedores ? avisosProveedores({ proveedores, productos, sucursales: SUCURSALES, ordenes }).slice(0, 8).map((a) => ({ ...a, ir: 'compras' as Pagina })) : []),
    ...ordenes.filter((o) => o.estado === 'Borrador').map((o) => ({ t: 'ambar', m: `${o.id} pendiente de aprobación`, ir: 'compras' as Pagina })),
  ].map((a) => (a.ir && a.ir !== 'espacio' && !permitidas.includes(a.ir) ? { ...a, ir: undefined } : a))
  const urgentes = alertas.filter((a) => a.t !== 'info').length
  const item = (m: (typeof MENU)[number]) => (
    <button key={m.id} onClick={() => { ir(m.id); setMovil(false) }} aria-label={nombre(m.id, m.label)} className={cx('group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition lg:py-2.5 lg:text-sm', colapsado && 'lg:justify-center lg:px-0', pagina === m.id ? 'text-fg' : 'text-muted hover:bg-fg/5 hover:text-fg')}>
      {pagina === m.id && <motion.span layoutId="nav" className="absolute inset-0 rounded-xl border border-primario/30 bg-gradient-to-r from-primario/25 to-violeta/10" />}
      <span className={cx('relative shrink-0', pagina === m.id && 'text-primario')}>{m.icon}</span>
      <span className={cx('relative truncate whitespace-nowrap', colapsado && 'lg:hidden')}>{nombre(m.id, m.label)}</span>
      {m.id === 'ia' && <span className={cx('relative ml-auto rounded-full bg-violeta/20 px-1.5 text-[9px] font-bold text-cian', colapsado && 'lg:hidden')}>IA</span>}
      {colapsado && <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-fg/10 px-2.5 py-1.5 text-xs font-medium text-fg opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100 lg:block" style={{ background: 'var(--bg2)' }}>{nombre(m.id, m.label)}</span>}
    </button>
  )
  const visibles = MENU.filter((m) => permitidas.includes(m.id))
  if (presentacion) return (
    <div className="presentacion min-h-full p-6"><Fondo quieto />
      <button onClick={() => togglePres(false)} className="no-print fixed right-4 top-4 z-40 flex items-center gap-2 rounded-xl bg-fg/10 px-3 py-2 text-xs backdrop-blur hover:bg-fg/20"><Minimize2 size={14} />{tx('Salir (Esc)', 'Exit (Esc)', 'Sair (Esc)')}</button>
      <div className="mx-auto max-w-[1500px]">{children}</div>
    </div>
  )
  return (
    <div className="flex min-h-full"><Fondo quieto />
      <Paleta abierta={paleta} cerrar={() => setPaleta(false)} />
      <AnimatePresence>{escaneado && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setEscaneado(null) }}>
          <div className="relative w-full max-w-sm">
            <button aria-label="Cerrar" onClick={() => setEscaneado(null)} className="absolute -top-11 right-0 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/25">Cerrar (Esc)</button>
            <Ficha d={escaneado.d} extra={escaneado.p && <div className="rounded-2xl bg-stone-900/[.04] p-3 text-xs">
              <div className="mb-1.5 flex items-center justify-between"><b className="text-[10px] uppercase tracking-[.18em] text-stone-500">Stock</b><b className="text-sm">{stockTotal(escaneado.p)} u</b></div>
              {SUCURSALES.filter((s) => escaneado.p!.stock[s.id] !== undefined).map((s) => <div key={s.id} className="flex justify-between py-0.5 text-stone-600"><span>{s.nombre} · {s.ciudad}</span><span className="tnum font-medium text-stone-900">{escaneado.p!.stock[s.id] ?? 0} u</span></div>)}
            </div>} />
          </div>
        </motion.div>)}
      </AnimatePresence>
      <Asistente />
      <div aria-hidden className={cx('fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden', movil ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={() => setMovil(false)} />
      <aside aria-label={tx('Menú principal', 'Main menu', 'Menu principal')}
        onTouchStart={(e) => setToque(e.touches[0].clientX)} onTouchEnd={(e) => { if (toque !== null && toque - e.changedTouches[0].clientX > 70) setMovil(false); setToque(null) }}
        className={cx('glass-clear fixed z-40 flex flex-col max-lg:z-[61] transition-[width,transform] duration-300 ease-out',
          'max-lg:inset-y-0 max-lg:left-0 max-lg:h-[100dvh] max-lg:w-[min(21rem,88vw)] max-lg:!rounded-l-none max-lg:!rounded-r-[28px] max-lg:px-4 max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:pt-[max(1rem,env(safe-area-inset-top))] max-lg:shadow-[24px_0_80px_-20px_rgba(0,0,0,.7)]',
          'lg:sticky lg:inset-y-auto lg:left-auto lg:top-3 lg:ml-3 lg:h-[calc(100vh-1.5rem)] lg:shrink-0 lg:translate-x-0 lg:p-3', colapsado ? 'lg:w-[76px]' : 'lg:w-64', movil ? 'translate-x-0' : '-translate-x-[110%]')}>
        <div className={cx('flex h-11 shrink-0 items-center px-1', colapsado && 'lg:justify-center lg:px-0')}>
          <span className={cx(colapsado && 'lg:hidden')}><Logo size={34} /></span>
          {colapsado && <span className="hidden lg:block"><Logo size={36} texto={false} /></span>}
          <button aria-label={tx('Cerrar menú', 'Close menu', 'Fechar menu')} onClick={() => setMovil(false)} className="ml-auto grid h-10 w-10 place-items-center rounded-full border border-fg/10 bg-fg/5 text-muted transition hover:bg-fg/10 hover:text-fg lg:hidden"><X size={18} /></button>
        </div>
        {/* Celular: quién ingresó, arriba del menú */}
        <div className="mt-4 flex shrink-0 items-center gap-3 rounded-2xl border border-primario/20 bg-gradient-to-r from-primario/15 to-violeta/5 p-3 lg:hidden">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-sm font-bold text-black">{usuario.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div className="min-w-0 leading-tight"><div className="truncate text-sm font-semibold">{usuario.nombre}</div><div className="truncate text-[11px] text-muted">{rolesDe(usuario).join(' · ')}</div></div>
        </div>
        <div className="my-3 h-px shrink-0 bg-fg/10" />
        <nav className={cx('-mx-1 flex min-h-0 flex-1 flex-col gap-1 overscroll-contain px-1 max-lg:overflow-y-auto max-lg:[-webkit-overflow-scrolling:touch]', !colapsado && 'lg:overflow-y-auto')}>
          {visibles.filter((m) => !m.grupo).map(item)}
          {GRUPOS.map((g) => { const ms = visibles.filter((m) => m.grupo === g); return ms.length > 0 && (
            <div key={g} className="mt-2 flex flex-col gap-1">
              <div className={cx('px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[.22em] text-muted/60', colapsado && 'lg:hidden')}>{nombre(g, g)}</div>
              {colapsado && <div className="mx-4 mb-1 hidden h-px bg-fg/10 lg:block" />}
              {ms.map(item)}
            </div>) })}
          <div className="mt-2 flex flex-col gap-1 border-t border-fg/10 pt-2 lg:hidden">{visibles.filter((m) => m.grupo === 'pie').map(item)}</div>
        </nav>
        <div className="mt-3 shrink-0 space-y-1 border-t border-fg/10 pt-3">
          <div className="hidden space-y-1 lg:block">{visibles.filter((m) => m.grupo === 'pie').map(item)}</div>
          {/* En el celular y la tablet el idioma se cambia desde aquí (en la barra superior no hay espacio) */}
          <SelectorIdioma className="mx-auto w-fit lg:hidden" />
          <div className={cx('rounded-xl bg-fg/5 px-3 py-2 text-xs max-lg:hidden', colapsado && 'lg:hidden')}><div className="truncate font-semibold">{empresa.nombre || 'Mi empresa'}</div><div className="truncate text-muted">{plural(SUCURSALES.length, 'sucursal', 'sucursales')} · {plural(new Set(SUCURSALES.map((s) => s.pais)).size, 'país', 'países')}</div></div>
          <button onClick={() => setColapsado(!colapsado)} aria-label={colapsado ? tx('Expandir menú', 'Expand menu', 'Expandir menu') : tx('Contraer menú', 'Collapse menu', 'Recolher menu')} className={cx('group relative hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-muted transition hover:bg-fg/5 hover:text-fg lg:flex', colapsado && 'justify-center px-0')}>
            <ChevronsLeft size={18} className={cx('shrink-0 transition-transform duration-300', colapsado && 'rotate-180')} />{!colapsado && <span className="whitespace-nowrap">{tx('Contraer menú', 'Collapse menu', 'Recolher menu')}</span>}
            {colapsado && <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-fg/10 px-2.5 py-1.5 text-xs text-fg opacity-0 shadow-xl transition group-hover:opacity-100" style={{ background: 'var(--bg2)' }}>{tx('Expandir menú', 'Expand menu', 'Expandir menu')}</span>}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-3">
        <header className="glass-clear no-print sticky top-3 z-20 mx-3 mt-3 flex items-center gap-2 px-3 py-2 lg:ml-0">
          <button aria-label={tx('Abrir menú', 'Open menu', 'Abrir menu')} aria-expanded={movil} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fg/10 bg-fg/5 hover:bg-fg/10 lg:hidden" onClick={() => setMovil(true)}><Menu size={19} /></button>
          <button onClick={() => setPaleta(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-fg/5 px-3 py-2 text-left text-sm text-muted hover:bg-fg/10 sm:max-w-md"><Search size={15} /><span className="truncate">{tx('Buscar en NEXORA…', 'Search NEXORA…', 'Buscar no NEXORA…')}</span><kbd className="ml-auto hidden shrink-0 whitespace-nowrap rounded border border-fg/20 px-1.5 text-[10px] sm:block [@media(hover:none)]:!hidden">Ctrl K</kbd></button>
          <select aria-label="Sucursal" value={sucursal} onChange={(e) => setSucursal(e.target.value as typeof sucursal)} className="inp hidden !w-auto shrink-0 md:block"><option value="TODAS">{tx('Todas las sucursales', 'All branches', 'Todas as filiais')}</option>{SUCURSALES.map((s) => <option key={s.id} value={s.id}>{s.ciudad}</option>)}</select>
          <button title="Modo presentación" onClick={() => togglePres(true)} aria-label="Modo presentación" className="hidden shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-fg/10 sm:flex"><Maximize2 size={15} /><span className="hidden 2xl:inline">{tx('Presentación', 'Presentation', 'Apresentação')}</span></button>
          <SelectorIdioma className="hidden shrink-0 lg:flex" />
          <SelectorTema />
          <button aria-label="Cambiar tema" onClick={() => setTema(tema === 'oscuro' ? 'claro' : 'oscuro')} className="rounded-xl p-2 hover:bg-fg/10">{tema === 'oscuro' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <div className="relative">
            <button aria-label="Notificaciones" onClick={() => setNotif(!notif)} className="relative rounded-xl p-2 hover:bg-fg/10"><Bell size={17} />{urgentes > 0 && <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-peligro" />}</button>
            {notif && <div className="glass absolute right-0 top-11 z-50 w-80 p-2 max-sm:fixed max-sm:inset-x-3 max-sm:top-20 max-sm:w-auto" style={{ background: 'color-mix(in srgb, var(--bg2) 98%, transparent)' }}>{alertas.length ? <div className="max-h-[60vh] overflow-y-auto">{alertas.map((a, k) => <button type="button" key={k} onClick={() => { if (a.ir) { ir(a.ir); setNotif(false) } }} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-fg/5"><span className={cx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', a.t === 'rojo' ? 'bg-peligro' : a.t === 'verde' ? 'bg-exito' : a.t === 'info' ? 'bg-cian' : 'bg-alerta')} />{a.m}</button>)}</div> : <div className="p-2 text-xs text-muted">{tx('Sin alertas', 'No alerts', 'Sem alertas')}</div>}</div>}
          </div>
          <IconoNube />
          <div className="flex items-center gap-2 border-l border-fg/10 pl-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-xs font-bold text-black">{usuario.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            <div className="hidden leading-tight xl:block"><div className="text-xs font-semibold">{usuario.nombre}</div><div className="max-w-[16rem] truncate text-[10px] text-muted">{rolesDe(usuario).join(' · ')}</div></div>
            <button aria-label="Cerrar sesión" onClick={() => { salir() }} className="rounded-lg p-2 text-muted hover:bg-fg/10 hover:text-peligro"><LogOut size={16} /></button>
          </div>
        </header>
        <AvisoVersion />
        {licencia && (licencia.plan === 'Prueba' || (diasRestantes(licencia.vence) ?? 99) <= 5) && <AvisoPlan plan={licencia.plan} vence={licencia.vence} titular={!!licencia.esDueno} />}
        <main className="mx-3 mt-5 mb-24 min-w-0 lg:mb-10 lg:ml-0"><motion.div key={pagina} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{children}</motion.div></main>
      </div>
    </div>
  )
}

/** Estado de los datos en la nube (solo cuando se ingresó con una cuenta NEXORA). */
function IconoNube() {
  const tx = useTx()
  const e = useEstadoNube()
  if (e === 'apagada') return null
  const texto = { conectando: tx('Conectando con la nube…', 'Connecting to the cloud…', 'Conectando à nuvem…'), 'al-dia': tx('Datos guardados en la nube', 'Data saved in the cloud', 'Dados salvos na nuvem'), guardando: tx('Guardando en la nube…', 'Saving to the cloud…', 'Salvando na nuvem…'), 'sin-conexion': tx('Sin conexión: se guardará al volver internet', 'Offline: will save when back online', 'Sem conexão: será salvo quando voltar') }[e]
  return <span title={texto} aria-label={texto} role="status" className={cx('shrink-0 rounded-xl p-1.5 sm:p-2', e === 'sin-conexion' ? 'text-peligro' : e === 'al-dia' ? 'text-exito' : 'animate-pulse text-muted')}>{e === 'sin-conexion' ? <CloudOff size={17} /> : <Cloud size={17} />}</span>
}

/** Franja con los días que quedan de la prueba gratis o de un plan por vencer. */
function AvisoPlan({ plan, vence, titular }: { plan: string; vence: string | null; titular: boolean }) {
  const tx = useTx()
  const d = diasRestantes(vence) ?? 0
  const prueba = plan === 'Prueba'
  const quedan = d === 1 ? tx('queda 1 día', '1 day left', 'resta 1 dia') : tx(`quedan ${d} días`, `${d} days left`, `restam ${d} dias`)
  return (
    <div className="no-print mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primario/30 bg-primario/10 px-3 py-2 text-xs lg:ml-0">
      <Gift size={15} className="shrink-0 text-primario" />
      <span className="flex-1">{prueba ? tx('Prueba gratis:', 'Free trial:', 'Teste grátis:') : tx(`Su plan ${plan} vence pronto:`, `Your ${plan} plan ends soon:`, `Seu plano ${plan} vence em breve:`)} {quedan}. {tx('Sus datos se conservan.', 'Your data is kept.', 'Seus dados são mantidos.')}</span>
      {titular && <a href={prueba ? '#/planes' : `#/comprar?plan=${encodeURIComponent(plan)}&periodo=mensual`} className="rounded-lg bg-primario px-3 py-1 font-semibold text-black hover:brightness-110">{prueba ? tx('Elegir plan', 'Choose plan', 'Escolher plano') : tx('Renovar', 'Renew', 'Renovar')}</a>}
    </div>
  )
}

/** Se publicó una versión nueva: se guarda lo pendiente y se recarga. */
function AvisoVersion() {
  const tx = useTx()
  const nueva = useVersionNueva()
  const [ocupado, setOcupado] = useState(false)
  if (!nueva) return null
  const actualizar = async () => { setOcupado(true); try { await guardarYa() } finally { location.reload() } }
  return (
    <div className="no-print mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-cian/40 bg-cian/10 px-3 py-2 text-xs lg:ml-0" role="status">
      <RefreshCw size={15} className="shrink-0 text-cian" />
      <span className="flex-1">{tx('Hay una versión nueva de NEXORA. Actualice para trabajar con lo último (sus datos se conservan).', 'A new version of NEXORA is available. Update to get the latest (your data is kept).', 'Há uma nova versão do NEXORA. Atualize para usar a mais recente (seus dados são mantidos).')}</span>
      <button onClick={actualizar} disabled={ocupado} className="rounded-lg bg-cian px-3 py-1 font-semibold text-black hover:brightness-110 disabled:opacity-60">{ocupado ? tx('Actualizando…', 'Updating…', 'Atualizando…') : tx('Actualizar', 'Update', 'Atualizar')}</button>
    </div>
  )
}

