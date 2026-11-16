import { describe, expect, it } from 'vitest'
import { contactosGoogle, leerCSV, usuarioDesde } from '../lib/contactos'

describe('importar desde Google Contactos', () => {
  it('lee CSV con comillas y comas dentro', () => {
    expect(leerCSV('a,"b, c","d ""e"""\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']])
  })
  it('formato nuevo de Google (First/Last Name)', () => {
    const csv = 'First Name,Middle Name,Last Name,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value,Organization Name,Organization Title\nAna,María,Pérez,* Work,ana@x.com ::: ana2@x.com,Mobile,+593 99 111 2222,Ferretería Sol,Gerente\n,,,,,,,,\n'
    expect(contactosGoogle(csv)).toEqual([{ nombre: 'Ana María Pérez', email: 'ana@x.com', telefono: '+593 99 111 2222', empresa: 'Ferretería Sol', cargo: 'Gerente' }])
  })
  it('formato antiguo (Name, Given Name)', () => {
    const csv = 'Name,Given Name,Family Name,E-mail 1 - Value,Phone 1 - Value,Organization 1 - Name\nLuis Mora,Luis,Mora,luis@y.com,0999,Café Andino'
    expect(contactosGoogle(csv)[0]).toMatchObject({ nombre: 'Luis Mora', email: 'luis@y.com', empresa: 'Café Andino' })
  })
  it('crea usuarios sin repetir ni tildes', () => {
    expect(usuarioDesde('José Ramírez', ['jose'])).toBe('jose2')
    expect(usuarioDesde('Ñandú', [])).toBe('nandu')
  })
})
