import { describe, expect, it } from 'vitest'
import { aNumero, leerMonto } from '../lib/numeros'
import { money, pct } from '../lib/format'

describe('números para Excel', () => {
  it('dinero con el formato de NEXORA', () => {
    expect(aNumero(money(1234.5))?.v).toBeCloseTo(1234.5)
    expect(aNumero(money(-98765.4))?.v).toBeCloseTo(-98765.4)
    expect(aNumero(money(1234.5))?.z).toContain('#,##0.00')
  })
  it('porcentajes y cifras', () => {
    expect(aNumero(pct(0.125, 1))?.v).toBeCloseTo(0.125)
    expect(aNumero('1.234')?.v).toBe(1234)
    expect(aNumero('2,5')?.v).toBe(2.5)
    expect(aNumero(42)?.z).toBe('0')
  })
  it('deja como texto lo que no es número', () => {
    expect(aNumero('DM-001')).toBeNull()
    expect(aNumero('0999123456')).toBeNull() // teléfono con cero inicial
    expect(aNumero('2,5 años')).toBeNull()
    expect(aNumero('REEMPLAZAR AHORA')).toBeNull()
  })
})

describe('leerMonto: montos escritos a mano', () => {
  it('entiende comas, puntos y miles como se escriben en Ecuador', () => {
    expect(leerMonto('50')).toBe(50)
    expect(leerMonto('50,5')).toBe(50.5)
    expect(leerMonto('50.50')).toBe(50.5)
    expect(leerMonto('1.500')).toBe(1500)
    expect(leerMonto('1.500,75')).toBe(1500.75)
    expect(leerMonto('1,500.75')).toBe(1500.75)
    expect(leerMonto('$ 2.350')).toBe(2350)
    expect(leerMonto('0.125')).toBe(0.125)
    expect(leerMonto('12.5')).toBe(12.5)
  })
  it('rechaza lo que no es un monto', () => {
    expect(leerMonto('')).toBeNull()
    expect(leerMonto('abc')).toBeNull()
    expect(leerMonto('5-0')).toBeNull()
  })
})
