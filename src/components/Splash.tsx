import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { MousePointerClick } from 'lucide-react'
import { Horizonte } from './Horizonte'
import { EstelaCodigo } from './EstelaCodigo'
import { SelectorIdioma } from './SelectorIdioma'
import { nombrePais, paisDetectado, useIdioma, useTx } from '../lib/idioma'

const suave = [0.16, 1, 0.3, 1] as const

/**
 * Intro cinematográfica negro y oro: amanece el horizonte, se dibuja la N, aparece NEXORA y espera el clic.
 * No entra sola: continúa con un clic o una tecla. Letras de código doradas siguen al mouse.
 */
export function Splash({ onFin }: { onFin: () => void }) {
  const tx = useTx()
  const { idioma, automatico } = useIdioma()
  const pais = paisDetectado()
  const [listo, setListo] = useState(false)
  // Inclinación 3D suave del logo según la posición del mouse
  const mx = useMotionValue(0), my = useMotionValue(0)
  const rotY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 90, damping: 18 })
  const rotX = useSpring(useTransform(my, [-1, 1], [10, -10]), { stiffness: 90, damping: 18 })

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 2700)
    const tecla = (e: KeyboardEvent) => { if (e.key !== 'Tab' && e.key !== 'Shift') onFin() }
    window.addEventListener('keydown', tecla)
    return () => { clearTimeout(t); window.removeEventListener('keydown', tecla) }
  }, [onFin])

  return (
    <motion.div onClick={onFin} onPointerMove={(e) => { mx.set((e.clientX / window.innerWidth) * 2 - 1); my.set((e.clientY / window.innerHeight) * 2 - 1) }}
      className="fixed inset-0 z-[100] cursor-pointer overflow-hidden bg-black" exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }} transition={{ duration: 0.6 }}>
      {/* haces de luz */}
      <motion.div className="haz absolute -left-40 -top-40 h-[150%] w-[30rem] rotate-[24deg]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1.5 }} />
      <motion.div className="haz absolute -top-40 right-[12%] h-[150%] w-[10rem] -rotate-[18deg] opacity-60" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.6, duration: 1.5 }} />
      {/* horizonte que amanece */}
      <motion.div className="absolute inset-x-0 bottom-0 h-[46vh]" initial={{ y: '60%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.8, ease: suave }}>
        <Horizonte tamano={1700} className="top-[18%]" />
      </motion.div>
      {/* letras de código: suben del horizonte y siguen al mouse */}
      <EstelaCodigo ambiente />

      {/* idioma detectado */}
      <motion.div className="absolute right-4 top-4 z-10 flex flex-wrap items-center justify-end gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.8 }}>
        {pais && automatico && <span className="rounded-full border border-amber-100/10 bg-black/40 px-3 py-1 text-[10px] tracking-wide text-amber-100/60 backdrop-blur">{tx('Detectado', 'Detected', 'Detectado')}: {nombrePais(pais, idioma)}</span>}
        <SelectorIdioma className="!border-amber-100/15 !bg-black/40" />
      </motion.div>

      <div className="relative flex h-full flex-col items-center justify-center pb-[18vh] [perspective:900px]">
        <motion.div style={{ rotateX: rotX, rotateY: rotY }} className="flex flex-col items-center [transform-style:preserve-3d]">
          <motion.svg width="112" height="112" viewBox="0 0 64 64" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, duration: 0.9, ease: suave }} style={{ filter: 'drop-shadow(0 0 26px rgb(var(--t-oro)/.65))', translateZ: 40 }}>
            <defs><linearGradient id="sp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="rgb(var(--t-palido))" /><stop offset=".5" stopColor="rgb(var(--t-oro))" /><stop offset="1" stopColor="rgb(var(--t-oscuro))" /></linearGradient></defs>
            <motion.rect x="2" y="2" width="60" height="60" rx="16" fill="none" stroke="url(#sp)" strokeWidth="1" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.55 }} transition={{ delay: 0.6, duration: 1.4, ease: 'easeInOut' }} />
            <motion.path d="M16 48V16l16 20" stroke="url(#sp)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.9, ease: 'easeInOut' }} />
            <motion.path d="M32 28l16 20V16" stroke="rgb(var(--t-claro))" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.25, duration: 0.9, ease: 'easeInOut' }} />
          </motion.svg>
          <div className="relative mt-8 overflow-hidden px-2">
            <div className="flex gap-[0.3em] font-display text-5xl font-bold tracking-[.22em] sm:text-7xl">
              {'NEXORA'.split('').map((l, k) => <motion.span key={k} className="texto-oro" initial={{ opacity: 0, y: 28, filter: 'blur(14px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 1.7 + k * 0.09, duration: 0.7, ease: suave }}>{l}</motion.span>)}
            </div>
            {/* brillo que recorre el nombre */}
            <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent mix-blend-overlay" initial={{ left: '-40%' }} animate={{ left: ['-40%', '120%'] }} transition={{ delay: 2.6, duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.8 }} />
          </div>
          <motion.p className="mt-4 text-[11px] uppercase text-amber-100/70" initial={{ opacity: 0, letterSpacing: '1.1em' }} animate={{ opacity: 1, letterSpacing: '.55em' }} transition={{ delay: 2.4, duration: 0.9 }}>Intelligent Operations Suite</motion.p>
        </motion.div>

        {/* invitación a continuar: solo entra con clic o tecla */}
        <motion.div className="absolute bottom-10 flex flex-col items-center gap-3" initial={{ opacity: 0, y: 12 }} animate={listo ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, ease: suave }}>
          <span className="relative grid h-11 w-11 place-items-center rounded-full border border-amber-100/30 text-amber-100">
            <motion.span className="absolute inset-0 rounded-full border border-primario/60" animate={{ scale: [1, 1.7], opacity: [0.8, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
            <MousePointerClick size={18} />
          </span>
          <motion.p className="text-[11px] font-medium uppercase tracking-[.4em] text-amber-100/80" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 2.2, repeat: Infinity }}>{tx('Haga clic para continuar', 'Click to continue', 'Clique para continuar')}</motion.p>
          <p className="text-[10px] tracking-[.3em] text-amber-100/35">{tx('EDICIÓN 2026 · O PRESIONE CUALQUIER TECLA', '2026 EDITION · OR PRESS ANY KEY', 'EDIÇÃO 2026 · OU PRESSIONE QUALQUER TECLA')}</p>
        </motion.div>
      </div>
    </motion.div>
  )
}
