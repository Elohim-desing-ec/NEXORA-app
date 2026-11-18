import { describe, expect, it } from 'vitest'
import { diasParaVencer, esPrenda, etiquetaProducto, tallasDe, usaCuello, usaVencimiento } from '../lib/inventario'
import { categoriasPara } from '../lib/sectores'
import { CATALOGO, tiposDe } from '../data/categorias'

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

describe('categorías que lo engloban todo', () => {
  const ROPA = 'Ropa, calzado y textil'
  it('«Ropa, calzado y textil» incluye camisetas, buzos, chalecos, gorras y calzado', () => {
    for (const t of ['Camisetas', 'Buzos y sudaderas', 'Chalecos', 'Gorras y sombreros', 'Calzado']) expect(tiposDe(ROPA)).toContain(t)
    expect(CATALOGO.every((c) => c.categoria === 'Otros' || c.tipos.length > 0)).toBe(true)
  })
  it('sin tipo: es prenda, con cuello y tallas de ropa (no de calzado)', () => {
    expect(esPrenda(ROPA)).toBe(true)
    expect(usaCuello(ROPA)).toBe(true)
    expect(tallasDe(ROPA)).toContain('M')
    expect(usaVencimiento(ROPA)).toBe(false)
  })
  it('cada tipo pide lo suyo', () => {
    expect(usaCuello(ROPA, 'Chalecos')).toBe(true)
    expect(usaCuello(ROPA, 'Gorras y sombreros')).toBe(false)
    expect(tallasDe(ROPA, 'Gorras y sombreros')).toContain('Única')
    expect(tallasDe(ROPA, 'Calzado')).toContain('40')
    expect(esPrenda(ROPA, 'Telas e hilos')).toBe(false)
  })
  it('vencimiento por tipo: en hogar, los detergentes vencen y los utensilios no', () => {
    expect(usaVencimiento('Limpieza y hogar', 'Detergentes')).toBe(true)
    expect(usaVencimiento('Limpieza y hogar', 'Utensilios de cocina')).toBe(false)
    expect(usaVencimiento('Mascotas', 'Alimento para mascotas')).toBe(true)
    expect(usaVencimiento('Tecnología', 'Celulares')).toBe(false)
  })
  it('se sugieren primero las categorías del negocio', () => {
    expect(categoriasPara('Moda y textil')[0]).toBe(ROPA)
    expect(categoriasPara('Farmacéutico')[0]).toBe('Farmacia y salud')
    expect(categoriasPara('')).toHaveLength(CATALOGO.length)
  })
})

import { baseDeModelo, codigoColor, colorHex, modeloDe, skuVariante } from '../lib/inventario'
import { codificarFicha, leerFicha } from '../components/Ficha'

describe('variantes de una prenda (colores y tallas)', () => {
  it('código corto de cada color para el SKU', () => {
    expect(codigoColor('Blanco')).toBe('BLA')
    expect(codigoColor('Azul marino')).toBe('AZUM')
    expect(codigoColor('Azul rey')).toBe('AZUR')
    expect(codigoColor('Celeste acuario')).toBe('CELA')
    expect(skuVariante('cam-010', 'Plomo oscuro', 'S')).toBe('CAM-010-PLOO-S')
    expect(skuVariante('CAM-010', '', 'XL')).toBe('CAM-010-XL')
  })
  it('los colores de su proveedor tienen muestra', () => {
    for (const c of ['Blanco', 'Negro', 'Azul camerino', 'Rojo', 'Celeste acuario', 'Azul rey', 'Plomo claro', 'Azul marino', 'Plomo oscuro', 'Crema']) expect(colorHex(c)).toMatch(/^#/)
  })
  it('las variantes se agrupan por modelo y se obtiene su código base', () => {
    expect(modeloDe({ modelo: 'CAM-010', nombre: 'Camiseta', categoria: 'Ropa', color: 'Blanco', talla: 'S' })).toBe('CAM-010')
    expect(modeloDe({ nombre: 'Camiseta', categoria: 'Ropa', talla: 'S' })).toBe(modeloDe({ nombre: 'Camiseta', categoria: 'Ropa', talla: 'M' }))
    expect(modeloDe({ nombre: 'Arroz', categoria: 'Alimentos' })).toBeNull()
    expect(baseDeModelo({ sku: 'CAM-010-BLA-S', color: 'Blanco', talla: 'S' })).toBe('CAM-010')
    expect(baseDeModelo({ sku: 'CAM-010-M', talla: 'M' })).toBe('CAM-010')
  })
})

describe('ficha del QR', () => {
  it('el QR lleva los datos de la prenda y se leen igual (con tildes y ñ)', () => {
    const d = { n: 'Camiseta básica niño', s: 'CAM-010-BLA-S', co: 'Blanco', ta: 'S', cu: 'Redondo', p: 12.5, m: '$', e: 'Mi Tienda' }
    expect(leerFicha(`https://x.github.io/NEXORA-app/#/ficha?d=${codificarFicha(d)}`)).toEqual(d)
    expect(leerFicha('CAM-010')).toBeNull()
  })
})
