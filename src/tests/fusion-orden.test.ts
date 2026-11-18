import { describe, expect, it } from 'vitest'
import { fusionar, huella } from '../lib/fusion'

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


describe('la base como huella (lo que se guarda junto a los datos)', () => {
  const p = (id: string, nombre = id) => ({ id, nombre })
  it('da el mismo resultado que con los registros completos', () => {
    const base = [p('A'), p('B')], aqui = [p('A'), p('C')], nube = [p('A'), p('B', 'B editado')]
    expect(fusionar(huella(base), aqui, nube)).toEqual(fusionar(base, aqui, nube))
    expect(fusionar(huella(base), [p('A')], [p('A'), p('B')]).map((x) => x.id)).toEqual(['A']) // borrado aquí
    expect(fusionar(huella(base), [p('A'), p('B')], [p('A')]).map((x) => x.id)).toEqual(['A']) // borrado en otro equipo
  })
  it('la huella no depende del orden de los campos', () => {
    expect(huella([{ id: '1', a: 1, b: 2 }])).toEqual(huella([{ b: 2, id: '1', a: 1 }]))
  })
})
