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

