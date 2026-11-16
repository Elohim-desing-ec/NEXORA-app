import { describe, expect, it } from 'vitest'
import { LIMITES, PRECIOS, limitesDe } from '../lib/planes'
import fuente from '../../supabase/functions/payphone/index.ts?raw'

describe('planes de emprendimiento', () => {
  it('los precios de la portada son los mismos que cobra la función payphone (en centavos)', () => {
    for (const [plan, p] of Object.entries(PRECIOS)) {
      expect(fuente).toContain(`'${plan}': { mensual: ${p.mensual * 100}, anual: ${p.anual * 100} }`)
    }
  })
  it('el pago anual equivale a 10 meses (2 gratis)', () => {
    for (const p of Object.values(PRECIOS)) expect(p.anual).toBe(p.mensual * 10)
  })
  it('cada plan pagado tiene límites; la prueba y los planes anteriores no', () => {
    for (const plan of Object.keys(PRECIOS)) expect(LIMITES[plan]).toBeDefined()
    expect(limitesDe('Emprende')).toEqual({ sucursales: 1, personas: 3 })
    expect(limitesDe('Prueba')).toEqual({ sucursales: null, personas: null })
    expect(limitesDe(null)).toEqual({ sucursales: null, personas: null })
  })
})
