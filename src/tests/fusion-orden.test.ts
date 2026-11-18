import { describe, expect, it } from 'vitest'
import { fusionar } from '../lib/fusion'

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
