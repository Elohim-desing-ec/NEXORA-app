import { useEffect, useRef } from 'react'
import { cx } from './ui'

const GLIFOS = '01{}[]<>/\\=+*#$%&λΣΔΩπ∑√∞≈≠◊アカサタナハマヤラワ'.split('')
const al = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
interface Glifo { x: number; y: number; vx: number; vy: number; vida: number; max: number; c: string; t: string; tam: number; alfa: number }

/**
 * Letras doradas tipo código que brotan alrededor del mouse, cambian de símbolo y se desvanecen.
 * Con `ambiente`, además suben lentamente desde el horizonte aunque nadie mueva el mouse.
 * Respeta "reducir movimiento" del sistema.
 */
export function EstelaCodigo({ ambiente = false, className }: { ambiente?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d')
    if (!cv || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Colores del tema activo (el canvas no entiende variables CSS)
    const css = getComputedStyle(document.documentElement), c = (n: string) => css.getPropertyValue(n).trim() || '212 175 55'
    const TONOS = ['--t-palido', '--t-claro', '--t-oro', '--t-oscuro'].map((n) => `rgb(${c(n)})`), ORO = c('--t-oro')
    let gs: Glifo[] = [], raf = 0, w = 0, h = 0, mx = -1, my = -1, ultimo = 0
    const ajustar = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    const crear = (x: number, y: number, fuerza = 1) => {
      const a = Math.random() * Math.PI * 2, v = (0.25 + Math.random() * 1.3) * fuerza, r = 8 + Math.random() * 26
      gs.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, vida: 0, max: 45 + Math.random() * 55, c: al(TONOS), t: al(GLIFOS), tam: 10 + Math.random() * 9, alfa: 1 })
    }
    const subir = () => gs.push({ x: Math.random() * w, y: h * (0.62 + Math.random() * 0.33), vx: (Math.random() - 0.5) * 0.25, vy: -(0.25 + Math.random() * 0.6), vida: 0, max: 140 + Math.random() * 120, c: al(TONOS), t: al(GLIFOS), tam: 9 + Math.random() * 6, alfa: 0.45 })
    const mover = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; for (let i = 0; i < 3; i++) crear(mx, my) }
    const estallar = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); for (let i = 0; i < 45; i++) crear(e.clientX - b.left, e.clientY - b.top, 3) }
    const salir = () => { mx = my = -1 }
    const tick = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      if (ambiente && t - ultimo > 85) { ultimo = t; subir() }
      if (mx >= 0) { // halo suave alrededor del puntero
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 110); g.addColorStop(0, `rgb(${ORO} / .16)`); g.addColorStop(1, `rgb(${ORO} / 0)`)
        ctx.fillStyle = g; ctx.fillRect(mx - 110, my - 110, 220, 220)
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = `rgb(${ORO} / .9)`
      for (const g of gs) {
        g.vida++; g.x += g.vx; g.y += g.vy; g.vx *= 0.985; g.vy = g.vy * 0.985 - 0.005
        if (Math.random() < 0.05) g.t = al(GLIFOS) // el símbolo "parpadea" como código
        const k = g.vida / g.max, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85
        ctx.globalAlpha = Math.max(0, a) * g.alfa; ctx.fillStyle = g.c; ctx.shadowBlur = g.tam > 15 ? 10 : 5
        ctx.font = `${g.tam}px ui-monospace, "SF Mono", Menlo, monospace`; ctx.fillText(g.t, g.x, g.y)
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      gs = gs.filter((g) => g.vida < g.max)
      if (gs.length > 320) gs = gs.slice(gs.length - 320)
      raf = requestAnimationFrame(tick)
    }
    ajustar(); raf = requestAnimationFrame(tick)
    window.addEventListener('resize', ajustar); window.addEventListener('pointermove', mover); window.addEventListener('pointerdown', estallar); document.addEventListener('pointerleave', salir)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', ajustar); window.removeEventListener('pointermove', mover); window.removeEventListener('pointerdown', estallar); document.removeEventListener('pointerleave', salir) }
  }, [ambiente])
  return <canvas ref={ref} aria-hidden className={cx('pointer-events-none absolute inset-0 h-full w-full', className)} />
}
