/** Colores de prendas: muestras (círculos de color), chips para elegir varios y la lista de la empresa (se pueden agregar más). */
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useApp } from '../store/useApp'
import { COLORES, colorHex } from '../lib/inventario'
import { cx } from './ui'

/** Círculo con el color (si se conoce el nombre; si no, un círculo con borde). */
export function Muestra({ color, size = 14 }: { color?: string; size?: number }) {
  const hex = color ? colorHex(color) : null
  return <span aria-hidden className="inline-block shrink-0 rounded-full ring-1 ring-fg/25" style={{ width: size, height: size, background: hex ?? 'transparent' }} />
}

/** Colores que maneja la empresa (los de sus proveedores). */
export const useColores = () => useApp((s) => s.empresa.colores ?? COLORES)

/** Chips para elegir uno o varios colores, con «+ Color» para agregar a la lista de la empresa y «Editar» para quitar. */
export function ElegirColores({ elegidos, onChange, extra = [] }: { elegidos: string[]; onChange: (c: string[]) => void; extra?: string[] }) {
  const colores = useColores()
  const guardarColores = useApp((s) => s.guardarColores)
  const [nuevo, setNuevo] = useState(''), [editando, setEditando] = useState(false)
  const lista = [...new Set([...colores, ...extra, ...elegidos])]
  const agregar = () => {
    const c = nuevo.trim().replace(/\s+/g, ' ')
    if (!c) return
    const nombre = c.charAt(0).toUpperCase() + c.slice(1)
    const existe = lista.find((x) => x.toLowerCase() === nombre.toLowerCase())
    if (!existe) guardarColores([...colores, nombre])
    const final = existe ?? nombre
    if (!elegidos.includes(final)) onChange([...elegidos, final])
    setNuevo('')
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {lista.map((c) => {
          const si = elegidos.includes(c)
          return (
            <span key={c} className="relative">
              <button type="button" onClick={() => onChange(si ? elegidos.filter((x) => x !== c) : [...elegidos, c])} aria-pressed={si}
                className={cx('flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-xs font-medium transition', si ? 'border-primario/60 bg-primario/15 text-primario' : 'border-fg/10 text-muted hover:bg-fg/5')}>
                <Muestra color={c} />{c}
              </button>
              {editando && colores.includes(c) && <button type="button" aria-label={`Quitar ${c} de la lista`} onClick={() => { guardarColores(colores.filter((x) => x !== c)); onChange(elegidos.filter((x) => x !== c)) }}
                className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-peligro text-white"><X size={10} /></button>}
            </span>
          )
        })}
        <span className="flex items-center gap-1">
          <input className="inp !w-32 !py-1 text-xs" placeholder="Otro color" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }} />
          <button type="button" onClick={agregar} disabled={!nuevo.trim()} aria-label="Agregar color" className="grid h-7 w-7 place-items-center rounded-full bg-fg/10 hover:bg-fg/15 disabled:opacity-40"><Plus size={14} /></button>
        </span>
      </div>
      <button type="button" onClick={() => setEditando(!editando)} className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-primario hover:underline">{editando ? 'Listo' : 'Editar lista de colores'}</button>
    </div>
  )
}
