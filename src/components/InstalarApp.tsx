import { useEffect, useState } from 'react'
import { MonitorDown } from 'lucide-react'
import { useTx } from '../lib/idioma'
import { cx } from './ui'

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let guardado: EventoInstalar | null = null
const avisos = new Set<() => void>()
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); guardado = e as EventoInstalar; avisos.forEach((f) => f()) })
const yaInstalada = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/**
 * Botón "Instalar app": NEXORA queda como aplicación en la computadora (ícono propio, ventana propia, sin barra del
 * navegador y funciona sin internet). En Chrome y Edge instala con un clic; en Safari explica "Agregar al Dock".
 */
export function InstalarApp({ className }: { className?: string }) {
  const tx = useTx()
  const [, refrescar] = useState(0)
  const [ayuda, setAyuda] = useState(false)
  useEffect(() => { const f = () => refrescar((n) => n + 1); avisos.add(f); return () => { avisos.delete(f) } }, [])
  if (yaInstalada()) return null
  const instalar = async () => {
    if (!guardado) return setAyuda(!ayuda)
    await guardado.prompt(); await guardado.userChoice; guardado = null; refrescar((n) => n + 1)
  }
  return (
    <div className={cx('relative', className)}>
      <button onClick={instalar} className="flex items-center gap-1.5 rounded-full border border-primario/40 bg-primario/10 px-3 py-1.5 text-xs font-semibold text-primario transition hover:bg-primario/20"><MonitorDown size={14} />{tx('Instalar app', 'Install app', 'Instalar app')}</button>
      {ayuda && <div className="glass absolute right-0 top-10 z-50 w-72 p-3 text-xs" style={{ background: 'color-mix(in srgb, var(--bg2) 94%, transparent)' }}>
        <p className="mb-1 font-semibold">{tx('Instalar NEXORA en su computadora', 'Install NEXORA on your computer', 'Instalar o NEXORA no seu computador')}</p>
        <p className="text-muted">{tx('Chrome o Edge: ícono de instalar ⊕ al final de la barra de direcciones. Safari (Mac): menú Archivo → «Agregar al Dock». Se abre en su propia ventana, como cualquier programa.', 'Chrome or Edge: the install ⊕ icon at the end of the address bar. Safari (Mac): File → "Add to Dock". It opens in its own window, like any program.', 'Chrome ou Edge: ícone de instalar ⊕ no fim da barra de endereços. Safari (Mac): Arquivo → «Adicionar ao Dock». Abre em sua própria janela, como qualquer programa.')}</p>
      </div>}
    </div>
  )
}
