import { describe, expect, it } from 'vitest'
import { detectarIdioma, paisDetectado } from '../lib/idioma'

describe('idioma automático', () => {
  it('usa el idioma del navegador', () => {
    expect(detectarIdioma(['en-US', 'es'])).toBe('en')
    expect(detectarIdioma(['pt-BR'])).toBe('pt')
    expect(detectarIdioma(['es-EC'])).toBe('es')
  })
  it('un hispanohablante en Estados Unidos sigue en español', () => {
    expect(detectarIdioma(['es-US'])).toBe('es')
    expect(paisDetectado(['es-US'])).toBe('US')
  })
  it('idiomas que NEXORA aún no habla pasan a inglés', () => {
    expect(detectarIdioma(['de-DE', 'fr-FR'])).toBe('en')
    expect(detectarIdioma(['fr-FR', 'pt-PT'])).toBe('pt')
  })
})
