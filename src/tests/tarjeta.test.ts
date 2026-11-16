import { describe, expect, it } from 'vitest'
import { formatoTarjeta, formatoVence, luhn, marcaTarjeta, venceValido } from '../lib/tarjeta'

describe('tarjeta del pago simulado', () => {
  it('Luhn acepta tarjetas de prueba y rechaza errores de tipeo', () => {
    expect(luhn('4242 4242 4242 4242')).toBe(true)
    expect(luhn('5555555555554444')).toBe(true)
    expect(luhn('4242 4242 4242 4241')).toBe(false)
    expect(luhn('4242')).toBe(false)
  })
  it('formatea número y vencimiento mientras se escribe', () => {
    expect(formatoTarjeta('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatoTarjeta('42-42')).toBe('4242')
    expect(formatoVence('1228')).toBe('12/28')
    expect(formatoVence('1')).toBe('1')
  })
  it('vencimiento: válido hasta el final del mes indicado', () => {
    const hoy = new Date(2026, 10, 16) // noviembre 2026
    expect(venceValido('11/26', hoy)).toBe(true)
    expect(venceValido('10/26', hoy)).toBe(false)
    expect(venceValido('01/27', hoy)).toBe(true)
    expect(venceValido('13/27', hoy)).toBe(false)
    expect(venceValido('1227', hoy)).toBe(false)
  })
  it('reconoce la marca', () => {
    expect(marcaTarjeta('4242')).toBe('Visa')
    expect(marcaTarjeta('5555')).toBe('Mastercard')
    expect(marcaTarjeta('3782')).toBe('American Express')
    expect(marcaTarjeta('9999')).toBe('')
  })
})
