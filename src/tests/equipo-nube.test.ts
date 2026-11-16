import { beforeEach, describe, expect, it } from 'vitest'
import { useApp, idCuenta, type Usuario } from '../store/useApp'
import type { Tarea } from '../data/base'

const tarea = (asignados: string[], creadoPor: string): Tarea => ({ id: 't1', titulo: 'Contar inventario', descripcion: '', estado: 'pendiente', prioridad: 'media', vence: '', asignados, etiquetas: [], color: '', creadoPor, creada: '', actualizada: '', orden: 0 })

describe('equipo de la nube en la lista de usuarios', () => {
  beforeEach(() => {
    const titular: Usuario = { id: 'id-viejo', nombre: 'Titular', usuario: 'titular', rol: 'Gerente General', email: 'Duena@Gmail.com', clave: 'x' }
    const local: Usuario = { id: 'local-1', nombre: 'Cajero local', usuario: 'caja', rol: 'Cajero', email: '', clave: 'caja2026' }
    useApp.setState({ usuarios: [titular, local], usuario: titular, tareas: [tarea(['id-viejo'], 'id-viejo')], temasColor: { 'id-viejo': 'azul' } })
  })

  it('agrega a los invitados con sus roles y une al titular con su cuenta sin perder sus tareas', () => {
    useApp.getState().sincronizarEquipo([
      { email: 'duena@gmail.com', nombre: 'Dueña', rol: 'Gerente General', roles: [], esDueno: true },
      { email: 'eduardo@gmail.com', nombre: 'Eduardo Lara', rol: 'Gerente Financiero', roles: ['Contador'], esDueno: false },
    ])
    const s = useApp.getState()
    const ids = s.usuarios.map((u) => u.id)
    expect(ids).toContain(idCuenta('duena@gmail.com'))
    expect(ids).toContain(idCuenta('eduardo@gmail.com'))
    expect(ids).toContain('local-1') // los usuarios solo de este equipo se conservan
    expect(ids).not.toContain('id-viejo')
    expect(s.usuarios.find((u) => u.id === idCuenta('eduardo@gmail.com'))).toMatchObject({ rol: 'Gerente Financiero', roles: ['Contador'], nombre: 'Eduardo Lara' })
    expect(s.tareas[0].asignados).toEqual([idCuenta('duena@gmail.com')])
    expect(s.tareas[0].creadoPor).toBe(idCuenta('duena@gmail.com'))
    expect(s.usuario?.id).toBe(idCuenta('duena@gmail.com'))
    expect(s.temasColor[idCuenta('duena@gmail.com')]).toBe('azul')
  })

  it('un cambio de rol en la nube se aplica y quien sale del equipo desaparece', () => {
    const titular = { email: 'duena@gmail.com', nombre: 'Dueña', rol: 'Gerente General' as const, roles: [], esDueno: true }
    useApp.getState().sincronizarEquipo([titular, { email: 'eduardo@gmail.com', nombre: 'Eduardo', rol: 'Vendedor', roles: [], esDueno: false }])
    useApp.getState().sincronizarEquipo([titular, { email: 'eduardo@gmail.com', nombre: 'Eduardo', rol: 'Jefe de Bodega', roles: [], esDueno: false }])
    expect(useApp.getState().usuarios.find((u) => u.id === idCuenta('eduardo@gmail.com'))?.rol).toBe('Jefe de Bodega')
    useApp.getState().sincronizarEquipo([titular])
    expect(useApp.getState().usuarios.some((u) => u.id === idCuenta('eduardo@gmail.com'))).toBe(false)
  })
})
