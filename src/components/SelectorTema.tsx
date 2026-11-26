import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Palette } from 'lucide-react'
import { useApp } from '../store/useApp'
import { TEMAS, TEMA_INICIAL, type TemaColor } from '../lib/temas'
import { useTx } from '../lib/idioma'
import { cx } from './ui'

/** Vista previa en miniatura de un tema: usa sus propias variables gracias a data-tema. */
export function MuestraTema({ id, grande }: { id: TemaColor; grande?: boolean }) {
  return (
    <div data-tema={id} className={cx('overflow-hidden rounded-xl border border-fg/10', grande ? 'h-40' : 'h-16')} style={{ background: 'linear-gradient(160deg, var(--bg1), var(--bg2))' }}>
      <div className="flex h-full">
        <div className={cx('space-y-1.5 border-r border-fg/10', grande ? 'w-1/4 p-2.5' : 'w-1/4 p-1.5')}>
          <div className={cx('rounded-md bg-gradient-to-br from-amber-200 via-primario to-violeta', grande ? 'h-5 w-5' : 'h-2.5 w-2.5')} />
          {[0, 1, 2, 3].map((k) => <div key={k} className={cx('rounded', grande ? 'h-2.5' : 'h-1', k === 0 ? 'bg-primario/70' : 'bg-fg/15')} />)}
        </div>
        <div className={cx('flex flex-1 flex-col justify-between', grande ? 'p-3' : 'p-1.5')}>
          {grande && <div className="text-[10px] text-muted">Ventas del mes</div>}
          <div className={cx('texto-oro font-display font-bold leading-none', grande ? 'text-2xl' : 'text-[11px]')}>$ 6.169</div>
          <div className={cx('flex items-end gap-1', grande ? 'h-12' : 'h-4')}>{[40, 65, 50, 85, 70, 100].map((h, k) => <div key={k} className="flex-1 rounded-sm bg-gradient-to-t from-violeta to-amber-200" style={{ height: `${h}%` }} />)}</div>
          {grande && <span className="w-fit rounded-full bg-gradient-to-r from-amber-200 via-primario to-violeta px-2.5 py-0.5 text-[10px] font-semibold text-black">Botón</span>}
        </div>
      </div>
    </div>
  )
}

/** Botón de la barra superior: cada usuario elige su tema de color. */
export function SelectorTema() {
  const tx = useTx()
  const { usuario, temasColor, setTemaColor } = useApp()
  const actual = (usuario && temasColor?.[usuario.id]) || TEMA_INICIAL
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f) }, [])
  return (
    <div ref={ref} className="relative">
      <button aria-label={tx('Tema de color', 'Color theme', 'Tema de cor')} title={tx('Tema de color', 'Color theme', 'Tema de cor')} onClick={() => setAbierto(!abierto)} className="rounded-xl p-2 hover:bg-fg/10"><Palette size={17} /></button>
      <AnimatePresence>{abierto && (
        <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} className="glass absolute right-0 top-11 z-50 w-72 p-3" style={{ background: 'color-mix(in srgb, var(--bg2) 92%, transparent)' }}>
          <div className="mb-2 text-xs font-semibold">{tx('Su tema de color', 'Your color theme', 'Seu tema de cor')}</div>
          <div className="grid grid-cols-2 gap-2">{TEMAS.map((t) => (
            <button key={t.id} onClick={() => setTemaColor(t.id)} className={cx('rounded-xl p-1.5 text-left transition hover:bg-fg/5', actual === t.id && 'ring-1 ring-primario')}>
              <MuestraTema id={t.id} />
              <div className="mt-1 flex items-center justify-between text-[11px] font-medium">{tx(t.nombre, t.en, t.pt)}{actual === t.id && <Check size={12} className="text-primario" />}</div>
            </button>))}</div>
          <p className="mt-2 text-[10px] text-muted">{tx('Se guarda para su usuario.', 'Saved for your user.', 'Salvo para o seu usuário.')}</p>
        </motion.div>)}</AnimatePresence>
    </div>
  )
}
