// Cobro de los planes de NEXORA con el Botón de Pagos de Payphone (redirección).
//   { accion: 'preparar', plan, periodo, empresa } → crea el pago pendiente y devuelve la URL del formulario de Payphone
//   { accion: 'confirmar', id, clientTxId }        → confirma con Payphone (hay 5 minutos) y activa el plan
// Secretos: PAYPHONE_TOKEN, PAYPHONE_STORE_ID (opcional), SITIO_URL (opcional), IVA (opcional, por defecto 0.15).
// Los precios viven aquí, en el servidor: el navegador no puede cambiarlos.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PRECIOS: Record<string, { mensual: number; anual: number }> = { // centavos, IVA incluido
  'Emprende': { mensual: 2900, anual: 29000 },
  'Emprende Plus': { mensual: 5900, anual: 59000 },
  'Crece': { mensual: 9900, anual: 99000 },
}
const API = 'https://pay.payphonetodoesposible.com/api/button'
const SITIO = Deno.env.get('SITIO_URL') ?? 'https://elohim-desing-ec.github.io/NEXORA-app/'
const IVA = Number(Deno.env.get('IVA') ?? '0.15')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function claveServicio() {
  const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (k) return k
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default as string } catch { return '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, motivo: 'metodo' }, 405)

  const token = Deno.env.get('PAYPHONE_TOKEN')
  if (!token) return json({ ok: false, motivo: 'pagos-no-configurados' })
  const storeId = Deno.env.get('PAYPHONE_STORE_ID') || undefined
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, claveServicio(), { auth: { persistSession: false } })
  const pedido = await req.json().catch(() => ({})) as Record<string, unknown>
  const payphone = (ruta: string, cuerpo: unknown) => fetch(`${API}/${ruta}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  })

  // ---------- Preparar: requiere sesión ----------
  if (pedido.accion === 'preparar') {
    const sb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return json({ ok: false, motivo: 'sin-sesion' }, 401)
    const plan = String(pedido.plan ?? ''), periodo = String(pedido.periodo ?? '')
    const precio = PRECIOS[plan]?.[periodo as 'mensual' | 'anual']
    if (!precio) return json({ ok: false, motivo: 'plan-no-valido' }, 400)
    const empresa = String(pedido.empresa ?? '').trim().slice(0, 120)
    const clientTx = `NX${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`.toUpperCase()

    const { error } = await admin.from('pagos').insert({ user_id: user.id, plan, periodo, monto: precio, empresa, client_tx_id: clientTx })
    if (error) { console.error(error); return json({ ok: false, motivo: 'base-de-datos' }, 500) }

    const base = Math.round(precio / (1 + IVA)) // IVA incluido en el precio
    const r = await payphone('Prepare', {
      amount: precio, amountWithoutTax: IVA > 0 ? 0 : precio, amountWithTax: IVA > 0 ? base : 0, tax: IVA > 0 ? precio - base : 0,
      currency: 'USD', clientTransactionId: clientTx, storeId, reference: `NEXORA ${plan} (${periodo})`,
      responseUrl: SITIO, cancellationUrl: SITIO, email: user.email, lang: 'es', timeZone: -5,
    })
    const datos = await r.json().catch(() => ({}))
    if (!r.ok || !datos.payWithCard) {
      console.error('Prepare', r.status, datos)
      await admin.from('pagos').update({ estado: 'cancelado' }).eq('client_tx_id', clientTx)
      return json({ ok: false, motivo: 'payphone', mensaje: datos.message ?? `Payphone respondió ${r.status}` }, 502)
    }
    return json({ ok: true, url: datos.payWithCard, urlApp: datos.payWithPayPhone, clientTxId: clientTx })
  }

  // ---------- Confirmar: al volver de Payphone (no requiere sesión: valida con Payphone) ----------
  if (pedido.accion === 'confirmar') {
    const id = Number(pedido.id), clientTxId = String(pedido.clientTxId ?? '')
    if (!id || !clientTxId) return json({ ok: false, motivo: 'datos' }, 400)
    const { data: pago } = await admin.from('pagos').select('*').eq('client_tx_id', clientTxId).maybeSingle()
    if (!pago) return json({ ok: false, motivo: 'no-existe' }, 404)
    if (pago.estado === 'aprobado') return json({ ok: true, pago })

    const r = await payphone('V2/Confirm', { id, clientTxId })
    const c = await r.json().catch(() => ({}))
    const monto = Number(c.amount) // Payphone trabaja en centavos; por si acaso también se acepta en dólares
    const aprobado = r.ok && c.statusCode === 3 && c.clientTransactionId === clientTxId && (monto === pago.monto || Math.round(monto * 100) === pago.monto)
    if (!aprobado) {
      console.error('Confirm', r.status, c)
      await admin.from('pagos').update({ estado: 'cancelado', payphone_id: id, confirmado: new Date().toISOString() }).eq('id', pago.id).eq('estado', 'pendiente')
      return json({ ok: false, motivo: 'rechazado', mensaje: c.message ?? 'El pago no fue aprobado' })
    }

    // El plan nuevo empieza cuando termina el que esté vigente (renovar antes de tiempo no pierde días).
    const { data: vigente } = await admin.from('pagos').select('vence').eq('user_id', pago.user_id).eq('estado', 'aprobado').gt('vence', new Date().toISOString()).order('vence', { ascending: false }).limit(1).maybeSingle()
    const desde = new Date(vigente?.vence ?? Date.now())
    const vence = new Date(desde)
    if (pago.periodo === 'anual') vence.setFullYear(vence.getFullYear() + 1)
    else vence.setMonth(vence.getMonth() + 1)

    await admin.from('empresas').upsert({ dueno: pago.user_id, nombre: pago.empresa || 'Mi empresa' }, { onConflict: 'dueno', ignoreDuplicates: true })
    await admin.from('pruebas').update({ vence: new Date().toISOString() }).eq('user_id', pago.user_id).gt('vence', new Date().toISOString())
    const { data: listo } = await admin.from('pagos').update({
      estado: 'aprobado', payphone_id: id, tarjeta: [c.cardBrand, c.lastDigits ? `•••• ${c.lastDigits}` : ''].filter(Boolean).join(' '),
      autorizacion: String(c.authorizationCode ?? ''), desde: desde.toISOString(), vence: vence.toISOString(), confirmado: new Date().toISOString(),
    }).eq('id', pago.id).eq('estado', 'pendiente').select('*').maybeSingle()
    if (listo) return json({ ok: true, pago: listo })
    // Otra pestaña lo confirmó al mismo tiempo: se devuelve lo que quedó guardado (sin sumar el plan dos veces).
    const { data: actual } = await admin.from('pagos').select('*').eq('id', pago.id).single()
    return json({ ok: actual?.estado === 'aprobado', pago: actual })
  }

  return json({ ok: false, motivo: 'accion-desconocida' }, 400)
})
