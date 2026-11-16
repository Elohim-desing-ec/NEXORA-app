import { Globe2 } from 'lucide-react'
import { IDIOMAS, useIdioma } from '../lib/idioma'
import { cx } from './ui'

/** Selector compacto ES · EN · PT. Detiene el clic para no activar lo que haya detrás (por ejemplo, la intro). */
export function SelectorIdioma({ className }: { className?: string }) {
  const { idioma, setIdioma } = useIdioma()
  return (
    <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} className={cx('flex items-center gap-0.5 rounded-full border border-fg/10 bg-fg/5 p-0.5 text-[11px] font-semibold backdrop-blur', className)} role="group" aria-label="Idioma / Language">
      <Globe2 size={13} className="mx-1 text-muted" />
      {IDIOMAS.map((l) => (
        <button key={l.id} type="button" title={l.nombre} onClick={() => setIdioma(l.id)} className={cx('rounded-full px-2 py-0.5 transition', idioma === l.id ? 'bg-gradient-to-r from-primario to-violeta text-black' : 'text-muted hover:text-fg')}>{l.corto}</button>
      ))}
    </div>
  )
}
