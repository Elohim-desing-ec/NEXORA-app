import { lazy, Suspense, useRef, useState } from 'react'
import { CreditCard, Database, Download, Eraser, FileUp, Pencil, Plus, Trash2, Users, BookOpen, ArrowRight, Building2, Save, HardDriveDownload, HardDriveUpload, Palette, Check } from 'lucide-react'
import { useApp, ROLES, type Usuario, type FilaImport, rolesDe, MAX_ROLES, SOLO_LECTURA, esCuenta, type Rol } from '../store/useApp'
import { SelectorRoles, seccionesQueVe } from '../components/SelectorRoles'
import { guardarMiembro, mensajeError, quitarMiembro } from '../lib/cuenta'
import { useTx } from '../lib/idioma'
import { refrescarEquipo } from '../lib/nube'
import { Badge, Button, Campo, Card, Modal, Scroll, Tabs, Titulo, cx } from '../components/ui'
import { descargarPlantilla, leerArchivo } from '../lib/importar'
import { cargarRespaldo, descargarRespaldo } from '../lib/respaldo'
import { perfilDe } from '../lib/sectores'
import { TEMAS } from '../lib/temas'
import { MuestraTema } from '../components/SelectorTema'
import { InstalarApp } from '../components/InstalarApp'
import { money } from '../lib/format'
import { SECTORES, TAMANOS, type Empresa, type Sucursal } from '../data/base'
import { PAISES, MONEDAS, SIMBOLOS, pais } from '../data/paises'
import { EditorSucursal, sucursalVacia } from '../components/EditorSucursal'
import { valorInventario } from '../lib/inventario'
import { pedirEliminar } from '../components/Eliminacion'

const Globo = lazy(() => import('../components/Globo'))
const CuentaEquipo = lazy(() => import('./config/CuentaEquipo'))

const ve = seccionesQueVe

function Usuarios() {
  const { usuarios, usuario, guardarUsuario, eliminarUsuario, licencia } = useApp()
  const tx = useTx()
  const [edit, setEdit] = useState<Usuario | null>(null), [err, setErr] = useState(''), [ocupado, setOcupado] = useState(false)
  /** ¿Es el titular de la cuenta (no se le quita ni se le cambia el rol principal desde aquí)? */
  const esTitular = (u: Usuario) => esCuenta(u) && !!licencia?.esDueno && u.id === usuario?.id
  const guardar = async (u: Usuario) => {
    setErr('')
    if (esCuenta(u) && !esTitular(u)) { // persona del equipo en la nube: el rol se guarda en la nube
      if (!licencia?.esDueno || !licencia.empresaId) return setErr('Solo el titular de la cuenta puede cambiar los roles del equipo.')
      setOcupado(true)
      try { await guardarMiembro(licencia.empresaId, { email: u.email, nombre: u.nombre, rol: u.rol, roles: u.roles ?? [] }) } catch (e) { setOcupado(false); return setErr(mensajeError(e, tx)) }
      setOcupado(false)
    }
    const r = guardarUsuario(u)
    if (r) return setErr(r)
    setEdit(null)
    if (esCuenta(u)) refrescarEquipo()
  }
  const eliminar = (u: Usuario) => {
    if (esTitular(u)) return alert('Usted es el titular de la cuenta: no puede quitarse a sí mismo.')
    pedirEliminar({
      titulo: esCuenta(u) ? `¿Quitar a ${u.nombre} del equipo?` : `¿Eliminar a ${u.nombre}?`, detalle: esCuenta(u) ? 'Ya no podrá ingresar a NEXORA.' : undefined,
      boton: esCuenta(u) ? 'Quitar' : 'Eliminar', listo: esCuenta(u) ? `${u.nombre} ya no está en el equipo` : `${u.nombre} eliminado`,
      accion: async () => {
        if (!esCuenta(u)) return eliminarUsuario(u.id)
        if (!licencia?.esDueno || !licencia.empresaId) return 'Solo el titular de la cuenta puede quitar personas del equipo.'
        try { await quitarMiembro(licencia.empresaId, u.email) } catch (e) { return mensajeError(e, tx) }
        await refrescarEquipo()
      },
    })
  }
  const tono = (r: Rol) => (r === 'Gerente General' || r === 'Mano derecha' ? 'violeta' : SOLO_LECTURA.includes(r) ? 'ambar' : /Financ|Contador/.test(r) ? 'cian' : /Ventas|Vendedor|Cajero|Marketing/.test(r) ? 'verde' : r === 'Ayudante' ? 'gris' : 'azul')
  return <>
    <Card titulo={`Usuarios del sistema (${usuarios.length})`} accion={<Button variante="primario" onClick={() => { setErr(''); setEdit({ id: crypto.randomUUID(), nombre: '', usuario: '', email: '', rol: 'Ayudante', clave: '' }) }}><Plus size={15} />Agregar persona</Button>}>
      <Scroll><table className="tabla"><thead><tr><th>Nombre</th><th>Usuario o correo</th><th>Roles</th><th>Puede ver</th><th /></tr></thead>
        <tbody>{usuarios.map((u) => <tr key={u.id}>
          <td className="font-medium"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-[10px] font-bold text-black">{u.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>{u.nombre}{esCuenta(u) && <Badge tono="verde">Cuenta</Badge>}{u.id === usuario?.id && <Badge tono="verde">Usted</Badge>}</div></td>
          <td className="font-mono text-xs">{esCuenta(u) ? u.email : u.usuario}</td><td><div className="flex flex-wrap gap-1">{rolesDe(u).map((r) => <Badge key={r} tono={tono(r)}>{r}</Badge>)}</div></td>
          <td className="whitespace-normal text-xs text-muted">{ve(u).join(' · ')}</td>
          <td><div className="flex gap-1"><Button variante="fantasma" className="!p-1.5" title="Editar" onClick={() => { setErr(''); setEdit({ ...u }) }}><Pencil size={15} /></Button>
            <Button variante="fantasma" className="!p-1.5 text-peligro" title="Eliminar" onClick={() => eliminar(u)}><Trash2 size={15} /></Button></div></td>
        </tr>)}</tbody></table></Scroll>
      <p className="mt-3 text-xs text-muted">Las personas marcadas «Cuenta» entran con su propio correo desde cualquier celular o computadora; se invitan en «Cuenta y equipo». Las demás entran solo en este dispositivo con usuario y contraseña.</p>
      <p className="mt-1 text-xs text-muted">Cada persona puede tener hasta {MAX_ROLES} roles, según su capacidad: ve la suma de los menús de todos sus roles. Hay {ROLES.length} roles disponibles.</p>
    </Card>
    <Modal abierto={!!edit} onClose={() => setEdit(null)} titulo={usuarios.some((x) => x.id === edit?.id) ? 'Editar usuario' : 'Agregar persona'} ancho="max-w-lg">
      {edit && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); guardar({ ...edit, nombre: edit.nombre.trim(), usuario: edit.usuario.trim().toLowerCase(), email: edit.email.trim() }) }}>
        <Campo label="Nombre completo"><input autoFocus className="inp" value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value, usuario: edit.usuario || '' })} placeholder="Ej.: Ana Mora" /></Campo>
        {esCuenta(edit) ? <p className="rounded-lg bg-fg/5 px-3 py-2 text-xs text-muted">Entra con su cuenta NEXORA (<b className="text-fg">{edit.email}</b>), con Google o con correo y contraseña. No necesita usuario aquí.</p> : <div className="grid grid-cols-2 gap-3">
          <Campo label="Usuario (para ingresar)" ayuda="Corto y sin espacios, ej.: ana"><input className="inp" value={edit.usuario} onChange={(e) => setEdit({ ...edit, usuario: e.target.value.replace(/\s/g, '').toLowerCase() })} /></Campo>
          <Campo label="Contraseña" ayuda="Fácil de recordar, ej.: ana2026"><input className="inp" value={edit.clave} onChange={(e) => setEdit({ ...edit, clave: e.target.value })} /></Campo>
        </div>}
        {esTitular(edit) ? <p className="text-xs text-muted">Usted es el titular de la cuenta: siempre es Gerente General y ve todo.</p> : <SelectorRoles valor={edit} onChange={setEdit} />}
        {!esCuenta(edit) && <Campo label="Correo (opcional)"><input type="email" className="inp" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Campo>}
        {err && <p className="text-sm text-peligro">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" onClick={() => setEdit(null)}>Cancelar</Button><Button variante="primario" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</Button></div>
      </form>}
    </Modal>
  </>
}

export function FormEmpresa({ e, setE }: { e: Empresa; setE: (e: Empresa) => void }) {
  const p = pais(e.pais)
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Campo label="Razón social"><input className="inp" value={e.nombre} onChange={(x) => setE({ ...e, nombre: x.target.value })} placeholder="Ej.: Distribuidora Pacífico S.A." /></Campo>
    <Campo label="País (sede principal)"><select className="inp" value={e.pais} onChange={(x) => { const n = pais(x.target.value); setE({ ...e, pais: x.target.value, moneda: n?.moneda ?? e.moneda }) }}>{PAISES.map((q) => <option key={q.codigo} value={q.codigo}>{q.nombre}</option>)}</select></Campo>
    <Campo label="Moneda de la empresa" ayuda="Costos, precios y reportes"><select className="inp" value={e.moneda} onChange={(x) => setE({ ...e, moneda: x.target.value })}>{MONEDAS.map((m) => <option key={m} value={m}>{m} ({SIMBOLOS[m]})</option>)}</select></Campo>
    <Campo label={`Identificación fiscal (${p?.idFiscal ?? 'ID'})`}><input className="inp" value={e.idFiscal} onChange={(x) => setE({ ...e, idFiscal: x.target.value })} /></Campo>
    <Campo label="Sector"><select className="inp" value={e.sector} onChange={(x) => setE({ ...e, sector: x.target.value })}><option value="">— Elegir —</option>{[...SECTORES, ...(e.sector && !SECTORES.includes(e.sector) ? [e.sector] : [])].map((q) => <option key={q}>{q}</option>)}</select></Campo>
    <Campo label="Tamaño del negocio"><select className="inp" value={e.tamano ?? ''} onChange={(x) => setE({ ...e, tamano: x.target.value })}><option value="">— Elegir —</option>{TAMANOS.map((q) => <option key={q}>{q}</option>)}</select></Campo>
    {e.sector && <div className="rounded-xl border border-primario/25 bg-primario/10 p-3 text-xs sm:col-span-2 lg:col-span-3"><b className="text-primario">NEXORA se adapta a «{perfilDe(e.sector).nombre}»:</b> {perfilDe(e.sector).foco} Categorías sugeridas: {perfilDe(e.sector).categorias.slice(0, 4).join(', ')}… Meta de margen: {Math.round(perfilDe(e.sector).margenMeta * 100)} %.</div>}
    <Campo label="Teléfono"><input className="inp" value={e.telefono} onChange={(x) => setE({ ...e, telefono: x.target.value })} /></Campo>
  </div>
}

function EmpresaTab() {
  const { empresa, sucursales, productos, guardarEmpresa, guardarSucursal, eliminarSucursal } = useApp()
  const [e, setE] = useState<Empresa>(empresa), [ok, setOk] = useState(false)
  const [ed, setEd] = useState<{ v: Sucursal; previa?: string } | null>(null), [err, setErr] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const paises = new Set(sucursales.map((x) => x.pais)).size
  return <>
    <Card titulo="Datos de la empresa" accion={<div className="flex items-center gap-3">{ok && <span className="text-sm text-exito">Guardado</span>}<Button variante="primario" onClick={() => { guardarEmpresa({ ...e, configurada: true }); setOk(true) }}><Save size={15} />Guardar</Button></div>}>
      <FormEmpresa e={e} setE={(x) => { setOk(false); setE(x) }} />
      <p className="mt-3 text-xs text-muted">El nombre aparece en el menú y en el membrete de los reportes. La moneda se usa en todo el sistema.</p>
    </Card>
    <Card titulo={`Red de sucursales · ${sucursales.length} en ${paises} ${paises === 1 ? 'país' : 'países'}`} accion={<Button variante="primario" onClick={() => { setErr(''); setEd({ v: sucursalVacia(empresa.pais) }) }}><Plus size={15} />Agregar sucursal</Button>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Suspense fallback={<div className="espacio h-[380px] rounded-xl xl:col-span-2" />}><Globo className="h-[380px] xl:col-span-2" seleccion={sel} onSeleccion={setSel} puntos={sucursales.map((x) => ({ id: x.id, nombre: `${x.id} · ${x.nombre}`, lat: x.lat, lng: x.lng, valor: valorInventario(productos, x.id) + 1, detalle: `${x.tipo} · ${x.ciudad}, ${pais(x.pais)?.nombre ?? x.pais}` }))} /></Suspense>
        <div className="min-w-0 xl:col-span-3"><Scroll><table className="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Ubicación</th><th className="num">Inventario</th><th /></tr></thead>
          <tbody>{sucursales.map((x) => <tr key={x.id} className={cx(sel === x.id && 'bg-primario/10')} onClick={() => setSel(x.id)}>
            <td className="font-mono text-xs font-semibold">{x.id}</td><td className="font-medium">{x.nombre}</td><td><Badge tono={x.tipo === 'Matriz' ? 'violeta' : 'azul'}>{x.tipo}</Badge></td>
            <td>{x.ciudad}<div className="max-w-[220px] truncate text-[11px] text-muted">{x.direccion}</div></td><td className="num">{money(valorInventario(productos, x.id), 0)}</td>
            <td><div className="flex gap-1"><Button variante="fantasma" className="!p-1.5" title="Editar" onClick={() => { setErr(''); setEd({ v: { ...x }, previa: x.id }) }}><Pencil size={15} /></Button>
              <Button variante="fantasma" className="!p-1.5 text-peligro" title="Eliminar" onClick={() => pedirEliminar({ titulo: `¿Eliminar la sucursal ${x.nombre}?`, detalle: 'Queda en la Papelera por si la necesita.', listo: `Sucursal ${x.nombre} eliminada`, accion: () => eliminarSucursal(x.id) })}><Trash2 size={15} /></Button></div></td>
          </tr>)}</tbody></table></Scroll>
          {!sucursales.length && <p className="py-8 text-center text-sm text-muted">Agregue su primera sucursal: puede estar en cualquier país.</p>}</div>
      </div>
    </Card>
    <Modal abierto={!!ed} onClose={() => setEd(null)} titulo={ed?.previa ? `Editar sucursal ${ed.previa}` : 'Nueva sucursal'} ancho="max-w-5xl">
      {ed && <div className="space-y-3"><EditorSucursal v={ed.v} set={(v) => setEd({ ...ed, v })} />
        {err && <p className="text-sm text-peligro">{err}</p>}
        <div className="flex justify-end gap-2"><Button onClick={() => setEd(null)}>Cancelar</Button><Button variante="primario" onClick={() => { const r = guardarSucursal(ed.v, ed.previa); if (r) setErr(r); else setEd(null) }}><Save size={15} />Guardar sucursal</Button></div></div>}
    </Modal>
  </>
}

function Datos() {
  const { productos, movimientos, sucursales, vaciarDatos, importarProductos, ir } = useApp()
  const archivo = useRef<HTMLInputElement>(null), resp = useRef<HTMLInputElement>(null)
  const [prev, setPrev] = useState<{ filas: FilaImport[]; errores: string[]; nombre: string } | null>(null)
  const [msg, setMsg] = useState('')
  const descargar = descargarRespaldo
  const cargar = async (f: File) => {
    const r = await cargarRespaldo(f)
    if (r === 'ok') setMsg('Respaldo restaurado correctamente.')
    else if (r === 'invalido') alert('El archivo no es un respaldo válido de NEXORA.')
  }
  return <>
    <Card titulo="Estado actual"><div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">{[['Productos', productos.length], ['Movimientos', movimientos.length], ['Valor del inventario', money(valorInventario(productos), 0)]].map(([a, b]) => <div key={a} className="rounded-xl bg-fg/5 p-3"><div className="text-xs text-muted">{a}</div><div className="text-xl font-bold tnum">{b}</div></div>)}</div>
      {msg && <p className="mt-3 rounded-lg bg-exito/10 p-3 text-sm text-exito">{msg}</p>}</Card>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card hover titulo={<span className="flex items-center gap-2"><FileUp size={15} className="text-cian" />Cargar productos desde Excel</span>}>
        <p className="mb-3 text-sm text-muted">Descargue la plantilla, llénela con sus productos (una fila por producto) e impórtela. Acepta .xlsx, .xls y .csv. Si el SKU ya existe, se actualiza.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={!sucursales.length} onClick={() => descargarPlantilla(sucursales)}><Download size={15} />Plantilla</Button><Button variante="primario" onClick={() => archivo.current?.click()}><FileUp size={15} />Importar Excel</Button></div>
        <input ref={archivo} type="file" accept=".xlsx,.xls,.csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPrev({ ...(await leerArchivo(f, sucursales)), nombre: f.name }); e.target.value = '' }} />
      </Card>
      <Card hover titulo={<span className="flex items-center gap-2"><Plus size={15} className="text-exito" />Registrar uno por uno</span>}>
        <p className="mb-3 text-sm text-muted">En Inventario: "Nuevo producto" para crearlo y "Registrar movimiento" para ventas, compras, ajustes y mermas.</p>
        <Button onClick={() => ir('productos')}>Ir a Inventario <ArrowRight size={15} /></Button>
      </Card>
      <Card hover titulo={<span className="flex items-center gap-2"><HardDriveDownload size={15} className="text-violeta" />Respaldo</span>}>
        <p className="mb-3 text-sm text-muted">Los datos se guardan en este navegador. Descargue un respaldo para no perderlos o para llevarlos a otra computadora (incluye usuarios, inventario y análisis económico).</p>
        <div className="flex flex-wrap gap-2"><Button variante="primario" onClick={descargar}><HardDriveDownload size={15} />Descargar respaldo</Button><Button onClick={() => resp.current?.click()}><HardDriveUpload size={15} />Restaurar respaldo</Button></div>
        <input ref={resp} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) cargar(f); e.target.value = '' }} />
      </Card>
      <Card hover titulo={<span className="flex items-center gap-2"><Eraser size={15} className="text-peligro" />Vaciar inventario</span>}>
        <p className="mb-3 text-sm text-muted">Borra productos, movimientos, órdenes, ventas, gastos y cierres (usuarios, proveedores y empresa se conservan). Descargue un respaldo antes.</p>
        <Button variante="peligro" onClick={() => pedirEliminar({ titulo: '¿Vaciar todo el inventario?', detalle: 'Se borran productos, movimientos, órdenes, ventas, gastos y cierres. Productos, órdenes, ventas, gastos y cierres quedan en la Papelera.', boton: 'Vaciar', listo: 'Inventario vaciado', accion: () => { vaciarDatos(); setMsg('Inventario vaciado.') } })}><Eraser size={15} />Vaciar inventario</Button>
      </Card>
    </div>
    <Modal abierto={!!prev} onClose={() => setPrev(null)} titulo={`Vista previa · ${prev?.nombre}`} ancho="max-w-5xl">
      {prev && <div className="space-y-3">
        <div className="flex flex-wrap gap-2"><Badge tono="verde">{prev.filas.length} filas válidas</Badge>{prev.errores.length > 0 && <Badge tono="rojo">{prev.errores.length} con errores</Badge>}</div>
        {prev.errores.length > 0 && <ul className="max-h-24 overflow-auto rounded-lg bg-peligro/10 p-2 text-xs text-peligro">{prev.errores.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="max-h-[50vh] overflow-auto"><Scroll><table className="tabla"><thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th className="num">Costo</th><th className="num">Precio</th>{sucursales.map((x) => <th key={x.id} className="num">{x.id}</th>)}<th>Vence</th><th /></tr></thead>
          <tbody>{prev.filas.map((f) => <tr key={f.sku}><td className="font-mono text-xs">{f.sku}</td><td>{f.nombre}</td><td>{f.categoria}</td><td className="num">{money(f.costo)}</td><td className="num">{money(f.precio)}</td>{sucursales.map((x) => <td key={x.id} className="num">{f.stock[x.id] ?? 0}</td>)}<td>{f.vence || 'No vence'}</td><td>{productos.some((p) => p.sku.toLowerCase() === f.sku.toLowerCase()) ? <Badge tono="ambar">Actualiza</Badge> : <Badge tono="verde">Nuevo</Badge>}</td></tr>)}</tbody></table></Scroll></div>
        <div className="flex justify-end gap-2"><Button onClick={() => setPrev(null)}>Cancelar</Button><Button variante="primario" disabled={!prev.filas.length} onClick={() => { const r = importarProductos(prev.filas); setPrev(null); setMsg(`Importación lista: ${r.nuevos} productos nuevos y ${r.actualizados} actualizados. Cada uno quedó con su "Saldo inicial" en el kardex.`) }}>Importar {prev.filas.length} productos</Button></div>
      </div>}
    </Modal>
  </>
}

function Guia() {
  const pasos = [
    ['Empresa', 'En la pestaña Empresa elija país, moneda y datos fiscales, y agregue todas sus sucursales (en cualquier país) ubicándolas en el globo.'],
    ['Usuarios', 'Agregue a cada persona con un usuario corto, una contraseña fácil y su rol.'],
    ['Proveedores', 'En Compras → "Nuevo proveedor" registre a quienes le venden.'],
    ['Productos', 'Cárguelos con la plantilla de Excel (Mis datos) o uno por uno en Inventario. El stock inicial queda como "Saldo inicial" en el kardex.'],
    ['Operación diaria', 'Registre ventas, compras, ajustes y mermas en Inventario → "Registrar movimiento". Las órdenes de compra siguen Borrador → Aprobada → Recibida.'],
    ['IA', 'Con algunas semanas de ventas registradas, NEXORA pronostica la demanda, calcula el punto de reorden y sugiere compras.'],
    ['Análisis económico', 'Escriba los costos reales del sistema actual y de NEXORA en Parámetros; el veredicto se recalcula solo.'],
    ['Respaldo', 'Descargue un respaldo cada cierto tiempo en Mis datos → Respaldo.'],
  ]
  return <Card titulo="¿Cómo empezar a usar NEXORA con datos reales?"><ol className="space-y-3">{pasos.map(([t, d], k) => <li key={t} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primario to-violeta text-xs font-bold text-black">{k + 1}</span><div><div className="font-semibold">{t}</div><p className="text-sm text-muted">{d}</p></div></li>)}</ol></Card>
}

/** Temas de color: cada usuario elige el suyo (también desde el botón de paleta de la barra superior). */
function Temas() {
  const { usuario, temasColor, setTemaColor, tema, setTema } = useApp()
  const actual = (usuario && temasColor?.[usuario.id]) || 'oro'
  return <>
    <Card titulo="Temas de color" accion={<div className="flex rounded-full border border-fg/10 bg-fg/5 p-0.5 text-xs">{(['oscuro', 'claro'] as const).map((m) => <button key={m} onClick={() => setTema(m)} className={cx('rounded-full px-3 py-1 capitalize transition', tema === m ? 'bg-gradient-to-r from-primario to-violeta font-semibold text-black' : 'text-muted hover:text-fg')}>Modo {m}</button>)}</div>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fg/5 p-3 text-sm"><span><b>App de escritorio:</b> instale NEXORA en esta computadora para abrirla con su propio ícono, en su propia ventana y sin internet.</span><InstalarApp /></div>
      <p className="mb-4 text-sm text-muted">Solo cambian los colores: el diseño, las letras y las animaciones quedan iguales. El tema se guarda para <b className="text-fg">su usuario</b>: cada persona que ingresa ve el suyo (lo cambia con el botón de paleta de la barra superior).</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{TEMAS.map((x) => (
        <button key={x.id} onClick={() => setTemaColor(x.id)} className={cx('glass glass-hover p-3 text-left', actual === x.id && 'ring-2 ring-primario')}>
          <MuestraTema id={x.id} grande />
          <div className="mt-3 flex items-center justify-between gap-2"><span className="font-semibold">{x.nombre}</span>{actual === x.id ? <Badge tono="azul"><Check size={11} />En uso</Badge> : <span className="text-xs text-primario">Usar</span>}</div>
          <p className="mt-0.5 text-xs text-muted">{x.desc[0]}</p>
          <div className="mt-2 flex gap-1.5">{x.muestra.map((c) => <span key={c} className="h-3 w-3 rounded-full ring-1 ring-fg/10" style={{ background: c }} />)}</div>
        </button>))}</div>
    </Card>
  </>
}

export default function Configuracion() {
  const [t, setT] = useState<'cuenta' | 'usuarios' | 'empresa' | 'datos' | 'temas' | 'guia'>('cuenta')
  return <div className="space-y-4">
    <Titulo titulo="Configuración" sub="Su plan, su equipo, la empresa y la carga de datos reales" />
    <Tabs items={[{ id: 'cuenta', label: 'Cuenta y equipo', icon: <CreditCard size={14} /> }, { id: 'usuarios', label: 'Usuarios de este equipo', icon: <Users size={14} /> }, { id: 'empresa', label: 'Empresa', icon: <Building2 size={14} /> }, { id: 'datos', label: 'Mis datos', icon: <Database size={14} /> }, { id: 'temas', label: 'Temas', icon: <Palette size={14} /> }, { id: 'guia', label: 'Guía', icon: <BookOpen size={14} /> }]} valor={t} onChange={setT} />
    {t === 'cuenta' ? <Suspense fallback={null}><CuentaEquipo /></Suspense> : t === 'usuarios' ? <Usuarios /> : t === 'empresa' ? <EmpresaTab /> : t === 'datos' ? <Datos /> : t === 'temas' ? <Temas /> : <Guia />}
  </div>
}
