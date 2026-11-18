/**
 * Ficha elegante de un producto: la que se ve al escanear el QR de la etiqueta (con la cámara del celular, sin iniciar
 * sesión) o el código de barras con una pistola lectora dentro de NEXORA.
 * Los datos van dentro del enlace del QR (no se consulta la nube): nombre, color, talla, cuello, precio, lote y vencimiento.
 */
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import JsBarcode from 'jsbarcode'
import { CalendarClock, Layers, Ruler, Shirt, Tag } from 'lucide-react'
import type { Producto } from '../data/base'
import { colorHex } from '../lib/inventario'
import { Logo } from './Logo'

export interface DatosFicha { n: string; s: string; c?: string; t?: string; co?: string; ta?: string; cu?: string; p: number; m?: string; l?: string; v?: string; e?: string }

export const datosFicha = (p: Producto, empresa: string, simbolo: string): DatosFicha => ({
  n: p.nombre, s: p.sku, c: p.categoria || undefined, t: p.tipo, co: p.color, ta: p.talla, cu: p.cuello, p: p.precio, m: simbolo, l: p.lote || undefined, v: p.vence || undefined, e: empresa || undefined,
})
const aBase64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))
/** Enlace que va en el QR de la etiqueta. */
export const codificarFicha = (d: DatosFicha) => aBase64(JSON.stringify(d))
export const urlFicha = (d: DatosFicha) => `${location.origin}${location.pathname}#/ficha?d=${codificarFicha(d)}`
/** Lee la ficha de un enlace (o de lo que escribió la pistola lectora). null si no es una ficha de NEXORA. */
export function leerFicha(texto: string): DatosFicha | null {
  const m = texto.match(/#\/ficha\?d=([A-Za-z0-9_-]+)/)
  if (!m) return null
  try { const d = JSON.parse(deBase64(m[1])) as DatosFicha; return d && typeof d.n === 'string' && typeof d.s === 'string' ? d : null } catch { return null }
}

const precio = (v: number, m = '$') => `${m} ${new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}`
const fechaCorta = (iso: string) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00`); return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) }

function Barras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => { if (ref.current) try { JsBarcode(ref.current, valor || '0000', { format: 'CODE128', height: 46, fontSize: 13, margin: 0, background: 'transparent', lineColor: '#1c1917' }) } catch { /* código no válido */ } }, [valor])
  return <svg ref={ref} className="max-w-full" />
}

/** Tarjeta de la ficha. `extra`: lo que solo ve el equipo (p. ej. el stock por sucursal). */
export function Ficha({ d, extra }: { d: DatosFicha; extra?: React.ReactNode }) {
  const quieto = !!useReducedMotion()
  const hex = d.co ? colorHex(d.co) : null
  const chips = [
    d.co && { icono: <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: hex ?? 'transparent' }} />, texto: d.co },
    d.ta && { icono: <Ruler size={13} />, texto: `Talla ${d.ta}` },
    d.cu && { icono: <Shirt size={13} />, texto: d.cu === 'Sin cuello' ? d.cu : `Cuello ${d.cu.charAt(0).toLowerCase()}${d.cu.slice(1)}` },
    (d.t || d.c) && { icono: <Layers size={13} />, texto: d.t ?? d.c },
  ].filter(Boolean) as { icono: React.ReactNode; texto: string }[]
  const entra = (i: number) => (quieto ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.12 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] } })
  const vence = d.v ? (new Date(`${d.v.slice(0, 10)}T12:00:00`).getTime() - Date.now()) / 864e5 : null
  return (
    <motion.article initial={quieto ? false : { opacity: 0, scale: 0.94, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[#fbf8f1] text-stone-900 shadow-2xl ring-1 ring-black/5">
      {/* Franja de color de la prenda (o dorada) */}
      <div className="relative h-28 overflow-hidden" style={{ background: hex ? `linear-gradient(135deg, ${hex}, ${hex}cc 55%, #d4af37)` : 'linear-gradient(135deg, #1c1917, #57534e 60%, #d4af37)' }}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,.35),transparent_55%)]" />
        <motion.div {...entra(0)} className="absolute left-5 top-4 flex items-center gap-1.5 rounded-full bg-white/85 py-1 pl-1.5 pr-3 shadow-sm backdrop-blur"><Logo size={18} texto={false} /><span className="text-[11px] font-bold tracking-[.2em] text-stone-800">NEXORA</span></motion.div>
        {d.e && <motion.div {...entra(0)} className="absolute bottom-3 left-5 text-xs font-semibold uppercase tracking-[.2em] text-white drop-shadow">{d.e}</motion.div>}
      </div>
      <div className="space-y-4 p-5">
        <motion.div {...entra(1)}>
          <h1 className="font-display text-2xl font-bold leading-tight">{d.n}</h1>
          <div className="mt-1 font-mono text-xs text-stone-500">{d.s}</div>
        </motion.div>
        {chips.length > 0 && <motion.div {...entra(2)} className="flex flex-wrap gap-1.5">{chips.map((c) => <span key={c.texto} className="flex items-center gap-1.5 rounded-full bg-stone-900/[.06] px-2.5 py-1 text-xs font-medium">{c.icono}{c.texto}</span>)}</motion.div>}
        <motion.div {...entra(3)} className="flex items-end justify-between gap-3 border-t border-stone-900/10 pt-4">
          <div><div className="text-[10px] font-semibold uppercase tracking-[.2em] text-stone-500">Precio</div><div className="font-display text-3xl font-bold text-[#a8862c]">{precio(d.p, d.m)}</div></div>
          <div className="text-right text-xs text-stone-600">
            {d.l && <div className="flex items-center justify-end gap-1"><Tag size={12} />Lote {d.l}</div>}
            <div className={`mt-0.5 flex items-center justify-end gap-1 ${vence !== null && vence < 60 ? 'font-semibold text-orange-600' : ''}`}><CalendarClock size={12} />{d.v ? `Vence el ${fechaCorta(d.v)}` : 'No vence'}</div>
          </div>
        </motion.div>
        {extra && <motion.div {...entra(4)}>{extra}</motion.div>}
        <motion.div {...entra(5)} className="flex justify-center rounded-2xl bg-white px-3 py-3 ring-1 ring-stone-900/5"><Barras valor={d.s} /></motion.div>
      </div>
    </motion.article>
  )
}
