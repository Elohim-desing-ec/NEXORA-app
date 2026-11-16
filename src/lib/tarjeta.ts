/** Validación y formato de la tarjeta del pago simulado (no se cobra nada). */
export const soloDigitos = (s: string) => s.replace(/\D/g, '')

/** Algoritmo de Luhn: detecta números de tarjeta mal escritos. */
export function luhn(numero: string) {
  const d = soloDigitos(numero)
  if (d.length < 13 || d.length > 19) return false
  let suma = 0
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i])
    if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9 }
    suma += x
  }
  return suma % 10 === 0
}

/** "4242424242424242" → "4242 4242 4242 4242" */
export const formatoTarjeta = (s: string) => soloDigitos(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
/** "1228" → "12/28" */
export const formatoVence = (s: string) => { const d = soloDigitos(s).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }

/** MM/AA válido y no vencido (vence al final del mes indicado). */
export function venceValido(mmaa: string, hoy = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmaa)
  if (!m) return false
  const mes = Number(m[1]), anio = 2000 + Number(m[2])
  if (mes < 1 || mes > 12) return false
  return anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1)
}

export const marcaTarjeta = (s: string) => {
  const d = soloDigitos(s)
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'American Express'
  if (/^3(0[0-5]|[68])/.test(d)) return 'Diners Club'
  return ''
}
