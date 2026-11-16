/** Tipo de equipo según el navegador (para explicar cómo instalar NEXORA en cada uno). */
export type Equipo = 'ios' | 'samsung' | 'android' | 'computadora'

/**
 * iPadOS se presenta como Mac de escritorio: se reconoce porque, a diferencia de una Mac, tiene pantalla táctil.
 * Samsung Internet también dice "Android", por eso se revisa antes.
 */
export function tipoDeEquipo(ua: string, puntosTactiles = 0): Equipo {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && puntosTactiles > 1)) return 'ios'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/Android/.test(ua)) return 'android'
  return 'computadora'
}

export const equipoActual = (): Equipo => (typeof navigator === 'undefined' ? 'computadora' : tipoDeEquipo(navigator.userAgent, navigator.maxTouchPoints))
