import { create } from 'zustand'
import { limitesDe } from '../lib/planes'
import type { TemaColor } from '../lib/temas'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { EMPRESA_BASE, type Empresa, type Evento, type Movimiento, type Orden, type Producto, type Proveedor, type Sucursal, type SucursalId, type EstadoOC, type Gasto, type Cierre, type Venta, type LineaVenta, type EstadoVenta, type Tarea, type Nota, type EstadoTarea } from '../data/base'

export type Rol = 'Gerente General' | 'Gerente Financiero' | 'Analista Financiero' | 'Contador' | 'Gerente de Sucursal' | 'Gerente de Ventas' | 'Vendedor' | 'Cajero'
  | 'Jefe de Compras' | 'Jefe de Bodega' | 'Jefe de Logística' | 'Jefe de Marketing' | 'Recursos Humanos' | 'Administrador de Sistemas' | 'Asistente Administrativo' | 'Auditor' | 'Socio o Inversionista' | 'Ayudante'
export const ROLES: Rol[] = ['Gerente General', 'Gerente Financiero', 'Analista Financiero', 'Contador', 'Gerente de Sucursal', 'Gerente de Ventas', 'Vendedor', 'Cajero', 'Jefe de Compras', 'Jefe de Bodega', 'Jefe de Logística', 'Jefe de Marketing', 'Recursos Humanos', 'Administrador de Sistemas', 'Asistente Administrativo', 'Auditor', 'Socio o Inversionista', 'Ayudante']
export type Pagina = 'dashboard' | 'espacio' | 'resumen' | 'red' | 'productos' | 'compras' | 'ia' | 'auditoria' | 'reportes' | 'economico' | 'configuracion'
/** Persona del equipo. nombre = nombre completo para mostrar; el resto es su ficha (opcional). */
export interface Usuario { id: string; nombre: string; usuario: string; rol: Rol; email: string; clave: string; /** Roles adicionales (máximo 2; en total 3) */ roles?: Rol[]; nombres?: string; apellidos?: string; telefono?: string; cargo?: string; sucursales?: string[]; redes?: Redes; foto?: string }
export interface Redes { linkedin?: string; whatsapp?: string; discord?: string; slack?: string; instagram?: string }
/** Cliente o contacto de la empresa (también se puede importar desde Google Contactos). */
export interface Cliente { id: string; nombre: string; email: string; telefono: string; empresa: string; nota: string }

/** Plan con el que se ingresó en este dispositivo (sin él nadie entra, ni el equipo local). */
export interface Licencia { plan: string; vence: string | null; empresaId?: string; esDueno?: boolean }
/** ¿El plan sigue vigente? (la prueba gratis vence; los planes pagados no). */
export const licenciaVigente = (l: Licencia | null | undefined) => !!l && (!l.vence || new Date(l.vence).getTime() > Date.now())

/** Id estable de una persona con cuenta NEXORA (el mismo en todos los equipos de la empresa). */
export const idCuenta = (email: string) => `cuenta:${email.toLowerCase()}`
/** ¿Es una persona del equipo en la nube (entra con su propia cuenta)? */
export const esCuenta = (u: Pick<Usuario, 'id'>) => u.id.startsWith('cuenta:')

/** Sin usuarios precargados: el titular entra con su cuenta NEXORA y crea o invita a su equipo. */
export const USUARIOS: Usuario[] = []
/** Ids de los usuarios de demostración que traían las versiones anteriores (se quitan en la versión 6). */
const EQUIPO_DEMO = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']

/** Secciones que ve cada rol. Una persona puede tener hasta 3 roles: ve la suma de todos. */
export const PERMISOS: Record<Rol, Pagina[]> = {
  'Gerente General': ['dashboard', 'espacio', 'resumen', 'red', 'productos', 'compras', 'ia', 'auditoria', 'reportes', 'economico', 'configuracion'],
  'Gerente Financiero': ['dashboard', 'espacio', 'resumen', 'red', 'compras', 'ia', 'auditoria', 'reportes', 'economico'],
  'Analista Financiero': ['dashboard', 'espacio', 'resumen', 'red', 'compras', 'ia', 'reportes', 'economico'],
  Contador: ['dashboard', 'espacio', 'resumen', 'red', 'productos', 'auditoria', 'reportes', 'economico'],
  'Gerente de Sucursal': ['dashboard', 'espacio', 'resumen', 'red', 'productos', 'compras', 'ia', 'reportes'],
  'Gerente de Ventas': ['dashboard', 'espacio', 'resumen', 'red', 'productos', 'ia', 'reportes'],
  Vendedor: ['dashboard', 'espacio', 'resumen', 'productos'],
  Cajero: ['dashboard', 'espacio', 'resumen'],
  'Jefe de Compras': ['dashboard', 'espacio', 'red', 'productos', 'compras', 'ia', 'reportes'],
  'Jefe de Bodega': ['dashboard', 'espacio', 'red', 'productos', 'compras', 'ia', 'reportes'],
  'Jefe de Logística': ['dashboard', 'espacio', 'red', 'productos', 'compras', 'reportes'],
  'Jefe de Marketing': ['dashboard', 'espacio', 'resumen', 'red', 'ia', 'reportes'],
  'Recursos Humanos': ['dashboard', 'espacio', 'reportes'],
  'Administrador de Sistemas': ['dashboard', 'espacio', 'auditoria', 'reportes', 'configuracion'],
  'Asistente Administrativo': ['dashboard', 'espacio', 'resumen', 'productos', 'compras', 'reportes'],
  Auditor: ['dashboard', 'espacio', 'resumen', 'red', 'productos', 'auditoria', 'reportes', 'economico'],
  'Socio o Inversionista': ['dashboard', 'resumen', 'red', 'reportes', 'economico'],
  Ayudante: ['dashboard', 'espacio', 'red', 'productos', 'reportes'],
}
/** Qué hace cada rol (se muestra al asignar roles). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  'Gerente General': 'Todo el sistema, usuarios y configuración', 'Gerente Financiero': 'Finanzas, análisis económico, aprobar compras y auditoría',
  'Analista Financiero': 'Indicadores, análisis económico y aprobar compras', Contador: 'Resumen, gastos, cierres, auditoría y reportes',
  'Gerente de Sucursal': 'Su sucursal: ventas, inventario, compras y recepciones', 'Gerente de Ventas': 'Ventas, clientes, metas e inventario',
  Vendedor: 'Registrar ventas y consultar productos', Cajero: 'Registrar ventas y cobros del día', 'Jefe de Compras': 'Proveedores y órdenes de compra',
  'Jefe de Bodega': 'Inventario, transferencias y recepción de compras', 'Jefe de Logística': 'Envíos entre sucursales, recepciones y la red global',
  'Jefe de Marketing': 'Canales de venta, clientes y reportes', 'Recursos Humanos': 'Equipo, perfiles y tareas del personal',
  'Administrador de Sistemas': 'Usuarios, configuración, respaldos y trazabilidad', 'Asistente Administrativo': 'Apoyo en ventas, gastos, compras e inventario',
  Auditor: 'Solo consulta: trazabilidad, resumen y reportes', 'Socio o Inversionista': 'Solo consulta: resultados, red y análisis económico', Ayudante: 'Consulta de inventario y tareas',
}
/** Roles que solo consultan (no editan inventario ni compras). */
export const SOLO_LECTURA: Rol[] = ['Auditor', 'Socio o Inversionista']
export const MAX_ROLES = 3
/** Roles de una persona: el principal y hasta 2 adicionales. */
export const rolesDe = (u?: Pick<Usuario, 'rol' | 'roles'> | null): Rol[] => (!u ? [] : [u.rol, ...(u.roles ?? []).filter((r) => r !== u.rol)].slice(0, MAX_ROLES))
export const tieneRol = (u: Pick<Usuario, 'rol' | 'roles'> | null | undefined, ...rs: Rol[]) => rolesDe(u).some((r) => rs.includes(r))
/** Secciones que ve la persona: la suma de los permisos de todos sus roles. */
export const permisosDe = (u?: Pick<Usuario, 'rol' | 'roles'> | null): Pagina[] => [...new Set(rolesDe(u).flatMap((r) => PERMISOS[r]))]
export const soloLectura = (u?: Pick<Usuario, 'rol' | 'roles'> | null) => rolesDe(u).every((r) => SOLO_LECTURA.includes(r))

/** Fila de producto para importar desde Excel/CSV. */
export interface FilaImport { sku: string; nombre: string; categoria: string; costo: number; precio: number; stock: Record<SucursalId, number>; min: number; max: number; lote: string; vence: string }
export type TipoOperacion = 'Venta' | 'Compra' | 'Ajuste' | 'Merma'

interface Datos { empresa: Empresa; sucursales: Sucursal[]; proveedores: Proveedor[]; productos: Producto[]; movimientos: Movimiento[]; ordenes: Orden[]; auditoria: Evento[]; usuarios: Usuario[]; gastos: Gasto[]; cierres: Cierre[]; ventas: Venta[]; tareas: Tarea[]; notas: Nota[]; clientes: Cliente[] }

interface AppState extends Datos {
  usuario: Usuario | null
  tema: 'oscuro' | 'claro'
  presentacion: boolean
  pagina: Pagina
  sucursal: SucursalId | 'TODAS'
  menuColapsado: boolean
  setMenuColapsado: (v: boolean) => void
  login: (u: Usuario) => void
  logout: () => void
  /** Plan comprado en este equipo: sin él nadie puede ingresar (ni el equipo con usuario y contraseña). */
  licencia: Licencia | null
  /** Ingreso con una cuenta NEXORA con plan vigente: usa o crea su usuario. El titular es Gerente General; un invitado, el rol que le dieron. */
  entrarConCuenta: (c: { id: string; email: string; nombre: string; foto?: string }, licencia: Licencia, permiso?: { rol: Rol; roles: Rol[] }) => void
  /** Copia el equipo de la nube (titular + invitados) a la lista de usuarios: así aparece en toda la app. */
  sincronizarEquipo: (personas: { email: string; nombre: string; rol: Rol; roles: Rol[]; esDueno: boolean }[]) => void
  ir: (p: Pagina) => void
  setTema: (t: 'oscuro' | 'claro') => void
  /** Tema de color de cada usuario (id de usuario → tema) */
  temasColor: Record<string, TemaColor>
  setTemaColor: (t: TemaColor) => void
  setPresentacion: (v: boolean) => void
  setSucursal: (s: SucursalId | 'TODAS') => void
  guardarEmpresa: (e: Empresa) => void
  guardarSucursal: (s: Sucursal, idAnterior?: string) => string | null
  eliminarSucursal: (id: string) => string | null
  guardarProducto: (p: Producto) => void
  eliminarProducto: (id: string) => void
  guardarProveedor: (p: Proveedor) => string | null
  eliminarProveedor: (id: string) => string | null
  transferir: (productoId: string, de: SucursalId, a: SucursalId, cantidad: number) => string | null
  registrar: (productoId: string, s: SucursalId, tipo: TipoOperacion, cantidad: number, nota: string, costoUnit?: number) => string | null
  crearOrden: (o: Omit<Orden, 'id' | 'fecha' | 'estado' | 'creadaPor'>) => void
  avanzarOrden: (id: string) => void
  vaciarDatos: () => void
  importarProductos: (filas: FilaImport[]) => { nuevos: number; actualizados: number }
  guardarUsuario: (u: Usuario) => string | null
  eliminarUsuario: (id: string) => string | null
  registrarVenta: (v: { fecha: string; sucursal: SucursalId; lineas: { productoId: string; cantidad: number; precio: number; concepto?: string; costo?: number }[]; descuento: number; cliente: string; canal: string; estado: EstadoVenta }) => string | null
  cambiarEstadoVenta: (id: string, estado: Exclude<EstadoVenta, 'Anulada'>) => void
  anularVenta: (id: string) => string | null
  guardarCliente: (c: Cliente) => void
  eliminarCliente: (id: string) => void
  guardarConexiones: (c: Record<string, string>) => void
  /** Importa personas ya clasificadas por quien ingresó (equipo, cliente o proveedor). */
  importarPersonas: (lista: { nombre: string; email: string; telefono: string; empresa: string; cargo: string; tipo: 'equipo' | 'cliente' | 'proveedor' }[], usuarioDe: (nombre: string, existentes: string[]) => string) => { equipo: number; clientes: number; proveedores: number }
  guardarTarea: (t: Tarea) => void
  moverTarea: (id: string, estado: EstadoTarea, antesDe?: string) => void
  eliminarTarea: (id: string) => void
  guardarNota: (n: Nota) => void
  eliminarNota: (id: string) => void
  guardarGasto: (g: Gasto) => void
  eliminarGasto: (id: string) => void
  cerrarPeriodo: (c: Cierre) => void
  quitarCierre: (id: string) => void
  respaldo: () => Datos
  restaurar: (d: Datos) => void
}

const sello = () => new Date().toISOString()

/**
 * Almacenamiento en IndexedDB: cientos de MB (localStorage solo admite ~5 MB), necesario para empresas
 * grandes con miles de productos y movimientos. Si encuentra datos antiguos en localStorage, los migra.
 */
/**
 * Datos guardados en IndexedDB (más espacio). Si el navegador no lo permite (modo privado de algunos celulares),
 * se usa localStorage y, como último recurso, la memoria de la pestaña. Así la app nunca falla al guardar.
 */
const hayIDB = typeof indexedDB !== 'undefined'
const memoria = new Map<string, string>()
const local = {
  get: (n: string) => { try { return localStorage.getItem(n) } catch { return memoria.get(n) ?? null } },
  set: (n: string, v: string) => { try { localStorage.setItem(n, v) } catch { memoria.set(n, v) } },
  del: (n: string) => { try { localStorage.removeItem(n) } catch { /* sin almacenamiento */ } memoria.delete(n) },
}
const almacen: StateStorage = {
  getItem: async (n) => {
    if (hayIDB) try { const v = await idbGet<string>(n); if (v != null) return v } catch { /* IndexedDB bloqueado */ }
    return local.get(n)
  },
  setItem: async (n, v) => {
    if (hayIDB) try { await idbSet(n, v); local.del(n); return } catch { /* IndexedDB bloqueado */ }
    local.set(n, v)
  },
  removeItem: async (n) => {
    if (hayIDB) try { await idbDel(n) } catch { /* IndexedDB bloqueado */ }
    local.del(n)
  },
}
const total = (p: Producto) => Object.values(p.stock).reduce((a, b) => a + (b || 0), 0)
const VACIO = { productos: [], movimientos: [], ordenes: [], auditoria: [], ventas: [], gastos: [], cierres: [] }

export const useApp = create<AppState>()(persist((set, get) => {
  const log = (accion: string, detalle: string, sucursal: SucursalId | '—' = '—') =>
    set({ auditoria: [...get().auditoria, { id: crypto.randomUUID(), fecha: sello(), usuario: get().usuario?.nombre ?? 'Sistema', accion, detalle, sucursal }] })
  const mov = (m: Omit<Movimiento, 'id' | 'fecha' | 'usuario'>) =>
    ({ ...m, id: crypto.randomUUID(), fecha: sello(), usuario: get().usuario?.nombre ?? 'Sistema' }) as Movimiento
  /** Movimientos que explican la diferencia de stock entre dos versiones de un producto (kardex siempre cuadra). */
  const difStock = (p: Producto, prev: Producto | undefined, nota: string) => [...new Set([...Object.keys(p.stock), ...Object.keys(prev?.stock ?? {})])].flatMap((s) => {
    const d = (p.stock[s] ?? 0) - (prev?.stock[s] ?? 0)
    return d ? [mov({ productoId: p.id, sucursal: s, tipo: prev ? 'Ajuste' : 'Saldo inicial', cantidad: d, costoUnit: p.costo, nota })] : []
  })
  return {
    usuario: null, usuarios: USUARIOS, tema: 'oscuro', presentacion: false, pagina: 'dashboard', sucursal: 'TODAS',
    // En laptops pequeñas el menú arranca contraído para dar más espacio al contenido.
    menuColapsado: typeof window !== 'undefined' && window.innerWidth < 1440,
    setMenuColapsado: (menuColapsado) => set({ menuColapsado }),
    empresa: EMPRESA_BASE, sucursales: [], proveedores: [], tareas: [], notas: [], clientes: [], ...VACIO,
    login: (usuario) => { set({ usuario, pagina: 'dashboard' }); log('Inicio de sesión', `${usuario.nombre} (${rolesDe(usuario).join(', ')})`) },
    logout: () => { log('Cierre de sesión', get().usuario?.nombre ?? ''); set({ usuario: null }) },
    licencia: null,
    entrarConCuenta: (c, licencia, permiso) => {
      const email = c.email.toLowerCase()
      const lista = get().usuarios
      const previo = lista.find((x) => !!x.email && x.email.toLowerCase() === email)
      let u: Usuario
      if (previo) u = { ...previo, foto: previo.foto ?? c.foto, ...(permiso ? { rol: permiso.rol, roles: permiso.roles } : {}) }
      else {
        const base = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'usuario'
        let usuario = base, n = 2
        while (lista.some((x) => x.usuario.toLowerCase() === usuario)) usuario = `${base}${n++}`
        u = { id: idCuenta(email), nombre: c.nombre, usuario, rol: permiso?.rol ?? 'Gerente General', roles: permiso?.roles, email: c.email, clave: crypto.randomUUID(), foto: c.foto }
      }
      set({ licencia, usuarios: previo ? lista.map((x) => (x.id === u.id ? u : x)) : [...lista, u] })
      if (!previo) log('Usuario creado', `${u.nombre} (cuenta ${c.email}, plan ${licencia.plan})`)
      get().login(u)
    },
    sincronizarEquipo: (personas) => {
      let { usuarios, tareas, usuario } = get()
      const temasColor = { ...get().temasColor }
      usuarios = [...usuarios]
      // Si alguien ya estaba con otro id (antes de usar cuentas), sus tareas pasan a su id de cuenta
      const reasignar = (viejo: string, nuevo: string) => {
        tareas = tareas.map((t) => (t.asignados.includes(viejo) || t.creadoPor === viejo ? { ...t, asignados: t.asignados.map((a) => (a === viejo ? nuevo : a)), creadoPor: t.creadoPor === viejo ? nuevo : t.creadoPor } : t))
        if (usuario?.id === viejo) usuario = { ...usuario, id: nuevo }
        if (temasColor[viejo] && !temasColor[nuevo]) temasColor[nuevo] = temasColor[viejo]
      }
      for (const p of personas) {
        const email = p.email.toLowerCase(), id = idCuenta(email)
        const k = usuarios.findIndex((u) => u.id === id || (!!u.email && u.email.toLowerCase() === email))
        const previo = k >= 0 ? usuarios[k] : undefined
        if (previo && previo.id !== id) reasignar(previo.id, id)
        let alias = previo?.usuario
        if (!alias) {
          const base = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'usuario'
          alias = base
          for (let n = 2; usuarios.some((x) => x.usuario.toLowerCase() === alias); n++) alias = `${base}${n}`
        }
        const u: Usuario = { ...previo, id, email, usuario: alias, nombre: p.nombre || previo?.nombre || alias, clave: previo?.clave || crypto.randomUUID(),
          rol: p.esDueno ? 'Gerente General' : p.rol, roles: p.esDueno ? previo?.roles : p.roles }
        if (k >= 0) usuarios[k] = u; else usuarios.push(u)
      }
      // Quien ya no está en el equipo de la nube deja de aparecer
      usuarios = usuarios.filter((u) => !u.id.startsWith('cuenta:') || personas.some((p) => idCuenta(p.email.toLowerCase()) === u.id))
      const yo = usuario ? usuarios.find((u) => u.id === usuario!.id) ?? usuario : usuario
      set({ usuarios, tareas, usuario: yo, temasColor })
    },
    ir: (pagina) => set({ pagina }),
    setTema: (tema) => set({ tema }),
    temasColor: {},
    setTemaColor: (t) => { const u = get().usuario; if (u) set({ temasColor: { ...get().temasColor, [u.id]: t } }) },
    setPresentacion: (presentacion) => set({ presentacion }),
    setSucursal: (sucursal) => set({ sucursal }),
    guardarEmpresa: (empresa) => { set({ empresa }); log('Datos de empresa actualizados', `${empresa.nombre} · ${empresa.pais} · ${empresa.moneda}`) },
    guardarSucursal: (s, idAnterior) => {
      const id = s.id.trim().toUpperCase()
      if (!id || !s.nombre.trim() || !s.ciudad.trim()) return 'Código, nombre y ciudad son obligatorios'
      const lista = get().sucursales, previa = idAnterior ?? (lista.some((x) => x.id === id) ? id : undefined)
      if (lista.some((x) => x.id === id && x.id !== previa)) return `Ya existe una sucursal con el código ${id}`
      const tope = limitesDe(get().licencia?.plan).sucursales
      if (!previa && tope !== null && lista.length >= tope) return `Su plan ${get().licencia?.plan} permite ${tope === 1 ? '1 sucursal' : `${tope} sucursales`}. Mejore su plan en Configuración → Cuenta y equipo para agregar más.`
      const nueva = { ...s, id }
      let { productos, movimientos, ordenes } = get()
      if (previa && previa !== id) { // cambio de código: se renombra en todo el historial
        productos = productos.map((p) => { const st = { ...p.stock }; if (previa in st) { st[id] = st[previa]; delete st[previa] } return { ...p, stock: st } })
        movimientos = movimientos.map((m) => (m.sucursal === previa ? { ...m, sucursal: id } : m))
        ordenes = ordenes.map((o) => (o.sucursal === previa ? { ...o, sucursal: id } : o))
      }
      set({ sucursales: previa ? lista.map((x) => (x.id === previa ? nueva : x)) : [...lista, nueva], productos, movimientos, ordenes })
      log(previa ? 'Sucursal editada' : 'Sucursal creada', `${id} · ${s.nombre} (${s.ciudad}, ${s.pais})`, id)
      return null
    },
    eliminarSucursal: (id) => {
      const u = get().productos.reduce((a, p) => a + (p.stock[id] ?? 0), 0)
      if (u > 0) return `La sucursal aún tiene ${u} unidades en stock. Transfiéralas antes de eliminarla.`
      if (get().ordenes.some((o) => o.sucursal === id && o.estado !== 'Recibida')) return 'Tiene órdenes de compra pendientes'
      if (get().sucursales.length <= 1) return 'Debe existir al menos una sucursal'
      set({ sucursales: get().sucursales.filter((x) => x.id !== id), productos: get().productos.map((p) => { const st = { ...p.stock }; delete st[id]; return { ...p, stock: st } }), sucursal: get().sucursal === id ? 'TODAS' : get().sucursal })
      log('Sucursal eliminada', id); return null
    },
    guardarProducto: (p) => {
      const prev = get().productos.find((x) => x.id === p.id)
      set({ productos: prev ? get().productos.map((x) => (x.id === p.id ? p : x)) : [...get().productos, p], movimientos: [...get().movimientos, ...difStock(p, prev, prev ? 'Edición de producto' : 'Registro inicial')] })
      log(prev ? 'Producto editado' : 'Producto creado', `${p.sku} · ${p.nombre}`)
    },
    eliminarProducto: (id) => { const p = get().productos.find((x) => x.id === id); set({ productos: get().productos.filter((x) => x.id !== id) }); log('Producto eliminado', `${p?.sku} · ${p?.nombre}`) },
    guardarProveedor: (p) => {
      if (!p.nombre.trim()) return 'El nombre es obligatorio'
      const existe = get().proveedores.some((x) => x.id === p.id)
      set({ proveedores: existe ? get().proveedores.map((x) => (x.id === p.id ? p : x)) : [...get().proveedores, p] })
      log(existe ? 'Proveedor editado' : 'Proveedor creado', p.nombre); return null
    },
    eliminarProveedor: (id) => {
      if (get().ordenes.some((o) => o.proveedorId === id && o.estado !== 'Recibida')) return 'Tiene órdenes de compra pendientes'
      const p = get().proveedores.find((x) => x.id === id)
      set({ proveedores: get().proveedores.filter((x) => x.id !== id) }); log('Proveedor eliminado', p?.nombre ?? ''); return null
    },
    transferir: (productoId, de, a, cantidad) => {
      const p = get().productos.find((x) => x.id === productoId)
      if (!p || cantidad <= 0) return 'Cantidad inválida'
      if (de === a) return 'Origen y destino deben ser distintos'
      if ((p.stock[de] ?? 0) < cantidad) return `Stock insuficiente en ${de} (${p.stock[de] ?? 0} u)`
      const np = { ...p, stock: { ...p.stock, [de]: (p.stock[de] ?? 0) - cantidad, [a]: (p.stock[a] ?? 0) + cantidad } }
      set({
        productos: get().productos.map((x) => (x.id === p.id ? np : x)),
        movimientos: [...get().movimientos, mov({ productoId, sucursal: de, tipo: 'Transferencia', cantidad: -cantidad, costoUnit: p.costo, nota: `Hacia ${a}` }), mov({ productoId, sucursal: a, tipo: 'Transferencia', cantidad, costoUnit: p.costo, nota: `Desde ${de}` })],
      })
      log('Transferencia', `${cantidad} u de ${p.nombre}: ${de} → ${a}`, de)
      return null
    },
    registrar: (productoId, s, tipo, cantidad, nota, costoUnit) => {
      const p = get().productos.find((x) => x.id === productoId)
      if (!p || !cantidad) return 'Cantidad inválida'
      const q = tipo === 'Venta' || tipo === 'Merma' ? -Math.abs(cantidad) : tipo === 'Compra' ? Math.abs(cantidad) : cantidad
      if ((p.stock[s] ?? 0) + q < 0) return `Stock insuficiente en ${s} (${p.stock[s] ?? 0} u)`
      const cu = tipo === 'Compra' && costoUnit ? costoUnit : p.costo
      // Compra: el costo del producto pasa a ser el promedio ponderado.
      const costo = tipo === 'Compra' ? (total(p) * p.costo + q * cu) / (total(p) + q) : p.costo
      set({ productos: get().productos.map((x) => (x.id === p.id ? { ...p, costo: Math.round(costo * 10000) / 10000, stock: { ...p.stock, [s]: (p.stock[s] ?? 0) + q } } : x)), movimientos: [...get().movimientos, mov({ productoId, sucursal: s, tipo, cantidad: q, costoUnit: cu, ...(tipo === 'Venta' ? { precioUnit: p.precio } : {}), nota })] })
      log(tipo, `${q > 0 ? '+' : ''}${q} u de ${p.nombre}${nota ? ' · ' + nota : ''}`, s)
      return null
    },
    crearOrden: (o) => {
      const id = `OC-${1001 + get().ordenes.length}`
      set({ ordenes: [...get().ordenes, { ...o, id, fecha: sello(), estado: 'Borrador', creadaPor: get().usuario?.nombre ?? '' }] })
      log('Orden de compra creada', id, o.sucursal)
    },
    avanzarOrden: (id) => {
      const o = get().ordenes.find((x) => x.id === id); if (!o || o.estado === 'Recibida') return
      const sig: EstadoOC = o.estado === 'Borrador' ? 'Aprobada' : 'Recibida'
      let productos = get().productos, movimientos = get().movimientos
      if (sig === 'Recibida') {
        productos = productos.map((p) => { const it = o.items.find((i) => i.productoId === p.id); if (!it) return p; const t = total(p); return { ...p, costo: Math.round(((t * p.costo + it.cantidad * it.costo) / (t + it.cantidad)) * 10000) / 10000, stock: { ...p.stock, [o.sucursal]: (p.stock[o.sucursal] ?? 0) + it.cantidad } } })
        movimientos = [...movimientos, ...o.items.map((it) => mov({ productoId: it.productoId, sucursal: o.sucursal, tipo: 'Compra', cantidad: it.cantidad, costoUnit: it.costo, nota: id }))]
      }
      set({ ordenes: get().ordenes.map((x) => (x.id === id ? { ...x, estado: sig } : x)), productos, movimientos })
      log(`Orden ${sig.toLowerCase()}`, id, o.sucursal)
    },
    vaciarDatos: () => { set({ ...VACIO }); log('Datos vaciados', 'Se eliminaron productos, movimientos, órdenes, ventas, gastos y cierres') },
    importarProductos: (filas) => {
      let productos = [...get().productos]
      const movs: Movimiento[] = []
      let nuevos = 0, actualizados = 0
      for (const f of filas) {
        const prev = productos.find((p) => p.sku.toLowerCase() === f.sku.toLowerCase())
        const p: Producto = { id: prev?.id ?? `P${Date.now()}${nuevos}`, proveedorId: prev?.proveedorId ?? '', ...f }
        movs.push(...difStock(p, prev, 'Importado desde Excel'))
        if (prev) { productos = productos.map((x) => (x.id === prev.id ? p : x)); actualizados++ } else { productos.push(p); nuevos++ }
      }
      set({ productos, movimientos: [...get().movimientos, ...movs] })
      log('Importación de productos', `${nuevos} nuevos · ${actualizados} actualizados`)
      return { nuevos, actualizados }
    },
    guardarUsuario: (u) => {
      const lista = get().usuarios
      if (!u.nombre.trim() || !u.usuario.trim() || !u.clave) return 'Nombre, usuario y contraseña son obligatorios'
      if (lista.some((x) => x.id !== u.id && x.usuario.toLowerCase() === u.usuario.toLowerCase())) return 'Ese nombre de usuario ya existe'
      const existe = lista.some((x) => x.id === u.id)
      const nueva = existe ? lista.map((x) => (x.id === u.id ? u : x)) : [...lista, u]
      if (!nueva.some((x) => rolesDe(x).includes('Gerente General'))) return 'Debe quedar al menos un Gerente General'
      set({ usuarios: nueva, usuario: get().usuario?.id === u.id ? u : get().usuario })
      log(existe ? 'Usuario editado' : 'Usuario creado', `${u.nombre} (${rolesDe(u).join(', ')})`)
      return null
    },
    eliminarUsuario: (id) => {
      if (get().usuario?.id === id) return 'No puede eliminar su propio usuario'
      const u = get().usuarios.find((x) => x.id === id)
      const nueva = get().usuarios.filter((x) => x.id !== id)
      if (!nueva.some((x) => rolesDe(x).includes('Gerente General'))) return 'Debe quedar al menos un Gerente General'
      set({ usuarios: nueva }); log('Usuario eliminado', `${u?.nombre}`)
      return null
    },
    respaldo: () => { const s = get(); return { empresa: s.empresa, sucursales: s.sucursales, proveedores: s.proveedores, productos: s.productos, movimientos: s.movimientos, ordenes: s.ordenes, auditoria: s.auditoria, usuarios: s.usuarios, gastos: s.gastos, cierres: s.cierres, ventas: s.ventas, tareas: s.tareas, notas: s.notas, clientes: s.clientes } },
    registrarVenta: (v) => {
      const { productos } = get()
      // Productos del inventario y servicios u otros ingresos (sin producto: no tocan el stock)
      const lineas = v.lineas.filter((l) => (l.productoId || l.concepto?.trim()) && l.cantidad > 0)
      if (!lineas.length) return 'Agregue al menos un producto o servicio con cantidad'
      const conProducto = lineas.filter((l) => l.productoId)
      const pide = new Map<string, number>() // unidades por producto (puede repetirse en varias líneas)
      for (const l of conProducto) pide.set(l.productoId, (pide.get(l.productoId) ?? 0) + l.cantidad)
      for (const [pid, q] of pide) {
        const p = productos.find((x) => x.id === pid)
        if (!p) return 'Producto no encontrado'
        if ((p.stock[v.sucursal] ?? 0) < q) return `Stock insuficiente de ${p.nombre} en ${v.sucursal} (hay ${p.stock[v.sucursal] ?? 0} u)`
      }
      const subtotal = lineas.reduce((a, l) => a + l.cantidad * l.precio, 0)
      const descuento = Math.min(Math.max(0, v.descuento), subtotal)
      const factor = subtotal ? 1 - descuento / subtotal : 1 // el descuento se reparte entre las líneas
      const id = `V-${1001 + get().ventas.length}`, usuario = get().usuario?.nombre ?? 'Sistema'
      const lin: LineaVenta[] = lineas.map((l) => l.productoId
        ? { productoId: l.productoId, cantidad: l.cantidad, precio: l.precio, costo: productos.find((x) => x.id === l.productoId)!.costo }
        : { productoId: '', concepto: l.concepto!.trim(), cantidad: l.cantidad, precio: l.precio, costo: Math.max(0, l.costo ?? 0) })
      const movs: Movimiento[] = lin.filter((l) => l.productoId).map((l) => ({ id: crypto.randomUUID(), fecha: v.fecha, productoId: l.productoId, sucursal: v.sucursal, tipo: 'Venta', cantidad: -l.cantidad, costoUnit: l.costo, precioUnit: l.precio * factor, pedido: id, usuario, nota: `${id}${v.cliente.trim() ? ' · ' + v.cliente.trim() : ''}` }))
      set({
        productos: productos.map((p) => (pide.has(p.id) ? { ...p, stock: { ...p.stock, [v.sucursal]: (p.stock[v.sucursal] ?? 0) - pide.get(p.id)! } } : p)),
        movimientos: [...get().movimientos, ...movs],
        ventas: [...get().ventas, { id, fecha: v.fecha, sucursal: v.sucursal, lineas: lin, descuento, total: subtotal - descuento, costoTotal: lin.reduce((a, l) => a + l.cantidad * l.costo, 0), cliente: v.cliente.trim(), canal: v.canal, estado: v.estado, usuario }],
      })
      const servicios = lin.filter((l) => !l.productoId).length
      log('Venta registrada', `${id} · ${conProducto.reduce((a, l) => a + l.cantidad, 0)} u${servicios ? ` + ${servicios} servicio(s)` : ''} · ${(subtotal - descuento).toFixed(2)}${v.cliente.trim() ? ' · ' + v.cliente.trim() : ''}`, v.sucursal)
      return null
    },
    cambiarEstadoVenta: (id, estado) => { set({ ventas: get().ventas.map((x) => (x.id === id && x.estado !== 'Anulada' ? { ...x, estado } : x)) }); log('Venta actualizada', `${id} · ${estado}`) },
    anularVenta: (id) => {
      const v = get().ventas.find((x) => x.id === id)
      if (!v || v.estado === 'Anulada') return 'La venta ya está anulada'
      const factor = v.total + v.descuento ? v.total / (v.total + v.descuento) : 1, usuario = get().usuario?.nombre ?? 'Sistema'
      // Devolución con la misma fecha de la venta: el stock regresa y la venta deja de contar en ese periodo.
      const movs: Movimiento[] = v.lineas.filter((l) => l.productoId).map((l) => ({ id: crypto.randomUUID(), fecha: v.fecha, productoId: l.productoId, sucursal: v.sucursal, tipo: 'Venta', cantidad: l.cantidad, costoUnit: l.costo, precioUnit: l.precio * factor, pedido: id, usuario, nota: `Anulación ${id}` }))
      const vuelve = new Map<string, number>()
      for (const l of v.lineas) if (l.productoId) vuelve.set(l.productoId, (vuelve.get(l.productoId) ?? 0) + l.cantidad)
      set({
        productos: get().productos.map((p) => (vuelve.has(p.id) ? { ...p, stock: { ...p.stock, [v.sucursal]: (p.stock[v.sucursal] ?? 0) + vuelve.get(p.id)! } } : p)),
        movimientos: [...get().movimientos, ...movs.filter((m) => get().productos.some((p) => p.id === m.productoId))],
        ventas: get().ventas.map((x) => (x.id === id ? { ...x, estado: 'Anulada' } : x)),
      })
      log('Venta anulada', `${id} · el stock regresó a ${v.sucursal}`, v.sucursal)
      return null
    },
    guardarCliente: (c) => { const existe = get().clientes.some((x) => x.id === c.id); set({ clientes: existe ? get().clientes.map((x) => (x.id === c.id ? c : x)) : [...get().clientes, c] }); log(existe ? 'Cliente editado' : 'Cliente creado', c.nombre) },
    eliminarCliente: (id) => { const c = get().clientes.find((x) => x.id === id); set({ clientes: get().clientes.filter((x) => x.id !== id) }); log('Cliente eliminado', c?.nombre ?? id) },
    guardarConexiones: (c) => { set({ empresa: { ...get().empresa, conexiones: c } }); log('Conexiones actualizadas', Object.keys(c).filter((k) => c[k]).join(', ') || 'ninguna') },
    importarPersonas: (lista, usuarioDe) => {
      let equipo = 0, clientes = 0, proveedores = 0
      const usuarios = [...get().usuarios], provs = [...get().proveedores], clis = [...get().clientes]
      for (const x of lista) {
        if (x.tipo === 'equipo') {
          const usuario = usuarioDe(x.nombre, usuarios.map((u) => u.usuario))
          const partes = x.nombre.split(' ')
          usuarios.push({ id: crypto.randomUUID(), nombre: x.nombre, nombres: partes.slice(0, Math.ceil(partes.length / 2)).join(' '), apellidos: partes.slice(Math.ceil(partes.length / 2)).join(' '), usuario, clave: `${usuario}2026`, rol: 'Ayudante', email: x.email, telefono: x.telefono, cargo: x.cargo })
          equipo++
        } else if (x.tipo === 'proveedor') {
          provs.push({ id: crypto.randomUUID(), nombre: x.empresa || x.nombre, ruc: '', ciudad: '', contacto: x.empresa ? x.nombre : '', telefono: x.telefono, email: x.email, cumplimiento: 100, indicePrecio: 1 }); proveedores++
        } else { clis.push({ id: crypto.randomUUID(), nombre: x.nombre, email: x.email, telefono: x.telefono, empresa: x.empresa, nota: x.cargo }); clientes++ }
      }
      set({ usuarios, proveedores: provs, clientes: clis })
      log('Contactos importados', `${equipo} al equipo · ${clientes} clientes · ${proveedores} proveedores`)
      return { equipo, clientes, proveedores }
    },
    guardarTarea: (t) => {
      const prev = get().tareas.find((x) => x.id === t.id), ahora = sello()
      set({ tareas: prev ? get().tareas.map((x) => (x.id === t.id ? { ...t, actualizada: ahora } : x)) : [...get().tareas, { ...t, creada: ahora, actualizada: ahora }] })
      const nombres = t.asignados.map((id) => get().usuarios.find((u) => u.id === id)?.nombre.split(' ')[0]).filter(Boolean).join(', ')
      log(prev ? 'Tarea editada' : 'Tarea creada', `${t.titulo}${nombres ? ' → ' + nombres : ''}`)
    },
    moverTarea: (id, estado, antesDe) => {
      const t = get().tareas.find((x) => x.id === id); if (!t) return
      // Orden dentro de la columna: se coloca antes de "antesDe" o al final
      const col = get().tareas.filter((x) => x.estado === estado && x.id !== id).sort((a, b) => a.orden - b.orden)
      const i = antesDe ? col.findIndex((x) => x.id === antesDe) : -1
      const orden = i < 0 ? (col[col.length - 1]?.orden ?? 0) + 1 : i === 0 ? col[0].orden - 1 : (col[i - 1].orden + col[i].orden) / 2
      set({ tareas: get().tareas.map((x) => (x.id === id ? { ...x, estado, orden, actualizada: sello() } : x)) })
      if (t.estado !== estado) log('Tarea movida', `${t.titulo} → ${{ pendiente: 'Pendiente', progreso: 'En progreso', hecho: 'Hecho', archivado: 'Archivado' }[estado]}`)
    },
    eliminarTarea: (id) => { const t = get().tareas.find((x) => x.id === id); set({ tareas: get().tareas.filter((x) => x.id !== id) }); log('Tarea eliminada', t?.titulo ?? id) },
    guardarNota: (n) => set({ notas: get().notas.some((x) => x.id === n.id) ? get().notas.map((x) => (x.id === n.id ? { ...n, actualizada: sello() } : x)) : [{ ...n, actualizada: sello() }, ...get().notas] }),
    eliminarNota: (id) => { const n = get().notas.find((x) => x.id === id); set({ notas: get().notas.filter((x) => x.id !== id) }); log('Nota eliminada', n?.titulo || 'Sin título') },
    guardarGasto: (g) => {
      const existe = get().gastos.some((x) => x.id === g.id)
      set({ gastos: existe ? get().gastos.map((x) => (x.id === g.id ? g : x)) : [...get().gastos, g] })
      log(existe ? 'Gasto editado' : 'Gasto registrado', `${g.concepto} · ${g.categoria} · ${g.monto.toFixed(2)}`, g.sucursal || '—')
    },
    eliminarGasto: (id) => { const g = get().gastos.find((x) => x.id === id); set({ gastos: get().gastos.filter((x) => x.id !== id) }); log('Gasto eliminado', g ? `${g.concepto} · ${g.monto.toFixed(2)}` : id) },
    cerrarPeriodo: (c) => {
      const existe = get().cierres.some((x) => x.id === c.id)
      set({ cierres: [...get().cierres.filter((x) => x.id !== c.id), c] })
      log(existe ? 'Cierre actualizado' : 'Cierre de periodo', `${c.id} · ganancia neta ${c.neta.toFixed(2)}`)
    },
    quitarCierre: (id) => { set({ cierres: get().cierres.filter((x) => x.id !== id) }); log('Cierre quitado', id) },
    // Respaldos anteriores no traen gastos ni cierres: se dejan vacíos.
    restaurar: (d) => { set({ ...d, gastos: d.gastos ?? [], cierres: d.cierres ?? [], ventas: d.ventas ?? [], tareas: d.tareas ?? [], notas: d.notas ?? [], clientes: d.clientes ?? [] }); log('Respaldo restaurado', `${d.productos.length} productos`) },
  }
}, {
  name: 'nexora-app', version: 6,
  storage: createJSONStorage(() => almacen),
  partialize: (s) => ({ ...s, presentacion: false }),
  migrate: (old, v) => {
    let o = (old ?? {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    if (v < 3) return { tema: o.tema ?? 'oscuro' } as unknown as AppState // v3: sin datos de demostración
    if (v < 4) o = { // v4: empresa global y sucursales ilimitadas
      ...o,
      empresa: { ...EMPRESA_BASE, nombre: o.empresa?.nombre ?? '', idFiscal: o.empresa?.ruc ?? '', telefono: o.empresa?.telefono ?? '' },
      sucursales: (o.sucursales ?? []).map((x: Sucursal, i: number) => ({ ...x, tipo: i === 0 ? 'Matriz' : 'Sucursal', pais: 'EC', activa: true })),
    }
    if (v < 6) { // v6: se quitan los usuarios de demostración del equipo del proyecto (sus contraseñas eran públicas)
      const demo = (u: Usuario | null | undefined) => !!u && EQUIPO_DEMO.includes(u.id)
      o = { ...o, usuarios: ((o.usuarios ?? []) as Usuario[]).filter((u) => !demo(u)), usuario: demo(o.usuario) ? null : o.usuario ?? null }
    }
    return o as unknown as AppState
  },
}))

/** ¿Ya se cargaron los datos guardados? (IndexedDB es asíncrono) */
export const hidratado = () => useApp.persist.hasHydrated()
