import { useEffect, useState } from 'react'
import { MonitorDown, Smartphone } from 'lucide-react'
import { useTx } from '../lib/idioma'
import { cx } from './ui'
import { equipoActual } from '../lib/equipo'

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let guardado: EventoInstalar | null = null
const avisos = new Set<() => void>()
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); guardado = e as EventoInstalar; avisos.forEach((f) => f()) })
const yaInstalada = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/**
 * Botón "Instalar app": NEXORA queda como aplicación (ícono propio, sin barra del navegador y funciona sin internet).
 * Android y Chrome/Edge instalan con un clic; en iPhone, iPad, Samsung Internet y Safari explica los pasos.
 */
export function InstalarApp({ className }: { className?: string }) {
  const tx = useTx()
  const [, refrescar] = useState(0)
  const [ayuda, setAyuda] = useState(false)
  useEffect(() => { const f = () => refrescar((n) => n + 1); avisos.add(f); return () => { avisos.delete(f) } }, [])
  if (yaInstalada()) return null
  const tipo = equipoActual(), movil = tipo !== 'computadora'
  const instalar = async () => {
    if (!guardado) return setAyuda(!ayuda)
    await guardado.prompt(); await guardado.userChoice; guardado = null; refrescar((n) => n + 1)
  }
  return (
    <div className={cx('relative', className)}>
      <button onClick={instalar} className="flex items-center gap-1.5 rounded-full border border-primario/40 bg-primario/10 px-3 py-1.5 text-xs font-semibold text-primario transition hover:bg-primario/20">{movil ? <Smartphone size={14} /> : <MonitorDown size={14} />}{tx('Instalar app', 'Install app', 'Instalar app')}</button>
      {ayuda && <div className="glass absolute right-0 top-10 z-50 w-[min(18rem,calc(100vw-2rem))] p-3 text-xs" style={{ background: 'color-mix(in srgb, var(--bg2) 94%, transparent)' }}>
        <p className="mb-1 font-semibold">{movil ? tx('Instalar NEXORA en su celular', 'Install NEXORA on your phone', 'Instalar o NEXORA no seu celular') : tx('Instalar NEXORA en su computadora', 'Install NEXORA on your computer', 'Instalar o NEXORA no seu computador')}</p>
        <p className="text-muted">{{
          ios: tx('iPhone o iPad: toque Compartir (el cuadrado con la flecha hacia arriba) y elija «Agregar a pantalla de inicio». NEXORA queda con su ícono, como cualquier app.', 'iPhone or iPad: tap Share (the square with the up arrow) and choose "Add to Home Screen". NEXORA gets its own icon, like any app.', 'iPhone ou iPad: toque em Compartilhar (o quadrado com a seta para cima) e escolha «Adicionar à Tela de Início».'),
          samsung: tx('Samsung Internet: abra el menú ≡ (abajo) → «Agregar página a» → «Pantalla de inicio».', 'Samsung Internet: open the ≡ menu (bottom) → "Add page to" → "Home screen".', 'Samsung Internet: abra o menu ≡ → «Adicionar página a» → «Tela inicial».'),
          android: tx('Android: abra el menú ⋮ del navegador y elija «Instalar aplicación» o «Agregar a la pantalla principal».', 'Android: open the browser ⋮ menu and choose "Install app" or "Add to Home screen".', 'Android: abra o menu ⋮ do navegador e escolha «Instalar app» ou «Adicionar à tela inicial».'),
          computadora: tx('Chrome o Edge: ícono de instalar ⊕ al final de la barra de direcciones. Safari (Mac): menú Archivo → «Agregar al Dock». Se abre en su propia ventana, como cualquier programa.', 'Chrome or Edge: the install ⊕ icon at the end of the address bar. Safari (Mac): File → "Add to Dock". It opens in its own window, like any program.', 'Chrome ou Edge: ícone de instalar ⊕ no fim da barra de endereços. Safari (Mac): Arquivo → «Adicionar ao Dock». Abre em sua própria janela, como qualquer programa.'),
        }[tipo]}</p>
      </div>}
    </div>
  )
}
