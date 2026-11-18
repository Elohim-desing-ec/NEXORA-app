/**
 * Combina cambios de varias personas sin perder ninguno (fusión de tres vías).
 *   base     = lo último que este equipo sabía que estaba en la nube (como «huella»: ver abajo)
 *   local    = lo que hay en este equipo ahora
 *   servidor = lo que hay en la nube ahora (puede traer cambios de otras personas)
 * Para listas con `id` (ventas, gastos, productos, bitácora…) se combina elemento por elemento:
 *   - lo agregado en cualquier lado se conserva; lo borrado en un lado se borra (si el otro no lo cambió);
 *   - si los dos cambiaron el mismo elemento, gana el cambio de este equipo.
 * Para lo demás (datos de la empresa): si este equipo lo cambió gana el local; si no, el de la nube.
 */
type ConId = { id: string }
/** Copia con las claves de cada objeto en orden alfabético (las listas conservan su orden). */
const canonico = (v: unknown): unknown => Array.isArray(v) ? v.map(canonico)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico((v as Record<string, unknown>)[k])])) : v
/**
 * ¿Mismo contenido? Sin importar el orden de los campos: la nube (jsonb de Postgres) devuelve cada objeto con sus campos
 * en otro orden. Compararlos como texto hacía creer que «otra persona lo cambió» y lo eliminado volvía a aparecer.
 */
export const igual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b) || JSON.stringify(canonico(a)) === JSON.stringify(canonico(b))
const esListaConId = (v: unknown): v is ConId[] => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as ConId).id === 'string')

/** Resumen corto del contenido (cyrb53 del JSON canónico): dos contenidos iguales dan la misma huella. */
export function resumen(v: unknown): string {
  const s = JSON.stringify(canonico(v)) ?? ''
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Huella de lo que había en la nube: por cada registro, su id y un resumen de su contenido (no el registro entero).
 * Se guarda JUNTO con los datos del equipo, en la misma escritura: así nunca quedan desfasados (si quedaban desfasados,
 * al abrir la app lo recién agregado o eliminado se confundía y se perdía o volvía a aparecer).
 */
export type Huella = { lista: Record<string, string> } | { valor: string }
export const huella = (v: unknown): Huella => (esListaConId(v) ? { lista: Object.fromEntries(v.map((x) => [x.id, resumen(x)])) } : { valor: resumen(v) })
const esHuella = (v: unknown): v is Huella => !!v && typeof v === 'object' && !Array.isArray(v) && (('lista' in v && typeof (v as { lista: unknown }).lista === 'object') || ('valor' in v && typeof (v as { valor: unknown }).valor === 'string'))

/** base: la huella (o el valor completo, que se convierte en huella). */
export function fusionar<T>(base: Huella | T | undefined, local: T, servidor: T | undefined): T {
  if (servidor === undefined || igual(local, servidor)) return local
  const hb = base === undefined ? undefined : esHuella(base) ? base : huella(base)
  if (esListaConId(local) && esListaConId(servidor) && (hb === undefined || 'lista' in hb)) {
    // Sin historia previa no se sabe qué se borró: se unen las dos listas sin perder nada
    const B = hb && 'lista' in hb ? hb.lista : {}
    const L = new Map(local.map((x) => [x.id, x]))
    const S = new Set(servidor.map((x) => x.id))
    const r: ConId[] = []
    // 1) Lo que está en la nube, EN EL ORDEN DE LA NUBE: así todos los equipos quedan con la misma lista y no se
    //    pasan reescribiendo el orden unos a otros (eso causaba guardados sin fin y choques que perdían datos).
    for (const s of servidor) {
      const b = B[s.id], x = L.get(s.id)
      if (x) { r.push(b && resumen(x) === b && resumen(s) !== b ? s : x); continue } // solo la nube lo cambió: el de la nube; si no, el de aquí
      if (!b) r.push(s) // agregado por otra persona
      else if (resumen(s) !== b) r.push(s) // aquí se borró pero otra persona lo cambió: se conserva
      // si no: aquí se borró y nadie más lo tocó → queda borrado
    }
    // 2) Lo que solo está aquí
    for (const x of local) {
      if (S.has(x.id)) continue
      const b = B[x.id]
      if (b && resumen(x) === b) continue // otra persona lo borró y aquí no se tocó → se borra
      r.push(x) // nuevo aquí (o cambiado aquí aunque otra persona lo borró: se conserva)
    }
    return r as T
  }
  if (!hb || !('valor' in hb)) return servidor // sin historia: los datos de la empresa los manda la nube
  return resumen(local) === hb.valor ? servidor : local
}

/**
 * ¿La versión `a` (fecha en la nube) es anterior a la `b`? Una consulta lenta puede traer una versión vieja DESPUÉS de que
 * este equipo ya guardó una más nueva: combinarla haría creer que otra persona borró lo recién agregado (p. ej. un proveedor).
 */
export const esAnterior = (a: string | undefined, b: string | undefined) => !!a && !!b && Date.parse(a) < Date.parse(b)
