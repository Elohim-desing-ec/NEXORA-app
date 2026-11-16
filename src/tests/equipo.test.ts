import { describe, expect, it } from 'vitest'
import { tipoDeEquipo } from '../lib/equipo'

describe('tipo de equipo para instalar la app', () => {
  it('iPhone y iPad (también iPad en modo escritorio)', () => {
    expect(tipoDeEquipo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe('ios')
    expect(tipoDeEquipo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1')).toBe('ios')
    expect(tipoDeEquipo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 5)).toBe('ios')
  })
  it('Samsung Internet antes que Android genérico', () => {
    expect(tipoDeEquipo('Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36')).toBe('samsung')
    expect(tipoDeEquipo('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36')).toBe('android')
  })
  it('computadoras (una Mac sin pantalla táctil no es iPad)', () => {
    expect(tipoDeEquipo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 0)).toBe('computadora')
    expect(tipoDeEquipo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')).toBe('computadora')
  })
})
