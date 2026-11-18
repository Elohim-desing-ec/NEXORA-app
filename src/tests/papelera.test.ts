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
