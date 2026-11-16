/**
 * Conexión directa con herramientas de Google, sin cuentas ni servidor: cada función arma el enlace oficial
 * que abre la herramienta con los datos listos (correo redactado, evento creado, ubicación en el mapa),
 * o el archivo en el formato que la herramienta importa (contactos, hojas de cálculo).
 */
const q = encodeURIComponent

/** AAAA-MM-DD → AAAAMMDD (formato de fechas de Google Calendar). */
const compacta = (d: string) => d.split('-').join('')
const sumarDia = (d: string) => { const f = new Date(`${d}T12:00:00`); f.setDate(f.getDate() + 1); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}` }

/** Evento de Google Calendar: de todo el día, o con hora (HH:MM, hora local) y duración en minutos. */
export function urlCalendario({ titulo, detalle = '', fecha, hora, minutos = 60, invitados = [] }: { titulo: string; detalle?: string; fecha: string; hora?: string; minutos?: number; invitados?: string[] }) {
  let fechas: string
  if (hora) {
    const ini = new Date(`${fecha}T${hora}:00`), fin = new Date(ini.getTime() + minutos * 60000)
    const f = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
    fechas = `${f(ini)}/${f(fin)}`
  } else fechas = `${compacta(fecha)}/${compacta(sumarDia(fecha))}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${q(titulo)}&details=${q(detalle)}&dates=${fechas}${invitados.length ? `&add=${q(invitados.join(','))}` : ''}`
}

/** Correo redactado en Gmail (la persona solo revisa y pulsa Enviar). */
export const urlGmail = (para: string[], asunto: string, cuerpo: string) => `https://mail.google.com/mail/?view=cm&fs=1&to=${q(para.filter(Boolean).join(','))}&su=${q(asunto)}&body=${q(cuerpo)}`
export const urlMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
export const urlRuta = (o: { lat: number; lng: number }, d: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}`
export const urlEarth = (lat: number, lng: number) => `https://earth.google.com/web/@${lat},${lng},400a,2500d,35y,0h,45t,0r`
export const URLS = {
  meet: 'https://meet.google.com/new', drive: 'https://drive.google.com/drive/my-drive', sheets: 'https://sheets.new', docs: 'https://docs.new',
  gemini: 'https://gemini.google.com/app', notebook: 'https://notebooklm.google.com/', contactos: 'https://contacts.google.com/', wallet: 'https://wallet.google.com/',
}

const celda = (v: string) => (/[",\n]/.test(v) ? `"${v.split('"').join('""')}"` : v)
/** CSV con las columnas que entiende "Importar" de Google Contactos. */
export function csvContactos(filas: { nombre: string; email?: string; telefono?: string; empresa?: string; nota?: string }[]) {
  const cab = ['Name', 'E-mail 1 - Type', 'E-mail 1 - Value', 'Phone 1 - Type', 'Phone 1 - Value', 'Organization 1 - Name', 'Notes']
  return [cab.join(','), ...filas.map((f) => [f.nombre, f.email ? '* Work' : '', f.email ?? '', f.telefono ? 'Work' : '', f.telefono ?? '', f.empresa ?? '', f.nota ?? ''].map((x) => celda(x)).join(','))].join('\n')
}

export function descargar(nombre: string, contenido: string, tipo = 'text/plain;charset=utf-8') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contenido], { type: tipo })); a.download = nombre; a.click(); URL.revokeObjectURL(a.href)
}
export async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}
export const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
