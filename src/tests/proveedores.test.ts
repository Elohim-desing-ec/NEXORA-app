import { describe, it, expect } from 'vitest'
import { avisosProveedores, distanciaKm, nivelSugerido, sucursalCercana, textoKm } from '../lib/proveedores'
import type { Orden, Producto, Proveedor, Sucursal } from '../data/base'

const suc = (id: string, nombre: string, lat: number, lng: number): Sucursal => ({ id, nombre, tipo: 'Sucursal', pais: 'EC', ciudad: '', direccion: '', lat, lng, activa: true })
const GYE = suc('GYE', 'Matriz Guayaquil', -2.1709, -79.9224), UIO = suc('UIO', 'Quito', -0.1807, -78.4678)
const prov = (x: Partial<Proveedor> = {}): Proveedor => ({ id: 'PR1', nombre: 'Don Luis camisetas', ruc: '', ciudad: 'Guayaquil', contacto: '', telefono: '0991234567', email: '', cumplimiento: 100, indicePrecio: 1, nivel: 'Emprendedor', ...x })
const camiseta: Producto = { id: 'P1', sku: 'CAM-1', nombre: 'Camiseta blanca', categoria: 'Textil', costo: 4, precio: 10, stock: { GYE: 1, UIO: 40 }, min: 20, max: 80, lote: '', vence: '', proveedorId: 'PR1' }
const oc = (id: string, estado: Orden['estado']): Orden => ({ id, proveedorId: 'PR1', sucursal: 'GYE', fecha: '2026-11-01', estado, items: [], creadaPor: 'yo' })

describe('proveedores de todo tamaño', () => {
  it('mide distancias reales y elige la sucursal más cercana', () => {
    expect(distanciaKm(GYE, UIO)).toBeGreaterThan(260)
    expect(distanciaKm(GYE, UIO)).toBeLessThan(290)
    const p = prov({ lat: -2.15, lng: -79.9 }) // a pocos km de la matriz
    expect(sucursalCercana(p, [UIO, GYE])?.s.id).toBe('GYE')
    expect(textoKm(0.35)).toBe('350 m')
    expect(sucursalCercana(prov(), [GYE])).toBeNull() // sin ubicación
  })
  it('sugiere subir de nivel solo con entregas cumplidas', () => {
    expect(nivelSugerido(prov(), [oc('1', 'Recibida'), oc('2', 'Recibida')])).toBeNull()
    expect(nivelSugerido(prov(), [oc('1', 'Recibida'), oc('2', 'Recibida'), oc('3', 'Recibida')])).toBe('Junior')
    expect(nivelSugerido(prov({ nivel: 'Experimentado' }), Array.from({ length: 20 }, (_, k) => oc(String(k), 'Recibida')))).toBeNull()
  })
  it('avisa a quién pedir lo que falta, a qué distancia, y quién no cumple', () => {
    const p = prov({ lat: -2.15, lng: -79.9 })
    const a = avisosProveedores({ proveedores: [p], productos: [camiseta], sucursales: [GYE, UIO], ordenes: [oc('1', 'Aprobada'), oc('2', 'Aprobada'), oc('3', 'Recibida')] })
    expect(a.find((x) => x.t === 'rojo')?.m).toMatch(/Reponga Camiseta blanca: su proveedor Don Luis camisetas está a .* de Matriz Guayaquil/)
    expect(a.some((x) => x.t === 'ambar' && x.m.includes('33 %'))).toBe(true)
    const sinMapa = avisosProveedores({ proveedores: [prov()], productos: [camiseta], sucursales: [GYE], ordenes: [] })
    expect(sinMapa.find((x) => x.t === 'rojo')?.m).toContain('0991234567')
    expect(sinMapa.some((x) => x.t === 'info')).toBe(true)
  })
})
