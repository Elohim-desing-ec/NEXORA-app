/**
 * Animación al eliminar: una tarjeta con un basurero que se abre para preguntar, el papel cae dentro al confirmar,
 * y después un aviso «Eliminado» con «Deshacer» (lo devuelve desde la Papelera).
 * Uso: pedirEliminar({ titulo, detalle, accion }) en lugar de confirm(). accion devuelve un texto si no se pudo.
 */
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { create } from 'zustand'
import { RotateCcw, X } from 'lucide-react'
import { useApp } from '../store/useApp'

type Resultado = string | null | void
export interface PedidoEliminar {
  titulo: string
  detalle?: string
  /** Texto del botón (por defecto «Eliminar») */
  boton?: string
  /** Texto del aviso al terminar (por defecto «Eliminado») */
  listo?: string
  accion: () => Resultado | Promise<Resultado>
}
interface Estado {
  pedido: PedidoEliminar | null
  fase: 'pregunta' | 'eliminando'
  error: string
  aviso: { texto: string; deshacer: string[]; id: number } | null
}
const useEliminacion = create<Estado>(() => ({ pedido: null, fase: 'pregunta', error: '', aviso: null }))

/** Pide confirmación con animación y, si se confirma, ejecuta la acción. */
export function pedirEliminar(p: PedidoEliminar) { useEliminacion.setState({ pedido: p, fase: 'pregunta', error: '' }) }

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Basurero animado: la tapa se abre al preguntar y se cierra cuando el papel cae dentro. */
function Basurero({ cayendo, quieto }: { cayendo: boolean; quieto: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width="76" height="76" className="text-peligro" aria-hidden>
      <motion.circle cx="32" cy="34" r="29" className="fill-peligro/10" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: quieto ? 0 : 0.35 }} />
      <AnimatePresence>{cayendo && (
        <motion.g key="papel" initial={{ y: -26, rotate: -18, opacity: 1 }} animate={{ y: 16, rotate: 14, opacity: 0 }} transition={{ duration: quieto ? 0 : 0.5, ease: 'easeIn' }}>
          <rect x="25" y="14" width="14" height="17" rx="2" className="fill-current opacity-70" />
          <path d="M28 19h8M28 23h8M28 27h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        </motion.g>
      )}</AnimatePresence>
      <path d="M20 25h24l-2.2 25.5a3.5 3.5 0 0 1-3.5 3.2H25.7a3.5 3.5 0 0 1-3.5-3.2z" className="fill-current" />
      <path d="M27.5 30v18M32 30v18M36.5 30v18" stroke="white" strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />
      <motion.g style={{ originX: 1, originY: 1 }} initial={{ rotate: 0 }} animate={{ rotate: cayendo ? 0 : -32, y: cayendo ? 0 : -3 }}
        transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 14, delay: cayendo ? 0.38 : 0.15 }}>
        <rect x="17" y="19" width="30" height="4.5" rx="2.2" className="fill-current" />
        <rect x="27" y="15" width="10" height="5" rx="2" className="fill-current" />
      </motion.g>
    </svg>
  )
}

export function Eliminacion() {
  const { pedido, fase, error, aviso } = useEliminacion()
  const recuperar = useApp((s) => s.recuperar)
  const quieto = !!useReducedMotion()
  const tarjeta = useAnimationControls()
  const reloj = useRef<ReturnType<typeof setTimeout>>()

  const cerrar = () => { if (fase !== 'eliminando') useEliminacion.setState({ pedido: null, error: '' }) }
  useEffect(() => {
    if (!pedido) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  // El aviso «Eliminado» se va solo a los 7 s
  useEffect(() => {
    clearTimeout(reloj.current)
    if (aviso) reloj.current = setTimeout(() => useEliminacion.setState({ aviso: null }), 7000)
    return () => clearTimeout(reloj.current)
  }, [aviso])

  const confirmar = async () => {
    if (!pedido || fase === 'eliminando') return
    const antes = new Set(useApp.getState().papelera.map((e) => e.id))
    useEliminacion.setState({ fase: 'eliminando', error: '' })
    let r: Resultado
    try { r = await pedido.accion() } catch (e) { r = e instanceof Error ? e.message : 'No se pudo eliminar' }
    if (typeof r === 'string' && r) { // no se pudo: la tarjeta tiembla y muestra el motivo
      useEliminacion.setState({ fase: 'pregunta', error: r })
      if (!quieto) tarjeta.start({ x: [0, -12, 12, -8, 8, -3, 0], transition: { duration: 0.45 } })
      return
    }
    await espera(quieto ? 0 : 800) // el papel cae y la tapa se cierra
    const deshacer = useApp.getState().papelera.filter((e) => !antes.has(e.id)).map((e) => e.id)
    useEliminacion.setState({ pedido: null, fase: 'pregunta', aviso: { texto: pedido.listo ?? 'Eliminado', deshacer, id: Date.now() } })
  }
  const deshacer = () => {
    if (!aviso) return
    const fallos = aviso.deshacer.map((id) => recuperar(id)).filter(Boolean)
    useEliminacion.setState({ aviso: { texto: fallos.length ? String(fallos[0]) : 'Recuperado', deshacer: [], id: Date.now() } })
  }

  return (
    <>
      <AnimatePresence>
        {pedido && (
          <motion.div key="fondo" className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}>
            <motion.div animate={tarjeta}>
              <motion.div role="alertdialog" aria-modal="true" aria-labelledby="eliminar-titulo" className="glass w-full max-w-sm p-6 text-center" style={{ background: 'color-mix(in srgb, var(--bg2) 94%, transparent)' }}
                initial={{ opacity: 0, scale: 0.85, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: fase === 'eliminando' ? 0.7 : 0.92, y: fase === 'eliminando' ? 30 : 10, transition: { duration: 0.25 } }}
                transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 24 }}>
                <div className="flex justify-center"><Basurero cayendo={fase === 'eliminando'} quieto={quieto} /></div>
                <h2 id="eliminar-titulo" className="mt-2 font-display text-lg font-bold">{pedido.titulo}</h2>
                {pedido.detalle && <p className="mt-1.5 text-sm text-muted">{pedido.detalle}</p>}
                <AnimatePresence>{error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 rounded-lg bg-peligro/10 px-3 py-2 text-left text-xs text-peligro">{error}</motion.p>}</AnimatePresence>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button autoFocus onClick={cerrar} disabled={fase === 'eliminando'} className="rounded-xl bg-fg/10 px-4 py-2.5 text-sm font-medium hover:bg-fg/15 disabled:opacity-50">Cancelar</button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={confirmar} disabled={fase === 'eliminando'} className="rounded-xl bg-peligro px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-80">
                    {fase === 'eliminando' ? 'Eliminando…' : pedido.boton ?? 'Eliminar'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aviso && (
          <motion.div key={aviso.id} role="status" className="fixed inset-x-3 bottom-4 z-[60] mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-2xl border border-fg/10 px-4 py-3 text-sm shadow-2xl sm:bottom-6"
            style={{ background: 'color-mix(in srgb, var(--bg2) 96%, transparent)' }}
            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, transition: { duration: 0.2 } }}
            transition={quieto ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}>
            <span className="flex-1"><b>{aviso.texto}</b>{aviso.deshacer.length > 0 && <span className="text-muted"> · está en la Papelera</span>}</span>
            {aviso.deshacer.length > 0 && <button onClick={deshacer} className="flex shrink-0 items-center gap-1 rounded-lg bg-primario px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"><RotateCcw size={13} />Deshacer</button>}
            <button aria-label="Cerrar aviso" onClick={() => useEliminacion.setState({ aviso: null })} className="shrink-0 rounded-lg p-1 text-muted hover:bg-fg/10"><X size={15} /></button>
            {!quieto && <motion.span className="absolute bottom-0 left-0 h-0.5 bg-primario/70" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 7, ease: 'linear' }} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
