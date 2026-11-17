/** Números para Excel: convierte los textos que muestra NEXORA ("$ 1.234,50", "12,5 %") en números con formato. */
import { simboloMoneda } from './format'

export const fmtMoneda = () => `"${simboloMoneda()}" #,##0.00;[Red]-"${simboloMoneda()}" #,##0.00`

/** Convierte textos con formato ("$ 1.234,50", "12,5 %", "1.234") en números para que Excel pueda sumarlos. */
export function aNumero(v: string | number | null | undefined): { v: number; z: string } | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? { v, z: Number.isInteger(v) ? (Math.abs(v) >= 10000 ? '#,##0' : '0') : '#,##0.00' } : null
  const t = v.trim(), neg = /^[−-]/.test(t), s = t.replace(/^[−-]\s*/, ''), signo = neg ? -1 : 1
  const cifra = (x: string) => Number(x.replace(/\./g, '').replace(',', '.'))
  const numero = /^(\d{1,3}(\.\d{3})+(,\d+)?|\d+(,\d+)?)$/
  const sim = simboloMoneda()
  if (s.startsWith(sim)) { const r = s.slice(sim.length).trim(); return numero.test(r) ? { v: signo * cifra(r), z: fmtMoneda() } : null }
  const m = s.match(/^(.+?)\s*%$/); if (m && numero.test(m[1])) return { v: (signo * cifra(m[1])) / 100, z: '0.0%' }
  if (numero.test(s) && !/^0\d/.test(s)) return { v: signo * cifra(s), z: s.includes(',') ? '#,##0.00' : /\./.test(s) ? '#,##0' : '0' }
  return null
}


/**
 * Lee un monto escrito a mano, como lo escribe la gente: «50», «50,50», «50.50», «1.500», «1.500,50», «$ 1500».
 * Con un solo punto seguido de 3 cifras («1.500») es separador de miles, como se muestra en NEXORA.
 * Devuelve null si el texto no es un monto.
 */
export function leerMonto(texto: string): number | null {
  let t = texto.replace(/[$\s]|USD/gi, '')
  if (!t) return null
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.')
  if (coma >= 0 && punto >= 0) t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '') // el último es el decimal
  else if (coma >= 0) t = (t.match(/,/g)!.length > 1 ? t.replace(/,/g, '') : t.replace(',', '.'))
  else if (punto >= 0 && (t.match(/\./g)!.length > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(t))) t = t.replace(/\./g, '')
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
