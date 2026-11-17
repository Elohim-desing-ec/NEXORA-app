import { Award, BarChart3, Box, Calendar, CheckCircle2, FileText, Handshake, Lightbulb, Pin, Receipt, Rocket, Sprout, Star, Target, TrendingUp, type LucideIcon } from 'lucide-react'

/** Íconos de las notas (antes eran emojis: las notas viejas se siguen viendo con su ícono equivalente). */
export const ICONOS_NOTA: Record<string, LucideIcon> = {
  nota: FileText, idea: Lightbulb, pin: Pin, grafico: BarChart3, cohete: Rocket, hecho: CheckCircle2,
  caja: Box, recibo: Receipt, calendario: Calendar, estrella: Star, acuerdo: Handshake, meta: Target,
}
export const CLAVES_NOTA = Object.keys(ICONOS_NOTA)
const DE_EMOJI: Record<string, string> = { '📝': 'nota', '💡': 'idea', '📌': 'pin', '📊': 'grafico', '🚀': 'cohete', '✅': 'hecho', '📦': 'caja', '🧾': 'recibo', '🗓️': 'calendario', '🗓': 'calendario', '⭐': 'estrella', '🤝': 'acuerdo', '🎯': 'meta' }
export const claveNota = (icono?: string) => (icono && ICONOS_NOTA[icono] ? icono : DE_EMOJI[icono ?? ''] ?? 'nota')
export function IconoNota({ icono, size = 22, className }: { icono?: string; size?: number; className?: string }) {
  const I = ICONOS_NOTA[claveNota(icono)]
  return <I size={size} className={className} />
}

/** Ícono de cada nivel de proveedor. */
const NIVEL: Record<string, LucideIcon> = { Emprendedor: Sprout, Junior: TrendingUp, Senior: Star, Experimentado: Award }
export function IconoNivel({ nivel, size = 13, className }: { nivel?: string; size?: number; className?: string }) {
  const I = nivel ? NIVEL[nivel] : undefined
  return I ? <I size={size} className={className} /> : null
}
