import { describe, expect, it } from 'vitest'
import { csvContactos, urlCalendario, urlGmail, urlMaps } from '../lib/google'

describe('conexión con Google', () => {
  it('evento de todo el día en Calendar (termina al día siguiente)', () => {
    const u = new URL(urlCalendario({ titulo: 'Cierre de mes', fecha: '2026-11-30' }))
    expect(u.searchParams.get('action')).toBe('TEMPLATE')
    expect(u.searchParams.get('text')).toBe('Cierre de mes')
    expect(u.searchParams.get('dates')).toBe('20261130/20261201')
  })
  it('evento con hora y duración', () => {
    const u = new URL(urlCalendario({ titulo: 'Reunión', fecha: '2026-11-16', hora: '09:00', minutos: 30 }))
    expect(u.searchParams.get('dates')).toBe('20261116T090000/20261116T093000')
  })
  it('correo de Gmail con destinatarios, asunto y cuerpo', () => {
    const u = new URL(urlGmail(['a@x.com', '', 'b@x.com'], 'Tarea: inventario', 'Hola equipo'))
    expect(u.searchParams.get('to')).toBe('a@x.com,b@x.com')
    expect(u.searchParams.get('su')).toBe('Tarea: inventario')
  })
  it('mapa y contactos', () => {
    expect(urlMaps(-2.19, -79.88)).toContain('query=-2.19,-79.88')
    const csv = csvContactos([{ nombre: 'Ferretería "El Sol", S.A.', email: 'ventas@sol.ec', telefono: '0999' }])
    expect(csv.split('\n')[0]).toContain('E-mail 1 - Value')
    expect(csv.split('\n')[1]).toBe('"Ferretería ""El Sol"", S.A.",* Work,ventas@sol.ec,Work,0999,,')
  })
})
