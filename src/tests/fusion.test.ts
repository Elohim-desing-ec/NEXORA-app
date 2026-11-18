import { describe, expect, it } from 'vitest'
import { esAnterior, fusionar } from '../lib/fusion'

const v = (id: string, total = 10) => ({ id, total })

describe('fusión de cambios de varias personas', () => {
  it('dos personas registran ventas a la vez: se conservan las dos', () => {
    const base = [v('A')]
    const yo = [v('A'), v('B')] // registré B
    const nube = [v('A'), v('C')] // otra persona registró C
    expect(fusionar(base, yo, nube).map((x) => x.id)).toEqual(['A', 'B', 'C'])
  })
  it('un borrado en la nube se respeta si aquí no se tocó ese registro', () => {
    expect(fusionar([v('A'), v('B')], [v('A'), v('B')], [v('A')]).map((x) => x.id)).toEqual(['A'])
  })
  it('un borrado aquí no lo revive la nube', () => {
    expect(fusionar([v('A'), v('B')], [v('A')], [v('A'), v('B')]).map((x) => x.id)).toEqual(['A'])
  })
  it('cambio solo en la nube: se toma; cambio en los dos: gana el de este equipo', () => {
    expect(fusionar([v('A', 10)], [v('A', 10)], [v('A', 20)])).toEqual([v('A', 20)])
    expect(fusionar([v('A', 10)], [v('A', 30)], [v('A', 20)])).toEqual([v('A', 30)])
  })
  it('sin historia previa: no se pierde nada de ningún lado', () => {
    expect(fusionar(undefined, [v('A'), v('B')], [v('A'), v('C')]).map((x) => x.id).sort()).toEqual(['A', 'B', 'C'])
  })
  it('datos que no son listas: gana el lado que cambió', () => {
    expect(fusionar({ n: 'X' }, { n: 'Y' }, { n: 'X' })).toEqual({ n: 'Y' })
    expect(fusionar({ n: 'X' }, { n: 'X' }, { n: 'Z' })).toEqual({ n: 'Z' })
    expect(fusionar(undefined, { n: 'viejo' }, { n: 'nube' })).toEqual({ n: 'nube' })
  })
  it('una versión vieja que llega tarde se reconoce (si se combinara, borraría lo recién agregado)', () => {
    // Este equipo ya guardó [A, B] (nuevo: B) y luego llega tarde la versión anterior [A]
    expect(fusionar([v('A'), v('B')], [v('A'), v('B')], [v('A')]).map((x) => x.id)).toEqual(['A']) // por eso hay que ignorarla
    expect(esAnterior('2026-11-18T10:00:00.100+00:00', '2026-11-18T10:00:01.250+00:00')).toBe(true)
    expect(esAnterior('2026-11-18T10:00:01.250+00:00', '2026-11-18T10:00:00.100+00:00')).toBe(false)
    expect(esAnterior('2026-11-18T10:00:00.123456+00:00', '2026-11-18T10:00:00.123456+00:00')).toBe(false)
    expect(esAnterior(undefined, '2026-11-18T10:00:00Z')).toBe(false) // sin versión conocida: se combina como siempre
  })
})
