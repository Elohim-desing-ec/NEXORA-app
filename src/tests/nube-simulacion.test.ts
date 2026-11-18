/**
 * Simulador de la nube: una base de datos falsa con el mismo comportamiento que Supabase
 * (jsonb reordena los campos, cada consulta tarda, los cambios llegan en vivo a todos los equipos)
 * para reproducir lo que hace una persona: agregar proveedores y productos seguidos, recargar, usar dos equipos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------- Base de datos falsa (compartida por todos los "equipos") ----------
type Fila = { empresa_id: string; clave: string; valor: unknown; actualizado: string; actualizado_por: string }
const G = globalThis as unknown as { __nube: Nube; __semilla: number; __rastro?: string[] }
interface Nube { filas: Map<string, Fila>; canales: Set<Canal>; latencia: [number, number]; escrituras: number }
interface Canal { cbs: { tabla: string; cb: () => void }[] }
const azar = () => { G.__semilla = (G.__semilla * 1103515245 + 12345) % 2147483648; return G.__semilla / 2147483648 }
const demora = () => new Promise((r) => setTimeout(r, G.__nube.latencia[0] + azar() * (G.__nube.latencia[1] - G.__nube.latencia[0])))
/** jsonb: las claves de cada objeto quedan ordenadas (primero las cortas) */
const jsonb = (v: unknown): unknown => Array.isArray(v) ? v.map(jsonb)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map((k) => [k, jsonb((v as Record<string, unknown>)[k])])) : v
const pg = (iso: string) => new Date(iso).toISOString().replace('Z', '+00:00')
const avisar = () => { for (const c of G.__nube.canales) for (const x of c.cbs) if (x.tabla === 'datos') setTimeout(x.cb, 20 + azar() * 200) }

class Consulta {
  vivo: () => boolean = () => true
  op: 'select' | 'update' | 'insert' = 'select'; cols = '*'; filtros: [string, string, unknown][] = []; datos: Record<string, unknown> = {}; uno = false; volver = false
  constructor(private tabla: string) {}
  select(c = '*') { if (this.op === 'select') this.cols = c; else this.volver = true; return this }
  eq(c: string, v: unknown) { this.filtros.push(['eq', c, v]); return this }
  in(c: string, v: unknown[]) { this.filtros.push(['in', c, v]); return this }
  maybeSingle() { this.uno = true; return this }
  update(d: Record<string, unknown>) { this.op = 'update'; this.datos = d; return this }
  insert(d: Record<string, unknown>) { this.op = 'insert'; this.datos = d; return this }
  then<T>(ok: (r: { data: unknown; error: unknown }) => T, ko?: (e: unknown) => T) {
    if (!this.vivo()) return new Promise<T>(() => undefined)
    return demora().then(() => (this.vivo() ? this.ejecutar() : new Promise<never>(() => undefined))).then(ok, ko)
  }
  private cumple(f: Fila) {
    return this.filtros.every(([op, c, v]) => {
      const x = (f as unknown as Record<string, unknown>)[c]
      if (op === 'in') return (v as unknown[]).includes(x)
      return c === 'actualizado' ? new Date(String(x)).getTime() === new Date(String(v)).getTime() : x === v
    })
  }
  private ejecutar(): { data: unknown; error: unknown } {
    const n = G.__nube
    if (this.tabla !== 'datos') return { data: [], error: null }
    const filas = [...n.filas.values()].filter((f) => this.cumple(f))
    const ver = (f: Fila) => Object.fromEntries(this.cols.split(',').map((c) => c.trim()).map((c) => [c, structuredClone((f as unknown as Record<string, unknown>)[c])]))
    if (this.op === 'select') return { data: this.uno ? (filas[0] ? ver(filas[0]) : null) : filas.map(ver), error: null }
    if (this.op === 'update') {
      for (const f of filas) { f.valor = jsonb(structuredClone(this.datos.valor)); f.actualizado = pg(String(this.datos.actualizado)); f.actualizado_por = String(this.datos.actualizado_por); n.escrituras++
        if (G.__rastro && f.clave === 'proveedores') G.__rastro.push(`  nube ← ${f.actualizado_por}: ${((f.valor ?? []) as { nombre: string }[]).map((x) => x.nombre).join(',')}`) }
      if (filas.length) avisar()
      return { data: this.volver ? filas.map((f) => ({ actualizado: f.actualizado })) : null, error: null }
    }
    const k = `${this.datos.empresa_id}|${this.datos.clave}`
    if (n.filas.has(k)) return { data: null, error: { code: '23505' } }
    const f: Fila = { empresa_id: String(this.datos.empresa_id), clave: String(this.datos.clave), valor: jsonb(structuredClone(this.datos.valor)), actualizado: pg(String(this.datos.actualizado)), actualizado_por: String(this.datos.actualizado_por) }
    n.filas.set(k, f); n.escrituras++; avisar()
    return { data: this.volver ? [{ actualizado: f.actualizado }] : null, error: null }
  }
}

function clienteFalso(vivo: () => boolean) {
  const canales: Canal[] = []
  return {
    canales,
    from: (t: string) => { const q = new Consulta(t); q.vivo = vivo; return q },
    channel: () => {
      const c: Canal & { on: (...a: unknown[]) => unknown; subscribe: (cb: (s: string) => void) => unknown } = {
        cbs: [],
        on(_e: unknown, f: unknown, cb: unknown) { c.cbs.push({ tabla: (f as { table: string }).table, cb: () => { if (vivo()) (cb as () => void)() } }); return c },
        subscribe(cb: (s: string) => void) { G.__nube.canales.add(c); canales.push(c); setTimeout(() => { if (vivo()) cb('SUBSCRIBED') }, 30); return c },
      }
      return c
    },
    removeChannel: (c: Canal) => { G.__nube.canales.delete(c) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), getSession: async () => ({ data: { session: null } }) },
  }
}


const ACCESO = { empresaId: 'E1', empresa: 'Tienda', esDueno: true, rol: 'Gerente General', roles: [], plan: 'Prueba', vence: null, vigente: true }
const USUARIO = { id: 'cuenta:duena@x.com', nombre: 'Dueña', usuario: 'duena', rol: 'Gerente General' as const, email: 'duena@x.com', clave: 'x' }

/** Abre NEXORA en un equipo (o lo recarga): módulos nuevos, mismo almacenamiento del equipo. */
async function abrir(idb: Map<string, unknown>, quien = 'U1') {
  let vivo = true
  const cliente = clienteFalso(() => vivo)
  vi.resetModules()
  // IndexedDB falso: cada "equipo" tiene el suyo; una pestaña cerrada ya no escribe
  vi.doMock('idb-keyval', () => ({ get: async (k: string) => structuredClone(idb.get(k)), set: async (k: string, v: unknown) => { if (vivo) idb.set(k, structuredClone(v)) }, del: async (k: string) => { if (vivo) idb.delete(k) } }))
  vi.doMock('../lib/cuenta', () => ({
    supabase: cliente,
    miAcceso: async () => ACCESO,
    equipoEmpresa: async () => [{ email: 'duena@x.com', nombre: 'Dueña', rol: 'Gerente General', roles: [], es_dueno: true }],
    nombreDe: () => 'Dueña', fotoDe: () => undefined,
  }))
  const app = await import('../store/useApp')
  const nube = await import('../lib/nube')
  await vi.advanceTimersByTimeAsync(50) // hidratación desde el almacenamiento
  if (!app.useApp.getState().usuario) app.useApp.setState({ usuario: USUARIO, licencia: { plan: 'Prueba', vence: null, empresaId: 'E1', esDueno: true } })
  nube.conectarNube(ACCESO as never, { id: quien } as never)
  await vi.advanceTimersByTimeAsync(3000)
  /** La pestaña se cierra de golpe (recarga, se cierra el navegador o el celular la mata) */
  const matar = () => { vivo = false; cliente.canales.forEach((c) => G.__nube.canales.delete(c)) }
  return { app: app.useApp, nube, idb, matar }
}
const prov = (nombre: string) => ({ id: crypto.randomUUID(), nombre, ruc: '', ciudad: '', contacto: '', telefono: '', email: '', cumplimiento: 100, indicePrecio: 1, nivel: 'Junior' as const, provee: '', lugar: '' })
const nombres = (lista: { nombre: string }[]) => lista.map((x) => x.nombre).sort()
const enNube = (clave: string) => nombres((G.__nube.filas.get(`E1|${clave}`)?.valor ?? []) as { nombre: string }[])

beforeEach(() => {
  vi.useFakeTimers()
  G.__semilla = 42
  G.__nube = { filas: new Map(), canales: new Set(), latencia: [30, 400], escrituras: 0 }
  ;(globalThis as Record<string, unknown>).indexedDB = {}
  const ls = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => { ls.set(k, v) }, removeItem: (k: string) => { ls.delete(k) } }
  ;(globalThis as Record<string, unknown>).window = { addEventListener() {}, removeEventListener() {} }
  ;(globalThis as Record<string, unknown>).document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }
})
afterEach(() => { vi.useRealTimers() })

describe('simulación: lo que se agrega no se borra', () => {
  it('un equipo: agrega 4 proveedores seguidos y luego productos', async () => {
    const pc = await abrir(new Map())
    for (const n of ['Don Luis', 'Textiles Ana', 'Fábrica Sur', 'Distribuidora Norte']) { pc.app.getState().guardarProveedor(prov(n)); await vi.advanceTimersByTimeAsync(300) }
    await vi.advanceTimersByTimeAsync(5000)
    expect(nombres(pc.app.getState().proveedores)).toHaveLength(4)
    expect(enNube('proveedores')).toHaveLength(4)
  })

  it('un equipo: agrega, recarga, agrega otra vez', async () => {
    const idb = new Map<string, unknown>()
    let pc = await abrir(idb)
    pc.app.getState().guardarProveedor(prov('A')); await vi.advanceTimersByTimeAsync(5000)
    pc.nube.desconectarNube(); await vi.advanceTimersByTimeAsync(1000)
    pc = await abrir(idb) // recargar
    expect(nombres(pc.app.getState().proveedores)).toEqual(['A'])
    pc.app.getState().guardarProveedor(prov('B')); await vi.advanceTimersByTimeAsync(5000)
    pc.nube.desconectarNube(); await vi.advanceTimersByTimeAsync(1000)
    pc = await abrir(idb)
    expect(nombres(pc.app.getState().proveedores)).toEqual(['A', 'B'])
    expect(enNube('proveedores')).toEqual(['A', 'B'])
  })

  it('dos equipos a la vez (computadora y celular) agregando', async () => {
    const pc = await abrir(new Map())
    const cel = await abrir(new Map())
    pc.app.getState().guardarProveedor(prov('A')); await vi.advanceTimersByTimeAsync(200)
    cel.app.getState().guardarProveedor(prov('B')); await vi.advanceTimersByTimeAsync(200)
    pc.app.getState().guardarProveedor(prov('C')); await vi.advanceTimersByTimeAsync(1500)
    cel.app.getState().guardarProveedor(prov('D')); await vi.advanceTimersByTimeAsync(8000)
    expect(enNube('proveedores')).toEqual(['A', 'B', 'C', 'D'])
    expect(nombres(pc.app.getState().proveedores)).toEqual(['A', 'B', 'C', 'D'])
    expect(nombres(cel.app.getState().proveedores)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('lo que elimina otro equipo queda en la papelera de este y se puede recuperar', async () => {
    const pc = await abrir(new Map(), 'pc')
    const cel = await abrir(new Map(), 'cel')
    pc.app.getState().guardarProveedor(prov('Don Luis')); await vi.advanceTimersByTimeAsync(5000)
    const id = cel.app.getState().proveedores.find((p) => p.nombre === 'Don Luis')!.id
    cel.app.getState().eliminarProveedor(id); await vi.advanceTimersByTimeAsync(5000)
    expect(nombres(pc.app.getState().proveedores)).toEqual([])
    const e = pc.app.getState().papelera.find((x) => x.registro.id === id)!
    expect(e.por).toContain('Sincronización')
    expect(pc.app.getState().recuperar(e.id)).toBeNull(); await vi.advanceTimersByTimeAsync(5000)
    expect(enNube('proveedores')).toEqual(['Don Luis'])
    expect(nombres(cel.app.getState().proveedores)).toEqual(['Don Luis'])
  })
})

/**
 * Prueba de estrés: varios equipos hacen cosas al azar (agregar proveedores y productos, eliminar, recargar de golpe
 * en medio de un guardado, red lenta). Al final, con todos los equipos abiertos de nuevo, todo lo agregado y no
 * eliminado debe estar en la nube y en cada equipo; lo eliminado, en ninguno.
 */
async function estres(semilla: number, opciones: { equipos: number; pasos: number; latencia: [number, number] }) {
  G.__semilla = semilla
  G.__nube.latencia = opciones.latencia
  const idbs = Array.from({ length: opciones.equipos }, () => new Map<string, unknown>())
  const equipos = [] as Awaited<ReturnType<typeof abrir>>[]
  for (const [i, idb] of idbs.entries()) equipos.push(await abrir(idb, `equipo${i}`))
  const agregados = new Set<string>(), eliminados = new Set<string>(), productos = new Set<string>()
  const historial: string[] = []
  G.__rastro = historial
  let n = 0
  for (let paso = 0; paso < opciones.pasos; paso++) {
    const e = Math.floor(azar() * equipos.length), eq = equipos[e]
    const r = azar()
    if (r < 0.4) { const nombre = `P${++n}`; agregados.add(nombre); eq.app.getState().guardarProveedor(prov(nombre)); historial.push(`${e}: agrega ${nombre}`) }
    else if (r < 0.6) { const sku = `SKU${++n}`; productos.add(sku); eq.app.getState().guardarProducto({ id: `X${n}`, sku, nombre: sku, categoria: 'Otros', costo: 1, precio: 2, stock: { S1: 5 }, min: 1, max: 10, lote: '', vence: '', proveedorId: '' }); historial.push(`${e}: producto ${sku}`) }
    else if (r < 0.7) {
      const vis = eq.app.getState().proveedores.filter((p) => !eliminados.has(p.nombre))
      if (vis.length) { const p = vis[Math.floor(azar() * vis.length)]; eliminados.add(p.nombre); eq.app.getState().eliminarProveedor(p.id); historial.push(`${e}: elimina ${p.nombre}`) }
    } else if (r < 0.8) { // recarga de golpe (a veces justo después de agregar)
      eq.matar(); equipos[e] = await abrir(eq.idb, `equipo${e}`); historial.push(`${e}: recarga`)
    }
    await vi.advanceTimersByTimeAsync(50 + azar() * 1500)
  }
  await vi.advanceTimersByTimeAsync(15000)
  // Todos los equipos se vuelven a abrir (lo que quedó sin subir en alguno se sube al abrir)
  historial.push('— todos se vuelven a abrir —'); for (let i = 0; i < equipos.length; i++) { equipos[i].matar(); equipos[i] = await abrir(equipos[i].idb, `equipo${i}`) }
  await vi.advanceTimersByTimeAsync(70000)
  const esperado = [...agregados].filter((x) => !eliminados.has(x)).sort()
  const detalle = `semilla ${semilla}\n${historial.join('\n')}`
  // Ya en calma: nadie debe seguir guardando (antes los equipos se reescribían el orden de la lista sin fin)
  const escrituras = G.__nube.escrituras
  await vi.advanceTimersByTimeAsync(180000)
  expect(G.__nube.escrituras - escrituras, `guardados sin fin · ${detalle}`).toBe(0)
  expect(enNube('proveedores'), detalle).toEqual(esperado)
  for (const eq of equipos) expect(nombres(eq.app.getState().proveedores), detalle).toEqual(esperado)
  const skus = ((G.__nube.filas.get('E1|productos')?.valor ?? []) as { sku: string }[]).map((p) => p.sku).sort()
  expect(skus, detalle).toEqual([...productos].sort())
}

describe('prueba de estrés de la sincronización', () => {
  for (let s = 1; s <= 80; s++) it(`2 equipos, red normal · semilla ${s}`, () => estres(s, { equipos: 2, pasos: 40, latencia: [30, 400] }), 60000)
  for (let s = 1; s <= 50; s++) it(`3 equipos, red lenta · semilla ${s}`, () => estres(100 + s, { equipos: 3, pasos: 40, latencia: [300, 2500] }), 60000)
  for (let s = 1; s <= 30; s++) it(`4 equipos, red muy lenta · semilla ${s}`, () => estres(300 + s, { equipos: 4, pasos: 40, latencia: [800, 5000] }), 60000)
  for (let s = 1; s <= 40; s++) it(`2 equipos, jornada larga · semilla ${s}`, () => estres(700 + s, { equipos: 2, pasos: 120, latencia: [30, 800] }), 60000)
})

/**
 * Dos pestañas del mismo navegador activas a la vez se pisan los datos (lo no guardado en la nube de una lo borra la otra).
 * Por eso solo una pestaña está activa (candado del navegador): la otra queda en pausa y NO escribe nada.
 */
describe('otra pestaña abierta', () => {
  it('la pestaña en pausa no escribe en el almacenamiento', async () => {
    const idb = new Map<string, unknown>()
    const pc = await abrir(idb)
    pc.app.getState().guardarProveedor(prov('Guardado'))
    await vi.advanceTimersByTimeAsync(3000)
    // Segunda pestaña del mismo navegador: el candado ya lo tiene la primera
    vi.resetModules()
    vi.doMock('idb-keyval', () => ({ get: async (k: string) => structuredClone(idb.get(k)), set: async (k: string, v: unknown) => { idb.set(k, structuredClone(v)) }, del: async (k: string) => { idb.delete(k) } }))
    vi.stubGlobal('navigator', { locks: { request: (_n: string, _o: unknown, cb: (l: null) => unknown) => Promise.resolve(cb(null)) } })
    const pestana = await import('../lib/pestana')
    const otra = await import('../store/useApp')
    await vi.advanceTimersByTimeAsync(50)
    expect(await pestana.tomarPestana(() => undefined)).toBe(false)
    otra.useApp.setState({ proveedores: [] }) // la pestaña vieja intenta guardar su copia desactualizada
    otra.useApp.getState().guardarProveedor(prov('Desde la otra pestaña'))
    await vi.advanceTimersByTimeAsync(3000)
    const guardado = String(idb.get('nexora-app'))
    expect(guardado).toContain('Guardado') // lo guardado sigue intacto
    expect(guardado).not.toContain('Desde la otra pestaña') // la pestaña en pausa no escribió
    vi.unstubAllGlobals()
  })
})

