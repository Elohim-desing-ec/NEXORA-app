import { describe, expect, it } from 'vitest'
import { diasParaVencer, esPrenda, etiquetaProducto, tallasDe, usaCuello, usaVencimiento } from '../lib/inventario'

describe('vencimiento según la categoría', () => {
  it('alimentos, medicinas y limpieza vencen; ropa, tecnología y ferretería no', () => {
    for (const c of ['Alimentos y bebidas', 'Farmacia', 'Medicamentos', 'Lácteos', 'Limpieza y hogar', 'Cuidado personal']) expect(usaVencimiento(c)).toBe(true)
    for (const c of ['Textil', 'Camisetas', 'Tecnología', 'Ferretería', 'Repuestos', 'Calzado']) expect(usaVencimiento(c)).toBe(false)
  })
  it('un producto sin fecha no vence (no aparece en «Por vencer»)', () => {
    expect(diasParaVencer({ vence: '' })).toBeNull()
    const ahora = new Date('2026-11-18T12:00:00').getTime()
    expect(diasParaVencer({ vence: '2026-11-28' }, ahora)).toBeCloseTo(10, 0)
  })
})

describe('prendas: color, talla y tipo de cuello', () => {
  it('reconoce la ropa y a qué prendas les corresponde cuello', () => {
    expect(esPrenda('Textil')).toBe(true)
    expect(esPrenda('Camisetas')).toBe(true)
    expect(esPrenda('Pantalones')).toBe(true)
    expect(esPrenda('Tecnología')).toBe(false)
    expect(usaCuello('Camisetas')).toBe(true)
    expect(usaCuello('Pantalones')).toBe(false)
    expect(usaCuello('Calzado')).toBe(false)
  })
  it('tallas de ropa y de calzado', () => {
    expect(tallasDe('Camisetas')).toContain('M')
    expect(tallasDe('Calzado')).toContain('40')
  })
  it('el nombre muestra color, talla y cuello para distinguir cada talla', () => {
    expect(etiquetaProducto({ nombre: 'Camiseta básica', color: 'Blanco', talla: 'M', cuello: 'En V' })).toBe('Camiseta básica · Blanco · Talla M · Cuello en V')
    expect(etiquetaProducto({ nombre: 'Arroz 2 kg' })).toBe('Arroz 2 kg')
  })
})
