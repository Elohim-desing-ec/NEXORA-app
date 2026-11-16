// Correos de NEXORA enviados desde el Gmail de la empresa (contraseña de aplicación).
//   { tipo: 'recibo' }                 → bienvenida + comprobante a la propia cuenta que compró
//   { tipo: 'invitacion', email }      → invitación a un miembro que el titular ya agregó a su equipo
// Secretos: GMAIL_USER, GMAIL_APP_PASSWORD (y opcional SITIO_URL). Sin ellos responde { enviado: false }.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const SITIO = Deno.env.get('SITIO_URL') ?? 'https://elohim-desing-ec.github.io/NEXORA-app/'
const MAX_MIEMBROS = 50
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const fecha = (d: string) => new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

function plantilla(titulo: string, cuerpo: string, boton: string) {
  return `<!doctype html><html><body style="margin:0;background:#0c0a09;font-family:Arial,Helvetica,sans-serif;color:#e7e5e4">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1c1917;border:1px solid #44403c;border-radius:16px">
      <tr><td style="padding:28px 32px 8px"><div style="font-size:22px;font-weight:bold;letter-spacing:6px;color:#e4b54a">NEXORA</div>
        <div style="font-size:10px;letter-spacing:3px;color:#a8a29e">INTELLIGENT OPERATIONS</div></td></tr>
      <tr><td style="padding:16px 32px 8px"><h1 style="margin:0;font-size:22px;color:#fafaf9">${titulo}</h1></td></tr>
      <tr><td style="padding:8px 32px;font-size:14px;line-height:1.6;color:#d6d3d1">${cuerpo}</td></tr>
      <tr><td style="padding:16px 32px 28px"><a href="${SITIO}#/login" style="display:inline-block;background:#e4b54a;color:#0c0a09;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${boton}</a></td></tr>
    </table>
    <div style="margin-top:16px;font-size:11px;color:#78716c">NEXORA · Gestión inteligente de operaciones e inventario</div>
  </td></tr></table></body></html>`
}

const fila = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#a8a29e">${k}</td><td style="padding:6px 0;text-align:right;color:#fafaf9">${v}</td></tr>`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ enviado: false, motivo: 'metodo' }, 405)

  const gmail = Deno.env.get('GMAIL_USER'), clave = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!gmail || !clave) return json({ enviado: false, motivo: 'correo-no-configurado' })

  // Cliente con la sesión de quien llama: todo lo que lee respeta sus permisos (RLS).
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await sb.auth.getUser()
  if (!user?.email) return json({ enviado: false, motivo: 'sin-sesion' }, 401)

  const pedido = await req.json().catch(() => ({})) as { tipo?: string; email?: string }
  let para: string, asunto: string, html: string

  if (pedido.tipo === 'recibo') {
    const { data: l } = await sb.from('licencias').select('id, plan, precio, empresa, titular, tarjeta_ultimos, creada').eq('estado', 'activa').order('creada', { ascending: false }).limit(1).maybeSingle()
    const { data: p } = await sb.from('pruebas').select('empresa, vence').maybeSingle()
    para = user.email
    if (l) {
      asunto = `Bienvenido a NEXORA · Comprobante de ${l.plan}`
      html = plantilla('¡Gracias por su compra!', `
        <p>Su plan <b>${esc(l.plan)}</b> ya está activo. Ingrese con esta cuenta (${esc(user.email)}) e invite a su equipo desde Configuración → Cuenta y equipo.</p>
        <table width="100%" style="margin-top:12px;border-top:1px solid #44403c;font-size:13px">
          ${fila('Comprobante', `N.º ${esc(String(l.id).slice(0, 8).toUpperCase())}`)}
          ${fila('Fecha', esc(fecha(l.creada)))}
          ${fila('Empresa', esc(l.empresa))}
          ${fila('Titular', esc(l.titular))}
          ${fila('Plan', esc(l.plan))}
          ${fila('Pago', `${esc(l.precio)} · tarjeta •••• ${esc(l.tarjeta_ultimos)}`)}
        </table>
        <p style="font-size:11px;color:#a8a29e">Pago de demostración: no se realizó ningún cobro real.</p>`, 'Ingresar a NEXORA')
    } else if (p) {
      asunto = 'Bienvenido a NEXORA · Su prueba gratis empezó'
      html = plantilla('Su prueba gratis empezó', `
        <p>Tiene <b>14 días</b> para usar todas las funciones de NEXORA con ${esc(p.empresa || 'su empresa')}, sin tarjeta.</p>
        <p>La prueba termina el <b>${esc(fecha(p.vence))}</b>. Sus datos se conservan si luego elige un plan.</p>`, 'Ingresar a NEXORA')
    } else return json({ enviado: false, motivo: 'sin-compra' }, 400)
  } else if (pedido.tipo === 'invitacion') {
    const email = String(pedido.email ?? '').toLowerCase().trim()
    const { data: e } = await sb.from('empresas').select('id, nombre').eq('dueno', user.id).maybeSingle()
    if (!e) return json({ enviado: false, motivo: 'no-es-titular' }, 403)
    const { data: m } = await sb.from('miembros').select('nombre, rol').eq('empresa_id', e.id).eq('email', email).maybeSingle()
    if (!m) return json({ enviado: false, motivo: 'no-es-miembro' }, 400)
    const { count } = await sb.from('miembros').select('email', { count: 'exact', head: true }).eq('empresa_id', e.id)
    if ((count ?? 0) > MAX_MIEMBROS) return json({ enviado: false, motivo: 'demasiados-miembros' }, 429)
    para = email
    asunto = `${e.nombre || 'Su empresa'} le invitó a NEXORA`
    html = plantilla(`Hola${m.nombre ? ' ' + esc(m.nombre) : ''}, le invitaron a NEXORA`, `
      <p><b>${esc(e.nombre || 'Su empresa')}</b> le dio acceso a NEXORA como <b>${esc(m.rol)}</b>.</p>
      <p>Para entrar, pulse el botón y elija <b>Continuar con Google</b> con este correo (${esc(email)}), o cree una cuenta con este mismo correo.</p>`, 'Aceptar invitación')
  } else return json({ enviado: false, motivo: 'tipo-desconocido' }, 400)

  try {
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmail, pass: clave.replace(/\s/g, '') } })
    await t.sendMail({ from: `NEXORA <${gmail}>`, to: para, subject: asunto, html })
    return json({ enviado: true })
  } catch (err) {
    console.error('SMTP', err)
    return json({ enviado: false, motivo: 'error-smtp' }, 502)
  }
})
