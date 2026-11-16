/**
 * Idioma de NEXORA: se detecta solo con el idioma y la región del navegador (ej. "en-US" → inglés, Estados Unidos)
 * y la persona puede cambiarlo cuando quiera. Español, inglés y portugués; otros idiomas usan inglés.
 */
import { create } from 'zustand'

export type Idioma = 'es' | 'en' | 'pt'
export const IDIOMAS: { id: Idioma; corto: string; nombre: string }[] = [
  { id: 'es', corto: 'ES', nombre: 'Español' }, { id: 'en', corto: 'EN', nombre: 'English' }, { id: 'pt', corto: 'PT', nombre: 'Português' },
]
const CLAVE = 'nexora-idioma'

const navegador = () => (typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language].filter(Boolean))

/** Primer idioma del navegador que NEXORA habla; si ninguno, inglés (y español si no hay navegador). */
export function detectarIdioma(langs: readonly string[] = navegador()): Idioma {
  for (const l of langs) { const c = l.slice(0, 2).toLowerCase(); if (c === 'es' || c === 'en' || c === 'pt') return c }
  return langs.length ? 'en' : 'es'
}

/** País detectado por la región del navegador ("es-EC" → "EC"), o null si el navegador no la indica. */
export function paisDetectado(langs: readonly string[] = navegador()): string | null {
  for (const l of langs) { const r = l.split('-')[1]; if (r && /^[A-Za-z]{2}$/.test(r)) return r.toUpperCase() }
  return null
}

const guardado = (): Idioma | null => { try { const g = localStorage.getItem(CLAVE); return g === 'es' || g === 'en' || g === 'pt' ? g : null } catch { return null } }

export const useIdioma = create<{ idioma: Idioma; automatico: boolean; setIdioma: (i: Idioma) => void }>((set) => ({
  idioma: guardado() ?? detectarIdioma(),
  automatico: !guardado(),
  setIdioma: (idioma) => { try { localStorage.setItem(CLAVE, idioma) } catch { /* sin almacenamiento: solo esta visita */ } set({ idioma, automatico: false }) },
}))

/** tx('Hola', 'Hello', 'Olá') devuelve el texto del idioma actual. */
export function useTx() {
  const i = useIdioma((s) => s.idioma)
  return (es: string, en: string, pt: string) => (i === 'en' ? en : i === 'pt' ? pt : es)
}

/** Nombre del país en el idioma actual (ej. "US" → "Estados Unidos" / "United States"). */
export function nombrePais(codigo: string, idioma: Idioma) {
  try { return new Intl.DisplayNames([idioma], { type: 'region' }).of(codigo) ?? codigo } catch { return codigo }
}
