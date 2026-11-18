import { describe, expect, it } from 'vitest'
import { baseConfiable, fusionar } from '../lib/fusion'

// La nube (columna jsonb de Postgres) devuelve los campos de cada objeto en SU orden, no en el de la app.
describe('lo eliminado no vuelve aunque la nube devuelva los campos en otro orden', () => {
  const enApp = { id: 'P1', nombre: 'Don Luis', ciudad: 'Quito', telefono: '099' }
  const enNube = { id: 'P1', ciudad: 'Quito', nombre: 'Don Luis', telefono: '099' } // mismo contenido, otro orden
  it('se elimina aquí y la nube aún lo tiene sin cambios: queda eliminado', () => {
    expect(fusionar([enApp], [], [enNube])).toEqual([])
  })
  it('un cambio real de otra persona sí se conserva', () => {
    expect(fusionar([enApp], [], [{ ...enNube, telefono: '098' }]).map((x) => x.id)).toEqual(['P1'])
  })
  it('sin cambios de nadie: no cuenta como cambio', () => {
    expect(fusionar([enApp], [enApp], [enNube])).toEqual([enApp])
  })
})


describe('dos pestañas abiertas: no se borra lo recién agregado', () => {
  const p = (id: string) => ({ id })
  it('la base solo se usa si la guardó la misma pestaña que escribió los datos', () => {
    expect(baseConfiable({ pestana: 'A', datos: { proveedores: [p('1')] } }, 'A')).toEqual({ proveedores: [p('1')] })
    expect(baseConfiable({ pestana: 'A', datos: { proveedores: [p('1')] } }, 'B')).toEqual({})
    expect(baseConfiable({ proveedores: [p('1')] }, 'A')).toEqual({}) // formato anterior: no se confía
    expect(baseConfiable(undefined, 'A')).toEqual({})
  })
  it('datos de una pestaña vieja + base de otra: sin base confiable no se pierde nada', () => {
    const basePestanaNueva = [p('P1'), p('P2')] // la pestaña donde se agregó P2
    const datosPestanaVieja = [p('P1')] // la pestaña vieja guardó encima sin P2
    const nube = [p('P1'), p('P2')]
    // Antes: con la base de la otra pestaña, P2 parecía eliminado aquí y se borraba
    expect(fusionar(basePestanaNueva, datosPestanaVieja, nube).map((x) => x.id)).toEqual(['P1'])
    // Ahora: la base no es confiable (otra pestaña) → se une y P2 se conserva
    const base = baseConfiable({ pestana: 'nueva', datos: { proveedores: basePestanaNueva } }, 'vieja').proveedores as typeof nube | undefined
    expect(fusionar(base, datosPestanaVieja, nube).map((x) => x.id)).toEqual(['P1', 'P2'])
  })
})
