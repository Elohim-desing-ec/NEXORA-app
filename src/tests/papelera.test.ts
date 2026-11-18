import { beforeEach, describe, expect, it } from 'vitest'
import { useApp, origenCambio } from '../store/useApp'

const prov = (id: string, nombre: string) => ({ id, nombre, ruc: '', ciudad: '', contacto: '', telefono: '', email: '', cumplimiento: 100, indicePrecio: 1 })

describe('papelera', () => {
  beforeEach(() => {
    origenCambio.pausa = true // dejar todo vacío antes de cada prueba no cuenta como «eliminar»
    useApp.setState({ proveedores: [], productos: [], papelera: [], ordenes: [], usuario: { id: 'u', nombre: 'Ana', usuario: 'ana', rol: 'Gerente General', email: '', clave: '' } })
    origenCambio.pausa = false
  })

  it('lo eliminado aquí queda en la papelera con quién lo quitó y se recupera', () => {
    useApp.getState().guardarProveedor(prov('p1', 'Don Luis'))
    useApp.getState().eliminarProveedor('p1')
    const [e] = useApp.getState().papelera
    expect(e).toMatchObject({ coleccion: 'proveedores', por: 'Ana', registro: { id: 'p1', nombre: 'Don Luis' } })
    expect(useApp.getState().recuperar(e.id)).toBeNull()
    expect(useApp.getState().proveedores.map((p) => p.nombre)).toEqual(['Don Luis'])
    expect(useApp.getState().papelera).toHaveLength(0)
  })

  it('lo que quita la sincronización también queda, marcado como «Sincronización»', () => {
    useApp.setState({ proveedores: [prov('p1', 'A'), prov('p2', 'B')] })
    origenCambio.nube = true
    useApp.setState({ proveedores: [prov('p1', 'A')] })
    origenCambio.nube = false
    expect(useApp.getState().papelera[0]).toMatchObject({ por: expect.stringContaining('Sincronización'), registro: { nombre: 'B' } })
  })

  it('al cambiar de empresa en el equipo no se llena la papelera', () => {
    useApp.setState({ proveedores: [prov('p1', 'A')] })
    origenCambio.pausa = true
    useApp.setState({ proveedores: [] })
    origenCambio.pausa = false
    expect(useApp.getState().papelera).toHaveLength(0)
  })

  it('agregar o editar no manda nada a la papelera', () => {
    useApp.getState().guardarProveedor(prov('p1', 'A'))
    useApp.getState().guardarProveedor(prov('p1', 'A editado'))
    expect(useApp.getState().papelera).toHaveLength(0)
  })
})

describe('eliminar órdenes de compra', () => {
  const orden = (id: string, estado: 'Borrador' | 'Aprobada' | 'Recibida') => ({ id, fecha: '2026-11-18', proveedorId: 'p1', sucursal: 'UIO', items: [{ productoId: 'x', cantidad: 2, costo: 5 }], estado, creadaPor: 'Ana' })
  beforeEach(() => { origenCambio.pausa = true; useApp.setState({ ordenes: [orden('OC-1', 'Borrador'), orden('OC-2', 'Aprobada'), orden('OC-3', 'Recibida')], papelera: [], proveedores: [prov('p1', 'Don Luis')] }); origenCambio.pausa = false })

  it('una orden en Borrador o Aprobada se elimina y queda en la papelera', () => {
    expect(useApp.getState().eliminarOrden('OC-1')).toBeNull()
    expect(useApp.getState().eliminarOrden('OC-2')).toBeNull()
    expect(useApp.getState().ordenes.map((o) => o.id)).toEqual(['OC-3'])
    expect(useApp.getState().papelera.map((e) => e.registro.id).sort()).toEqual(['OC-1', 'OC-2'])
  })
  it('una orden Recibida de un producto que ya no existe se elimina sin tocar nada más', () => {
    expect(useApp.getState().eliminarOrden('OC-3')).toBeNull()
    expect(useApp.getState().ordenes).toHaveLength(2)
  })
  it('sin órdenes pendientes, el proveedor ya se puede eliminar', () => {
    expect(useApp.getState().eliminarProveedor('p1')).toContain('Recíbalas o elimínelas')
    useApp.getState().eliminarOrden('OC-1'); useApp.getState().eliminarOrden('OC-2')
    expect(useApp.getState().eliminarProveedor('p1')).toBeNull()
  })
})

describe('recibir y eliminar órdenes: el inventario queda sincronizado', () => {
  const camiseta = { id: 'c1', sku: 'CAM-RF', nombre: 'Camiseta regular fit', categoria: 'Ropa', costo: 4, precio: 10, stock: { UIO: 2 }, min: 10, max: 100, lote: '', vence: '', proveedorId: 'p1' }
  const stock = () => useApp.getState().productos.find((p) => p.id === 'c1')!.stock.UIO
  beforeEach(() => {
    origenCambio.pausa = true
    useApp.setState({ productos: [camiseta], movimientos: [], papelera: [], proveedores: [prov('p1', 'Don Luis')],
      ordenes: [{ id: 'OC-9', fecha: '2026-11-18', proveedorId: 'p1', sucursal: 'UIO', estado: 'Aprobada', creadaPor: 'Ana', items: [{ productoId: 'c1', cantidad: 10, costo: 5 }, { productoId: 'c1', cantidad: 5, costo: 5 }] }] })
    origenCambio.pausa = false
  })

  it('al recibir entran TODAS las líneas (antes solo la primera de cada producto)', () => {
    useApp.getState().avanzarOrden('OC-9')
    expect(stock()).toBe(17) // 2 + 10 + 5
    expect(useApp.getState().movimientos.filter((m) => m.tipo === 'Compra').reduce((a, m) => a + m.cantidad, 0)).toBe(15)
  })
  it('eliminar una orden recibida descuenta su mercadería del inventario y deja el costo como estaba', () => {
    useApp.getState().avanzarOrden('OC-9')
    expect(useApp.getState().eliminarOrden('OC-9')).toBeNull()
    const p = useApp.getState().productos[0]
    expect(p.stock.UIO).toBe(2)
    expect(p.costo).toBeCloseTo(4, 2) // el promedio se guarda con 4 decimales: puede quedar en 4,0004 (en pantalla, $ 4,00)
    expect(useApp.getState().movimientos.slice(-1)[0]).toMatchObject({ tipo: 'Ajuste', cantidad: -15, nota: 'Orden OC-9 eliminada' })
  })
  it('si ya se vendió parte de lo recibido, no se elimina y explica qué hacer', () => {
    useApp.getState().avanzarOrden('OC-9')
    useApp.getState().registrar('c1', 'UIO', 'Venta', 10, '')
    expect(useApp.getState().eliminarOrden('OC-9')).toContain('quedan 7 u')
    expect(stock()).toBe(7)
    expect(useApp.getState().ordenes).toHaveLength(1)
  })
  it('una orden recibida que se recupera de la papelera vuelve como Aprobada (al recibirla entra otra vez)', () => {
    useApp.getState().avanzarOrden('OC-9')
    useApp.getState().eliminarOrden('OC-9')
    const e = useApp.getState().papelera.find((x) => x.registro.id === 'OC-9')!
    expect(useApp.getState().recuperar(e.id)).toBeNull()
    expect(useApp.getState().ordenes[0].estado).toBe('Aprobada')
    useApp.getState().avanzarOrden('OC-9')
    expect(stock()).toBe(17)
  })
})

