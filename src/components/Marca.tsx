import { useState, type ReactNode } from 'react'
import { Link2 } from 'lucide-react'
import { cx } from './ui'

/**
 * Logo de un servicio (Gmail, Drive, Discord, Notion…) desde la biblioteca abierta Simple Icons.
 * Va sobre un cuadro blanco para que se vea el color de la marca en cualquier tema; si no carga, muestra el ícono de respaldo.
 */
const PROPIOS: Record<string, [string, string]> = { slack: ['#', '#4A154B'], microsoftteams: ['T', '#5059C9'], linkedin: ['in', '#0A66C2'] }
export function Marca({ slug, icono, tam = 40, className }: { slug?: string | null; icono?: ReactNode; tam?: number; className?: string }) {
  const [falla, setFalla] = useState(false)
  const propio = slug ? PROPIOS[slug] : undefined
  if (propio) return <span className={cx('grid shrink-0 place-items-center rounded-xl bg-white font-black shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 ring-black/5', className)} style={{ width: tam, height: tam, color: propio[1], fontSize: tam * 0.42 }}>{propio[0]}</span>
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-xl bg-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 ring-black/5', className)} style={{ width: tam, height: tam }}>
      {slug && !falla
        ? <img src={`https://cdn.simpleicons.org/${slug}`} alt="" width={tam * 0.55} height={tam * 0.55} loading="lazy" onError={() => setFalla(true)} />
        : <span className="text-stone-700">{icono ?? <Link2 size={tam * 0.45} />}</span>}
    </span>
  )
}

const SERVICIOS: [RegExp, string, string][] = [
  [/docs\.google\.com\/document/, 'googledocs', 'Google Docs'], [/docs\.google\.com\/spreadsheets/, 'googlesheets', 'Google Sheets'],
  [/docs\.google\.com\/presentation/, 'googleslides', 'Google Slides'], [/docs\.google\.com\/forms/, 'googleforms', 'Google Forms'],
  [/drive\.google\.com/, 'googledrive', 'Google Drive'], [/meet\.google\.com/, 'googlemeet', 'Google Meet'], [/calendar\.google\.com/, 'googlecalendar', 'Google Calendar'],
  [/mail\.google\.com/, 'gmail', 'Gmail'], [/(maps\.google\.|google\.[a-z.]+\/maps|maps\.app\.goo\.gl)/, 'googlemaps', 'Google Maps'], [/earth\.google\.com/, 'googleearth', 'Google Earth'],
  [/gemini\.google\.com/, 'googlegemini', 'Gemini'], [/notebooklm\.google/, 'google', 'NotebookLM'], [/notion\.(so|site)/, 'notion', 'Notion'],
  [/discord\.(gg|com)/, 'discord', 'Discord'], [/slack\.com/, 'slack', 'Slack'], [/zoom\.us/, 'zoom', 'Zoom'], [/teams\.(microsoft|live)\.com/, 'microsoftteams', 'Microsoft Teams'],
  [/(wa\.me|whatsapp\.com)/, 'whatsapp', 'WhatsApp'], [/linkedin\.com/, 'linkedin', 'LinkedIn'], [/instagram\.com/, 'instagram', 'Instagram'],
  [/figma\.com/, 'figma', 'Figma'], [/(youtube\.com|youtu\.be)/, 'youtube', 'YouTube'], [/github\.com/, 'github', 'GitHub'], [/trello\.com/, 'trello', 'Trello'], [/canva\.com/, 'canva', 'Canva'],
]
/** ¿De qué servicio es este enlace? (para mostrar su logo). */
export function servicioDe(url: string): { slug: string | null; nombre: string } {
  const s = SERVICIOS.find(([re]) => re.test(url))
  if (s) return { slug: s[1], nombre: s[2] }
  try { return { slug: null, nombre: new URL(url).hostname.replace(/^www\./, '') } } catch { return { slug: null, nombre: 'Enlace' } }
}
