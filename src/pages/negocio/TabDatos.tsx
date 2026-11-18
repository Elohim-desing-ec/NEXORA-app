import { useRef, useState } from 'react'
import { Eraser, FileSpreadsheet, HardDriveDownload, HardDriveUpload, Save } from 'lucide-react'
import { useApp, tieneRol } from '../../store/useApp'
import { Button, Card } from '../../components/ui'
import { num } from '../../lib/format'
import { stockTotal } from '../../lib/inventario'
import { exportarLibro } from '../../lib/export'
import { cargarRespaldo, descargarRespaldo } from '../../lib/respaldo'
import { MESES, agregar, anios, estadoStock, filasVentas, nombrePeriodo, statsProductos } from '../../lib/resumen'
import { pedirEliminar } from '../../components/Eliminacion'

const r2 = (v: number) => Math.round(v * 100) / 100
type Filas = (string | number)[][]

export default function TabDatos() {
  const app = useApp()
  const { productos, movimientos, ventas, gastos, cierres, sucursales, usuario, vaciarDatos } = app
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [msg, setMsg] = useState('')
  const archivo = useRef<HTMLInputElement>(null)

  const hojaInventario = (): Filas => {
    const stats = statsProductos(movimientos, productos)
    return [['Código', 'Producto', 'Categoría', 'Costo', 'Precio', 'Ganancia por unidad', 'Margen %', ...sucursales.map((s) => `Stock ${s.id}`), 'Stock total', 'Vendidas', 'Ganancia generada', 'Valor del stock', 'Estado'],
      ...productos.map((p) => { const s = stats.get(p.id); return [p.sku, p.nombre, p.categoria, p.costo, p.precio, r2(p.precio - p.costo), p.precio ? r2(((p.precio - p.costo) / p.precio) * 100) : 0, ...sucursales.map((x) => p.stock[x.id] ?? 0), stockTotal(p), s?.vendidas ?? 0, r2(s?.ganancia ?? 0), r2(stockTotal(p) * p.costo), estadoStock(p)] })]
  }
  const hojaVentas = (): Filas => [['N.º', 'Fecha', 'Cliente', 'Productos o servicios', 'Sucursal', 'Canal', 'Estado', 'Unidades', 'Total', 'Ganancia'],
    ...filasVentas(ventas, movimientos, productos).map((f) => [f.id, new Date(f.fecha).toLocaleString('es-EC'), f.cliente, f.detalle, f.sucursal, f.canal, f.estado, f.unidades, r2(f.total), r2(f.ganancia)])]
  const hojaGastos = (): Filas => [['Fecha', 'Concepto', 'Categoría', 'Sucursal', 'Monto', 'Nota'],
    ...[...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((g) => [g.fecha, g.concepto, g.categoria, g.sucursal || 'General', g.monto, g.nota ?? ''])]
  const hojaResumen = (): Filas => {
    const fila = (n: string, m: number) => { const a = agregar(movimientos, productos, gastos, anio, m, 'TODAS', ventas); return [n, r2(a.ventas), r2(a.costo), r2(a.bruta), r2(a.gastos), r2(a.neta), r2(a.margen * 100), a.unidades] }
    return [['Mes', 'Ventas', 'Costo', 'Ganancia bruta', 'Gastos', 'Ganancia neta', 'Margen neto %', 'Unidades'], ...MESES.map((m, i) => fila(m, i)), fila(`Total ${anio}`, -1)]
  }
  const hojaCierres = (): Filas => [['Periodo', 'Ventas', 'Costo', 'Gastos', 'Ganancia neta', 'Unidades', 'Stock al cierre', 'Valor del stock', 'Cerrado el', 'Cerrado por'],
    ...[...cierres].sort((a, b) => a.id.localeCompare(b.id)).map((c) => [nombrePeriodo(c.anio, c.mes), r2(c.ventas), r2(c.costo), r2(c.gastos), r2(c.neta), c.unidades, c.stockUnidades, r2(c.stockValor), new Date(c.cerradoEl).toLocaleString('es-EC'), c.cerradoPor])]

  const excel = () => exportarLibro(`Negocio_${anio}`, [['Inventario', hojaInventario()], ['Ventas', hojaVentas()], ['Gastos', hojaGastos()], [`Resumen ${anio}`, hojaResumen()], ['Cierres', hojaCierres()]])
  const cargar = async (f: File) => {
    const r = await cargarRespaldo(f)
    if (r === 'ok') setMsg('Respaldo restaurado correctamente.')
    else if (r === 'invalido') alert('El archivo no es un respaldo válido de NEXORA.')
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card titulo={<span className="flex items-center gap-2"><Save size={15} className="text-primario" />Guardado automático</span>}>
        <p className="text-sm text-muted">Todo se guarda solo en este navegador, al instante. Si usa otra computadora o borra los datos del navegador, use el respaldo.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">{([['Productos', productos.length], ['Ventas', ventas.length], ['Gastos', gastos.length], ['Cierres', cierres.length], ['Movimientos', movimientos.length], ['Sucursales', sucursales.length]] as const).map(([a, b]) => (
          <div key={a} className="rounded-xl bg-fg/5 p-3"><div className="text-xs text-muted">{a}</div><div className="text-lg font-bold tnum">{num(b, 0)}</div></div>))}</div>
      </Card>

      <Card titulo={<span className="flex items-center gap-2"><HardDriveDownload size={15} className="text-primario" />Respaldo completo</span>}>
        <p className="mb-4 text-sm text-muted">Un archivo con todo: inventario, ventas, gastos, cierres, usuarios y análisis económico. Guárdelo en su Drive o correo una vez al mes, y úselo para pasar sus datos a otra computadora.</p>
        <div className="flex flex-wrap gap-2"><Button variante="primario" onClick={descargarRespaldo}><HardDriveDownload size={15} />Exportar respaldo</Button><Button onClick={() => archivo.current?.click()}><HardDriveUpload size={15} />Importar respaldo</Button></div>
        <input ref={archivo} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) cargar(f); e.target.value = '' }} />
        {msg && <p className="mt-3 text-sm text-exito">{msg}</p>}
      </Card>

      <Card titulo={<span className="flex items-center gap-2"><FileSpreadsheet size={15} className="text-primario" />Excel y CSV</span>}>
        <p className="mb-4 text-sm text-muted">El Excel trae cinco hojas: Inventario, Ventas, Gastos, Resumen mes a mes del año elegido y Cierres.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="inp w-auto" aria-label="Año del resumen" value={anio} onChange={(e) => setAnio(+e.target.value)}>{anios(movimientos, gastos, cierres).map((y) => <option key={y}>{y}</option>)}</select>
          <Button variante="primario" onClick={excel}><FileSpreadsheet size={15} />Exportar a Excel</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="text-xs" onClick={() => exportarLibro('Ventas', [['Ventas', hojaVentas()]], 'csv')}>CSV ventas</Button>
          <Button className="text-xs" onClick={() => exportarLibro('Gastos', [['Gastos', hojaGastos()]], 'csv')}>CSV gastos</Button>
          <Button className="text-xs" onClick={() => exportarLibro('Inventario', [['Inventario', hojaInventario()]], 'csv')}>CSV inventario</Button>
        </div>
      </Card>

      {tieneRol(usuario, 'Gerente General') && <Card titulo={<span className="flex items-center gap-2"><Eraser size={15} className="text-peligro" />Empezar de cero</span>}>
        <p className="mb-4 text-sm text-muted">Borra productos, movimientos, órdenes, ventas, gastos y cierres para comenzar un inventario nuevo. Usuarios, sucursales, proveedores y empresa se conservan. Exporte un respaldo antes.</p>
        <Button variante="peligro" onClick={() => pedirEliminar({ titulo: '¿Borrar todos los datos?', detalle: 'Se borran productos, ventas, gastos y cierres. Quedan en la Papelera por si los necesita.', boton: 'Borrar todo', listo: 'Datos borrados', accion: () => { vaciarDatos(); setMsg('Datos borrados. Puede empezar de cero.') } })}><Eraser size={15} />Borrar todo</Button>
      </Card>}
    </div>
  )
}
