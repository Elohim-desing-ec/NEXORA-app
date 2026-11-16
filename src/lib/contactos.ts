/** Lee el archivo que exporta Google Contactos (formato "Google CSV", nuevo o antiguo) para importar personas. */
export interface ContactoImportado { nombre: string; email: string; telefono: string; empresa: string; cargo: string }

/** CSV con comillas, comas y saltos de línea dentro de los campos. */
export function leerCSV(texto: string): string[][] {
  const filas: string[][] = []; let fila: string[] = [], celda = '', comillas = false
  const t = texto.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (comillas) { if (c === '"') { if (t[i + 1] === '"') { celda += '"'; i++ } else comillas = false } else celda += c; continue }
    if (c === '"') comillas = true
    else if (c === ',') { fila.push(celda); celda = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fila.push(celda); filas.push(fila); fila = []; celda = '' }
    else celda += c
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila) }
  return filas.filter((f) => f.some((x) => x.trim()))
}

/** Convierte las filas de Google Contactos en personas (ignora las que no tienen nombre ni correo). */
export function contactosGoogle(texto: string): ContactoImportado[] {
  const [cab, ...filas] = leerCSV(texto)
  if (!cab) return []
  const col = (...nombres: string[]) => { for (const n of nombres) { const i = cab.findIndex((h) => h.trim().toLowerCase() === n.toLowerCase()); if (i >= 0) return i } return -1 }
  const c = {
    nombre: col('Name'), nombres: col('First Name', 'Given Name'), medio: col('Middle Name', 'Additional Name'), apellidos: col('Last Name', 'Family Name'),
    email: col('E-mail 1 - Value', 'Email 1 - Value', 'E-mail Address'), tel: col('Phone 1 - Value', 'Mobile Phone'),
    empresa: col('Organization Name', 'Organization 1 - Name', 'Company'), cargo: col('Organization Title', 'Organization 1 - Title', 'Job Title'),
  }
  const v = (f: string[], i: number) => (i >= 0 ? (f[i] ?? '').trim() : '')
  return filas.map((f) => {
    const armado = [v(f, c.nombres), v(f, c.medio), v(f, c.apellidos)].filter(Boolean).join(' ')
    const email = v(f, c.email).split(' ::: ')[0]
    return { nombre: v(f, c.nombre) || armado || email, email, telefono: v(f, c.tel).split(' ::: ')[0], empresa: v(f, c.empresa), cargo: v(f, c.cargo) }
  }).filter((x) => x.nombre)
}

/** Usuario para iniciar sesión a partir del nombre (sin tildes ni espacios y sin repetir). */
export function usuarioDesde(nombre: string, existentes: string[]) {
  const base = (nombre.split(' ')[0] || 'usuario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'usuario'
  let u = base, k = 2
  while (existentes.includes(u)) u = `${base}${k++}`
  return u
}
