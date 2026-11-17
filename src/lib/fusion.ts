/**
 * Combina cambios de varias personas sin perder ninguno (fusión de tres vías).
 *   base     = lo último que este equipo sabía que estaba en la nube
 *   local    = lo que hay en este equipo ahora
 *   servidor = lo que hay en la nube ahora (puede traer cambios de otras personas)
 * Para listas con `id` (ventas, gastos, productos, bitácora…) se combina elemento por elemento:
 *   - lo agregado en cualquier lado se conserva; lo borrado en un lado se borra (si el otro no lo cambió);
 *   - si los dos cambiaron el mismo elemento, gana el cambio de este equipo.
 * Para lo demás (datos de la empresa): si este equipo lo cambió gana el local; si no, el de la nube.
 */
type ConId = { id: string }
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const esListaConId = (v: unknown): v is ConId[] => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as ConId).id === 'string')

export function fusionar<T>(base: T | undefined, local: T, servidor: T | undefined): T {
  if (servidor === undefined || igual(local, servidor)) return local
  if (esListaConId(local) && esListaConId(servidor) && (base === undefined || esListaConId(base))) {
    // Sin historia previa no se sabe qué se borró: se unen las dos listas sin perder nada
    const B = new Map(((base ?? []) as ConId[]).map((x) => [x.id, x]))
    const L = new Map(local.map((x) => [x.id, x]))
    const S = new Map(servidor.map((x) => [x.id, x]))
    const r: ConId[] = []
    for (const x of local) {
      const b = B.get(x.id), s = S.get(x.id)
      if (b && !s) { if (!igual(x, b)) r.push(x); continue } // otra persona lo borró: se borra, salvo que aquí se haya cambiado
      if (b && s && igual(x, b) && !igual(s, b)) { r.push(s); continue } // solo la nube lo cambió
      r.push(x) // nuevo aquí, sin cambios, o cambiado aquí (gana lo local)
    }
    for (const s of servidor) {
      if (L.has(s.id)) continue
      const b = B.get(s.id)
      if (!b) r.push(s) // agregado por otra persona
      else if (!igual(s, b)) r.push(s) // aquí se borró pero otra persona lo cambió: se conserva
      // si no: aquí se borró y nadie más lo tocó → queda borrado
    }
    return r as T
  }
  if (base === undefined) return servidor // sin historia: los datos de la empresa los manda la nube
  return igual(local, base) ? servidor : local
}
