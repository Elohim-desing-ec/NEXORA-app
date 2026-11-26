import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CalendarDays, Contact, FileSpreadsheet, FileText, Globe2, HardDrive, Mail, MapPin, Sparkles, Video, Wallet } from 'lucide-react'
import { useApp, tieneRol } from '../../store/useApp'
import { Button, cx } from '../../components/ui'
import { Marca } from '../../components/Marca'
import { money, pct } from '../../lib/format'
import { enQuiebre, stockTotal, valorInventario } from '../../lib/inventario'
import { agregar, filasVentas, hoyISO, nombrePeriodo } from '../../lib/resumen'
import { saludNegocio } from '../../lib/salud'
import { perfilDe } from '../../lib/sectores'
import { exportarLibro } from '../../lib/export'
import { descargarRespaldo } from '../../lib/respaldo'
import { abrir, copiar, csvContactos, descargar, urlCalendario, urlEarth, urlGmail, urlMaps, urlRuta, URLS } from '../../lib/google'

const suave = [0.16, 1, 0.3, 1] as const
/** Espacio de trabajo de cada empresa: enlaces a las herramientas que ya usa. */
const CONEXIONES: { k: string; nombre: string; slug: string; ejemplo: string }[] = [
  { k: 'discord', nombre: 'Discord', slug: 'discord', ejemplo: 'https://discord.gg/su-servidor' }, { k: 'slack', nombre: 'Slack', slug: 'slack', ejemplo: 'https://su-empresa.slack.com' },
  { k: 'notion', nombre: 'Notion', slug: 'notion', ejemplo: 'https://www.notion.so/su-espacio' }, { k: 'teams', nombre: 'Microsoft Teams', slug: 'microsoftteams', ejemplo: 'https://teams.microsoft.com/l/team/…' },
  { k: 'zoom', nombre: 'Zoom', slug: 'zoom', ejemplo: 'https://zoom.us/j/su-sala' }, { k: 'whatsapp', nombre: 'Grupo de WhatsApp', slug: 'whatsapp', ejemplo: 'https://chat.whatsapp.com/…' },
  { k: 'drive', nombre: 'Carpeta de Drive del equipo', slug: 'googledrive', ejemplo: 'https://drive.google.com/drive/folders/…' }, { k: 'trello', nombre: 'Trello', slug: 'trello', ejemplo: 'https://trello.com/b/…' },
]
/** Colores de marca de cada herramienta solo como acento del ícono (sin logos). */
function Herramienta({ nombre, que, slug, icono, children, i, pronto }: { nombre: string; que: string; slug: string; icono: ReactNode; children: ReactNode; i: number; pronto?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, duration: 0.5, ease: suave }} className={cx('glass glass-hover flex flex-col p-4', pronto && 'opacity-70')}>
      <div className="flex items-center gap-3"><Marca slug={slug} icono={icono} /><div><div className="font-semibold">{nombre}</div><div className="text-[11px] text-muted">{que}</div></div></div>
      <div className="mt-3 flex flex-1 flex-col justify-end gap-1.5">{children}</div>
    </motion.div>
  )
}
const Accion = ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) =>
  <Button className="w-full justify-start text-xs" disabled={disabled} onClick={onClick}>{children}</Button>

export default function Google() {
  const st = useApp()
  const { usuario, guardarConexiones } = st
  const [con, setCon] = useState<Record<string, string>>(st.empresa.conexiones ?? {})
  const esGerente = tieneRol(usuario, 'Gerente General', 'Mano derecha', 'Administrador de Sistemas')
  const { empresa, productos, movimientos, gastos, ventas, proveedores, sucursales, usuarios, tareas } = st
  const [aviso, setAviso] = useState('')
  const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(''), 6000) }
  const hoy = new Date(), Y = hoy.getFullYear(), M = hoy.getMonth()
  const perfil = perfilDe(empresa.sector)
  const correosEquipo = usuarios.map((u) => u.email).filter(Boolean)

  /** Resumen del negocio en texto: sirve para Gemini, Documentos y NotebookLM. */
  const resumenNegocio = () => {
    const a = agregar(movimientos, productos, gastos, Y, M, 'TODAS', ventas), s = saludNegocio(movimientos, productos, Date.now(), perfil.margenMeta, ventas)
    return [`Empresa: ${empresa.nombre || 'Mi empresa'} · ${empresa.sector || perfil.nombre}${empresa.tamano ? ` · ${empresa.tamano}` : ''} · ${sucursales.length} sucursal(es)`,
      `Periodo: ${nombrePeriodo(Y, M)}`,
      `Ventas: ${money(a.ventas)} · Costo de lo vendido: ${money(a.costo)} · Gastos: ${money(a.gastos)} · Ganancia neta: ${money(a.neta)} (margen ${pct(a.margen, 1)})`,
      `Inventario: ${productos.length} productos, valor ${money(valorInventario(productos))}, ${productos.filter((p) => enQuiebre(p)).length} en quiebre`,
      `Salud del negocio: ${s.puntaje}/100 (rendimiento ${s.nivel.toLowerCase()})`, ...s.factores.map((f) => `- ${f.nombre}: ${f.valor} (meta: ${f.meta})`),
      `Tareas del equipo: ${tareas.filter((t) => t.estado === 'pendiente').length} pendientes, ${tareas.filter((t) => t.estado === 'progreso').length} en progreso, ${tareas.filter((t) => t.estado === 'hecho').length} hechas`].join('\n')
  }
  const finDeMes = () => { const f = new Date(Y, M + 1, 0); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }
  const proximoLunes = () => { const f = new Date(); f.setDate(f.getDate() + ((8 - f.getDay()) % 7 || 7)); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p className="max-w-3xl text-muted"><b className="text-fg">Funciona ya, sin configurar nada:</b> cada botón abre la herramienta de Google con sus datos listos (correo redactado, evento creado, ubicación en el mapa) o descarga el archivo para subirlo. La <b className="text-fg">sincronización automática</b> en ambos sentidos llegará con la base de datos y una cuenta de Google Cloud (fase 2).</p>
        {aviso && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-exito/15 px-3 py-2 text-xs text-exito">{aviso}</motion.p>}
      </div>

      {/* Espacio de trabajo de la empresa */}
      <section className="glass p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Espacio de trabajo de su empresa</h3><p className="text-xs text-muted">Conecte las herramientas que ya usa su equipo: aparecen en las fichas de cada persona (por ejemplo, la videollamada por Discord).</p></div>
          {esGerente && <Button variante="primario" className="text-xs" onClick={() => { guardarConexiones(con); avisar('Conexiones guardadas para toda la empresa.') }}>Guardar conexiones</Button>}</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{CONEXIONES.map((c) => (
          <div key={c.k} className="flex items-center gap-3 rounded-2xl bg-fg/5 p-2.5 ring-1 ring-fg/5">
            <Marca slug={c.slug} tam={36} />
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold">{c.nombre}</div>
              {esGerente ? <input className="mt-0.5 w-full bg-transparent text-xs text-muted outline-none placeholder:text-muted/50 focus:text-fg" placeholder={c.ejemplo} value={con[c.k] ?? ''} onChange={(e) => setCon({ ...con, [c.k]: e.target.value })} />
                : <div className="truncate text-xs text-muted">{empresa.conexiones?.[c.k] || 'Sin conectar'}</div>}</div>
            <Button className="text-xs" disabled={!(empresa.conexiones?.[c.k] || con[c.k])} onClick={() => abrir(con[c.k] || empresa.conexiones![c.k])}>Abrir</Button>
          </div>))}</div>
      </section>

      <div className="flex items-center gap-2 pt-1"><Marca slug="google" tam={28} /><h3 className="font-semibold">Herramientas de Google</h3></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Herramienta i={0} nombre="Gmail" que="Correos al equipo y a proveedores" slug="gmail" icono={<Mail size={18} />}>
          <Accion onClick={() => abrir(urlGmail(correosEquipo, `Resumen de ${nombrePeriodo(Y, M)}`, `Hola equipo:\n\n${resumenNegocio()}\n\nEnviado desde NEXORA.`))}>Enviar el resumen del mes</Accion>
          <Accion disabled={!proveedores.length} onClick={() => abrir(urlGmail(proveedores.map((p) => p.email), 'Pedido / cotización', `Estimados proveedores:\n\nLes solicitamos cotización de los siguientes productos con stock bajo:\n${productos.filter((p) => enQuiebre(p)).map((p) => `- ${p.nombre} (${p.sku})`).join('\n') || '- (detalle)'}\n\nSaludos,\n${empresa.nombre}`))}>Pedir cotización a proveedores</Accion>
        </Herramienta>
        <Herramienta i={1} nombre="Calendar" que="Fechas clave del negocio" slug="googlecalendar" icono={<CalendarDays size={18} />}>
          <Accion onClick={() => abrir(urlCalendario({ titulo: `Cierre de mes · ${empresa.nombre || 'NEXORA'}`, detalle: 'Revisar Resumen → Cerrar mes en NEXORA.', fecha: finDeMes(), invitados: correosEquipo }))}>Agendar el cierre de mes</Accion>
          <Accion onClick={() => abrir(urlCalendario({ titulo: 'Reunión semanal del equipo', detalle: 'Revisar el tablero de tareas en NEXORA → Espacio de trabajo.', fecha: proximoLunes(), hora: '09:00', minutos: 30, invitados: correosEquipo }))}>Reunión semanal (lunes 9:00)</Accion>
        </Herramienta>
        <Herramienta i={2} nombre="Meet" que="Videollamadas del equipo" slug="googlemeet" icono={<Video size={18} />}>
          <Accion onClick={() => abrir(URLS.meet)}>Iniciar una reunión ahora</Accion>
          <p className="text-[11px] text-muted">Desde cada tarea del tablero también puede abrir una reunión.</p>
        </Herramienta>
        <Herramienta i={3} nombre="Gemini" que="Asesor con inteligencia artificial" slug="googlegemini" icono={<Sparkles size={18} />}>
          <Accion onClick={async () => { const ok = await copiar(`Actúa como asesor de negocios para una empresa de ${perfil.nombre.toLowerCase()}. Con estos datos reales de mi sistema NEXORA, dame 5 acciones concretas para mejorar la ganancia el próximo mes:\n\n${resumenNegocio()}`); abrir(URLS.gemini); avisar(ok ? 'Pregunta copiada: péguela en Gemini (Ctrl/Cmd + V).' : 'Abra Gemini y escriba su pregunta.') }}>Pedir consejos sobre mi negocio</Accion>
        </Herramienta>
        <Herramienta i={4} nombre="Drive" que="Respaldos en la nube" slug="googledrive" icono={<HardDrive size={18} />}>
          <Accion onClick={() => { descargarRespaldo(); abrir(URLS.drive); avisar('Respaldo descargado: arrástrelo a su Drive para guardarlo en la nube.') }}>Guardar respaldo en Drive</Accion>
        </Herramienta>
        <Herramienta i={5} nombre="Hojas de cálculo" que="Sus datos en Google Sheets" slug="googlesheets" icono={<FileSpreadsheet size={18} />}>
          <Accion onClick={() => {
            exportarLibro('Para_Google_Sheets', [['Inventario', [['Código', 'Producto', 'Categoría', 'Costo', 'Precio', 'Stock'], ...productos.map((p) => [p.sku, p.nombre, p.categoria, p.costo, p.precio, stockTotal(p)])]],
              ['Ventas', [['N.º', 'Fecha', 'Cliente', 'Productos', 'Canal', 'Estado', 'Total'], ...filasVentas(ventas, movimientos, productos).map((f) => [f.id, f.fecha.slice(0, 10), f.cliente, f.detalle, f.canal, f.estado, Math.round(f.total * 100) / 100])]]])
            abrir(URLS.sheets); avisar('Archivo descargado: en la hoja nueva use Archivo → Importar → Subir.')
          }}>Abrir inventario y ventas en Sheets</Accion>
        </Herramienta>
        <Herramienta i={6} nombre="Documentos" que="Informes para compartir" slug="googledocs" icono={<FileText size={18} />}>
          <Accion onClick={async () => { const ok = await copiar(`Informe de ${empresa.nombre || 'la empresa'} — ${nombrePeriodo(Y, M)}\n\n${resumenNegocio()}`); abrir(URLS.docs); avisar(ok ? 'Informe copiado: péguelo en el documento nuevo.' : 'Abra un documento y escriba su informe.') }}>Crear informe del mes</Accion>
        </Herramienta>
        <Herramienta i={7} nombre="NotebookLM" que="Cuaderno de estudio con IA" slug="google" icono={<BookOpen size={18} />}>
          <Accion onClick={() => { descargar(`NEXORA_fuente_${hoyISO()}.txt`, `Fuente para NotebookLM\n\n${resumenNegocio()}\n\nInventario:\n${productos.map((p) => `- ${p.nombre} (${p.categoria}): ${stockTotal(p)} u, costo ${money(p.costo)}, precio ${money(p.precio)}`).join('\n')}`); abrir(URLS.notebook); avisar('Fuente descargada: súbala como fuente en un cuaderno nuevo.') }}>Crear fuente con mis datos</Accion>
        </Herramienta>
        <Herramienta i={8} nombre="Maps" que="Ubicación y rutas de sucursales" slug="googlemaps" icono={<MapPin size={18} />}>
          {sucursales.slice(0, 3).map((s) => <Accion key={s.id} onClick={() => abrir(urlMaps(s.lat, s.lng))}>Ver {s.ciudad || s.nombre}</Accion>)}
          {sucursales.length >= 2 && <Accion onClick={() => abrir(urlRuta(sucursales[0], sucursales[1]))}>Ruta {sucursales[0].id} → {sucursales[1].id}</Accion>}
          {!sucursales.length && <p className="text-[11px] text-muted">Registre sucursales en Configuración.</p>}
        </Herramienta>
        <Herramienta i={9} nombre="Earth" que="Su red en 3D satelital" slug="googleearth" icono={<Globe2 size={18} />}>
          {sucursales.slice(0, 2).map((s) => <Accion key={s.id} onClick={() => abrir(urlEarth(s.lat, s.lng))}>Volar a {s.ciudad || s.nombre}</Accion>)}
          {!sucursales.length && <p className="text-[11px] text-muted">Registre sucursales en Configuración.</p>}
        </Herramienta>
        <Herramienta i={10} nombre="Contactos" que="Clientes y proveedores" slug="google" icono={<Contact size={18} />}>
          <Accion disabled={!proveedores.length && !ventas.some((v) => v.cliente)} onClick={() => {
            const clientes = [...new Set(ventas.map((v) => v.cliente).filter(Boolean))].map((c) => ({ nombre: c, nota: 'Cliente (NEXORA)' }))
            descargar(`NEXORA_contactos_${hoyISO()}.csv`, csvContactos([...proveedores.map((p) => ({ nombre: p.contacto ? `${p.contacto} (${p.nombre})` : p.nombre, email: p.email, telefono: p.telefono, empresa: p.nombre, nota: 'Proveedor (NEXORA)' })), ...clientes]), 'text/csv;charset=utf-8')
            abrir(URLS.contactos); avisar('Contactos descargados: en Google Contactos use Importar y elija el archivo.')
          }}>Exportar a Google Contactos</Accion>
        </Herramienta>
        <Herramienta i={11} pronto nombre="Wallet" que="Tarjetas de fidelidad y cupones" slug="googlepay" icono={<Wallet size={18} />}>
          <p className="text-[11px] text-muted">Próximamente: crear tarjetas de cliente frecuente requiere una cuenta de emisor de Google Wallet (fase 2).</p>
        </Herramienta>
      </div>
    </div>
  )
}
