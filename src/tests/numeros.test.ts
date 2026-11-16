import { describe, expect, it } from 'vitest'
import { aNumero } from '../lib/numeros'
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
