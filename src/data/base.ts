/** Tipos de datos de NEXORA. El sistema arranca SIN datos de demostración: cada empresa registra los suyos. */
/** Código libre de sucursal (ej. "GYE-01", "BOG", "MAD-CD"). Sucursales ilimitadas, en cualquier país. */
export type SucursalId = string
export type TipoSucursal = 'Matriz' | 'Sucursal' | 'Bodega' | 'Centro de distribución' | 'Tienda'
export const TIPOS_SUCURSAL: TipoSucursal[] = ['Matriz', 'Sucursal', 'Bodega', 'Centro de distribución', 'Tienda']
export interface Sucursal { id: SucursalId; nombre: string; tipo: TipoSucursal; pais: string; ciudad: string; direccion: string; lat: number; lng: number; activa: boolean }
export interface Proveedor { id: string; nombre: string; ruc: string; ciudad: string; contacto: string; telefono: string; email: string; cumplimiento: number; indicePrecio: number }
/** pais = código ISO 3166 (EC, CO, US…); moneda = ISO 4217 (USD, COP, EUR…) usada para costos y reportes. */
export interface Empresa { nombre: string; idFiscal: string; pais: string; moneda: string; sector: string; tamano?: string; telefono: string; configurada: boolean; /** Enlaces al espacio de trabajo de la empresa (Discord, Slack, Notion…) */ conexiones?: Record<string, string> }
export interface Producto {
  id: string; sku: string; nombre: string; categoria: string; costo: number; precio: number
  /** unidades por sucursal: { [códigoSucursal]: unidades } */
  stock: Record<SucursalId, number>; min: number; max: number; lote: string; vence: string; proveedorId: string
}
export type TipoMov = 'Saldo inicial' | 'Compra' | 'Venta' | 'Transferencia' | 'Ajuste' | 'Merma'
/** cantidad con signo: + entra a la sucursal, − sale. */
/** precioUnit: precio de venta con el que se vendió (solo ventas); si falta, se usa el precio actual del producto. pedido: venta (V-1001) a la que pertenece. */
export interface Movimiento { id: string; fecha: string; productoId: string; sucursal: SucursalId; tipo: TipoMov; cantidad: number; costoUnit: number; precioUnit?: number; pedido?: string; usuario: string; nota?: string }
export type EstadoOC = 'Borrador' | 'Aprobada' | 'Recibida'
export interface Orden { id: string; proveedorId: string; sucursal: SucursalId; fecha: string; estado: EstadoOC; items: { productoId: string; cantidad: number; costo: number }[]; creadaPor: string }
/** Gasto del negocio (arriendo, sueldos, luz…). fecha = AAAA-MM-DD; sucursal vacía = gasto general de la empresa. */
export interface Gasto { id: string; fecha: string; concepto: string; categoria: string; monto: number; sucursal: SucursalId | ''; nota?: string }
export const CANALES = ['En persona', 'WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'Tienda web', 'Otro']
export type EstadoVenta = 'Pagada' | 'Por cobrar' | 'Anulada'
/** Venta con una o varias líneas; cada línea descuenta stock y deja un movimiento "Venta" en el kardex. total = subtotal − descuento. */
export interface Venta { id: string; fecha: string; sucursal: SucursalId; lineas: { productoId: string; cantidad: number; precio: number; costo: number }[]; descuento: number; total: number; costoTotal: number; cliente: string; canal: string; estado: EstadoVenta; usuario: string }
/** Espacio de trabajo (estilo Notion): tablero de tareas del equipo y notas con bloques. */
export type EstadoTarea = 'pendiente' | 'progreso' | 'hecho' | 'archivado'
export type Prioridad = 'alta' | 'media' | 'baja'
export interface Tarea { id: string; titulo: string; descripcion: string; estado: EstadoTarea; prioridad: Prioridad; vence: string; asignados: string[]; etiquetas: string[]; color: string; creadoPor: string; creada: string; actualizada: string; orden: number }
export type TipoBloque = 'texto' | 'h1' | 'h2' | 'lista' | 'tarea' | 'cita' | 'codigo' | 'separador' | 'enlace'
export interface Bloque { id: string; tipo: TipoBloque; texto: string; hecho?: boolean }
export interface Nota { id: string; titulo: string; icono: string; carpeta: string; fijada: boolean; color: string; bloques: Bloque[]; creadoPor: string; actualizada: string }
/** Cierre de mes (mes 0-11) o de año (mes = -1): foto fija de los números consolidados en ese momento. */
export interface Cierre { id: string; anio: number; mes: number; ventas: number; costo: number; gastos: number; neta: number; unidades: number; stockUnidades: number; stockValor: number; cerradoEl: string; cerradoPor: string }
export interface Evento { id: string; fecha: string; usuario: string; accion: string; detalle: string; sucursal: SucursalId | '—' }

export const EMPRESA_BASE: Empresa = { nombre: '', idFiscal: '', pais: 'EC', moneda: 'USD', sector: '', tamano: '', telefono: '', configurada: false }
/** Cualquier tipo de negocio, en cualquier país. */
export const SECTORES = ['Agricultura y agroindustria', 'Alimentos y bebidas', 'Arquitectura e ingeniería', 'Artesanías / emprendimiento creativo', 'Automotriz / repuestos', 'Belleza y cuidado personal', 'Comercio / distribución', 'Construcción / ferretería', 'E-commerce / tienda en línea', 'Educación', 'Farmacéutico', 'Importación / exportación', 'Industria / manufactura', 'Logística', 'Moda y textil', 'Restaurantes y cafeterías', 'Retail / supermercados', 'Salud', 'Servicios', 'Servicios profesionales', 'Software y servicios digitales', 'Tecnología', 'Turismo y hotelería', 'Otro']
/** Tamaño del negocio: de un emprendimiento a una multinacional. */
export const TAMANOS = ['Emprendimiento', 'Microempresa (1 a 9 personas)', 'Pequeña empresa (10 a 49)', 'Mediana empresa (50 a 199)', 'Gran empresa (200 o más)', 'Multinacional']
/** Categorías sugeridas (se pueden escribir otras). */
export const CATEGORIAS = ['Alimentos y bebidas', 'Limpieza y hogar', 'Cuidado personal', 'Tecnología', 'Papelería y oficina', 'Ferretería', 'Repuestos', 'Farmacia', 'Textil', 'Materia prima']
