import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, CreditCard, Download, Mail, Trash2, UserPlus, Users, XCircle } from 'lucide-react'
import { Badge, Button, Campo, Card, Scroll } from '../../components/ui'
import { ROLES } from '../../store/useApp'
import { cancelarPlan, diasRestantes, enviarCorreo, esComprable, guardarMiembro, historialCompras, historialPagos, listarMiembros, mensajeError, miAcceso, quitarMiembro, supabase, urlRetorno, type Acceso, type Compra, type Miembro, type Pago } from '../../lib/cuenta'
import { limitesDe } from '../../lib/planes'
import { money } from '../../lib/format'
import { useApp } from '../../store/useApp'
import { salir } from '../../lib/nube'
import { descargarRecibo } from '../../lib/recibo'
import { urlGmail } from '../../lib/google'
import { useTx } from '../../lib/idioma'

const fecha = (d: string) => new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })

/** Texto de la invitación (para enviarla desde el Gmail de quien invita). */
function invitacionGmail(m: { email: string; nombre: string; rol: string }, empresa: string, quien: string) {
  const cuerpo = `Hola${m.nombre ? ' ' + m.nombre : ''},\n\nLe di acceso a NEXORA, el sistema de inventario de ${empresa || 'nuestra empresa'}, como ${m.rol}.\n\nPara entrar:\n1. Abra ${urlRetorno()}#/login\n2. Elija "Continuar con Google" con este correo (${m.email}), o cree una cuenta con este mismo correo.\n\nSaludos,\n${quien}`
  return urlGmail([m.email], `${empresa || 'Su empresa'} le invitó a NEXORA`, cuerpo)
}

export default function CuentaEquipo() {
  const tx = useTx()
  const [cuenta, setCuenta] = useState<User | null>(null)
  const [acceso, setAcceso] = useState<Acceso | null>(null)
  const [compras, setCompras] = useState<Compra[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const sucursales = useApp((st) => st.sucursales.length)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState<{ texto: string; gmail?: string } | null>(null)
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', rol: 'Vendedor' })
  const [ocupado, setOcupado] = useState(false)

  const cargar = async () => {
    setError('')
    try {
      const u = (await supabase.auth.getSession()).data.session?.user ?? null
      setCuenta(u)
      if (!u) return
      const a = await miAcceso()
      setAcceso(a)
      if (!a) return
      const [m, c, p] = await Promise.all([listarMiembros(a.empresaId), a.esDueno ? historialCompras() : Promise.resolve([]), a.esDueno ? historialPagos() : Promise.resolve([])])
      setMiembros(m); setCompras(c); setPagos(p)
    } catch (e) { setError(mensajeError(e, tx)) } finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const invitar = async (e: FormEvent) => {
    e.preventDefault()
    if (!acceso) return
    const email = nuevo.email.trim().toLowerCase()
    if (email === cuenta?.email?.toLowerCase()) return setError('Ese es su propio correo: usted ya es el titular.')
    const tope = limitesDe(acceso.plan).personas
    if (tope !== null && !miembros.some((x) => x.email === email) && miembros.length + 1 >= tope) return setError(`Su plan ${acceso.plan} permite ${tope} personas (usted incluido). Mejore su plan para invitar a más.`)
    setOcupado(true); setError(''); setAviso(null)
    try {
      await guardarMiembro(acceso.empresaId, { ...nuevo, email })
      const m = { email, nombre: nuevo.nombre.trim(), rol: nuevo.rol }
      // Se muestra al instante (una lectura justo después de guardar a veces aún no lo trae).
      setMiembros((l) => [...l.filter((x) => x.email !== email), { ...m, roles: [], creado: new Date().toISOString() }])
      setNuevo({ nombre: '', email: '', rol: nuevo.rol })
      if (await enviarCorreo({ tipo: 'invitacion', email })) setAviso({ texto: `Listo: le enviamos la invitación a ${email}.` })
      else setAviso({ texto: `${email} ya tiene acceso. Avísele con un correo: abra Gmail con la invitación lista y pulse Enviar.`, gmail: invitacionGmail(m, acceso.empresa, cuenta?.user_metadata?.full_name ?? cuenta?.email ?? '') })
    } catch (err) { setError(mensajeError(err, tx)) } finally { setOcupado(false) }
  }

  const quitar = async (m: Miembro) => {
    if (!acceso || !confirm(`¿Quitar a ${m.nombre || m.email} del equipo? Ya no podrá ingresar a NEXORA.`)) return
    try { await quitarMiembro(acceso.empresaId, m.email); setMiembros((l) => l.filter((x) => x.email !== m.email)) } catch (err) { setError(mensajeError(err, tx)) }
  }

  const cancelar = async () => {
    if (!confirm('¿Cancelar su plan? Usted y todo su equipo dejarán de poder ingresar a NEXORA. Sus datos se conservan si vuelve a comprar un plan.')) return
    try { await cancelarPlan(); await salir() } catch (err) { setError(mensajeError(err, tx)) }
  }

  if (cargando) return <Card><p className="py-6 text-center text-sm text-muted">Cargando su cuenta…</p></Card>

  if (!cuenta) return (
    <Card titulo={<span className="flex items-center gap-2"><CreditCard size={16} />Cuenta y equipo</span>}>
      <p className="text-sm text-muted">Ingresó con un usuario de este dispositivo. El plan, la facturación y las invitaciones del equipo los administra el titular desde su cuenta NEXORA (correo, Google o Facebook).</p>
    </Card>
  )

  const dias = acceso?.vence ? diasRestantes(acceso.vence) : null
  const lim = limitesDe(acceso?.plan)
  const pagado = !!acceso?.plan && esComprable(acceso.plan)
  const uso = (n: number, tope: number | null) => (tope === null ? `${n} (sin límite)` : `${n} de ${tope}`)
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-peligro/30 bg-peligro/10 px-3 py-2 text-xs text-peligro">{error}</p>}

      <Card titulo={<span className="flex items-center gap-2"><CreditCard size={16} />Su plan</span>}>
        {acceso ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">{acceso.plan === 'Prueba' ? 'Prueba gratis' : acceso.plan === 'Administrador' ? 'Administrador de NEXORA' : acceso.plan ?? 'Sin plan'}
              {!acceso.vigente ? <Badge tono="rojo">Vencido</Badge> : dias === null ? <Badge tono="verde">Activo</Badge> : dias <= 5 ? <Badge tono="ambar">{dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`}</Badge> : <Badge tono="verde">Hasta el {fecha(acceso.vence!)}</Badge>}</div>
            <div className="text-muted">Empresa: <span className="text-fg">{acceso.empresa || '—'}</span></div>
            <div className="text-muted">Cuenta: <span className="text-fg">{cuenta.email}</span></div>
            <div className="text-muted">Su rol: <span className="text-fg">{acceso.esDueno ? 'Titular de la cuenta (Gerente General)' : acceso.rol}</span></div>
            {acceso.esDueno && <div className="text-muted">Uso: <span className="text-fg">{uso(sucursales, lim.sucursales)} sucursales · {uso(miembros.length + 1, lim.personas)} personas</span></div>}
          </div>
          {acceso.plan === 'Administrador'
            ? <p className="text-xs text-muted sm:text-right">Acceso permanente de la creadora de NEXORA: sin pagos, sin vencimiento y sin límites.</p>
            : acceso.esDueno
            ? <div className="flex flex-col gap-2 sm:items-end">
                {pagado && <Button variante="primario" onClick={() => { location.hash = `#/comprar?plan=${encodeURIComponent(acceso.plan!)}&periodo=mensual` }}>Renovar {acceso.plan} <ArrowRight size={15} /></Button>}
                <Button variante={pagado ? 'vidrio' : 'primario'} onClick={() => { location.hash = '#/planes' }}>{acceso.plan === 'Prueba' || !acceso.vigente ? 'Elegir un plan' : 'Cambiar de plan'} <ArrowRight size={15} /></Button>
                {pagado && <p className="text-[11px] text-muted sm:text-right">Su plan no se renueva solo: renueve antes de que venza. Lo que pague se suma desde la fecha de vencimiento.</p>}
                {acceso.vigente && !pagado && acceso.plan !== 'Prueba' && <Button onClick={cancelar} className="text-peligro"><XCircle size={15} />Cancelar plan</Button>}
              </div>
            : <p className="text-xs text-muted sm:text-right">El plan y la facturación los administra el titular de la cuenta.</p>}
        </div> : <p className="text-sm text-muted">Esta cuenta no tiene un plan. <a href="#/planes" className="text-primario hover:underline">Ver planes</a></p>}
      </Card>

      {acceso?.esDueno && pagos.length > 0 && <Card titulo="Pagos con Payphone">
        <Scroll><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2 pr-3">Fecha</th><th className="pr-3">Plan</th><th className="pr-3">Total</th><th className="pr-3">Vigencia</th><th className="pr-3">Tarjeta</th><th /></tr></thead>
          <tbody>{pagos.map((p) => <tr key={p.id} className="border-t border-fg/10">
            <td className="py-2 pr-3 whitespace-nowrap">{fecha(p.confirmado)}</td><td className="pr-3">{p.plan} · {p.periodo === 'anual' ? '1 año' : '1 mes'}</td><td className="pr-3 whitespace-nowrap">{money(p.monto / 100, 2)}</td>
            <td className="pr-3 whitespace-nowrap">{fecha(p.desde)} – {fecha(p.vence)}</td><td className="pr-3">{p.tarjeta || '—'}</td>
            <td className="text-right"><button title="Descargar comprobante" aria-label="Descargar comprobante" onClick={() => descargarRecibo({ id: p.id, plan: `${p.plan} (${p.periodo === 'anual' ? '1 año' : '1 mes'})`, precio: money(p.monto / 100, 2), empresa: p.empresa, titular: String(cuenta.user_metadata?.full_name ?? ''), formaPago: ['Payphone', p.tarjeta].filter(Boolean).join(' · '), fecha: p.confirmado, email: cuenta.email ?? '', vigencia: `${fecha(p.desde)} – ${fecha(p.vence)}` })} className="rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-fg"><Download size={15} /></button></td>
          </tr>)}</tbody>
        </table></Scroll>
      </Card>}

      {acceso?.esDueno && compras.length > 0 && <Card titulo="Compras anteriores (demostración)">
        <Scroll><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2 pr-3">Fecha</th><th className="pr-3">Plan</th><th className="pr-3">Precio</th><th className="pr-3">Tarjeta</th><th className="pr-3">Estado</th><th /></tr></thead>
          <tbody>{compras.map((c) => <tr key={c.id} className="border-t border-fg/10">
            <td className="py-2 pr-3 whitespace-nowrap">{fecha(c.creada)}</td><td className="pr-3">{c.plan}</td><td className="pr-3 whitespace-nowrap">{c.precio}</td><td className="pr-3">{c.tarjeta_ultimos ? `•••• ${c.tarjeta_ultimos}` : '—'}</td>
            <td className="pr-3">{c.estado === 'activa' ? <Badge tono="verde">Activa</Badge> : <Badge tono="gris">Reemplazada o cancelada</Badge>}</td>
            <td className="text-right"><button title="Descargar comprobante" aria-label="Descargar comprobante" onClick={() => descargarRecibo({ id: c.id, plan: c.plan, precio: c.precio, empresa: c.empresa, titular: c.titular, formaPago: c.tarjeta_ultimos ? `Tarjeta **** ${c.tarjeta_ultimos}` : '', fecha: c.creada, email: cuenta.email ?? '', demostracion: true })} className="rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-fg"><Download size={15} /></button></td>
          </tr>)}</tbody>
        </table></Scroll>
      </Card>}

      {acceso && <Card titulo={<span className="flex items-center gap-2"><Users size={16} />Equipo en la nube</span>}>
        <p className="mb-3 text-xs text-muted">Cada persona entra con su propio correo (o Google) y ve los mismos datos de la empresa en tiempo real, según su rol.</p>
        {miembros.length ? <Scroll><table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2 pr-3">Nombre</th><th className="pr-3">Correo</th><th className="pr-3">Rol</th><th /></tr></thead>
          <tbody>{miembros.map((m) => <tr key={m.email} className="border-t border-fg/10">
            <td className="py-2 pr-3">{m.nombre || '—'}</td><td className="pr-3">{m.email}</td><td className="pr-3">{m.rol}</td>
            <td className="whitespace-nowrap text-right">{acceso.esDueno && <>
              <a title="Enviar invitación por Gmail" aria-label="Enviar invitación por Gmail" href={invitacionGmail(m, acceso.empresa, cuenta.user_metadata?.full_name ?? cuenta.email ?? '')} target="_blank" rel="noreferrer" className="inline-block rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-fg"><Mail size={15} /></a>
              <button title="Quitar del equipo" aria-label="Quitar del equipo" onClick={() => quitar(m)} className="rounded-lg p-1.5 text-muted hover:bg-fg/10 hover:text-peligro"><Trash2 size={15} /></button>
            </>}</td>
          </tr>)}</tbody>
        </table></Scroll> : <p className="text-sm text-muted">Aún no ha invitado a nadie.</p>}

        {acceso.esDueno && <form onSubmit={invitar} className="mt-4 grid gap-3 border-t border-fg/10 pt-4 sm:grid-cols-[1fr_1.3fr_1fr_auto] sm:items-end">
          <Campo label="Nombre"><input className="inp" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej.: Ana Pérez" /></Campo>
          <Campo label="Correo"><input required type="email" className="inp" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} placeholder="ana@gmail.com" /></Campo>
          <Campo label="Rol"><select className="inp" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Campo>
          <Button variante="primario" type="submit" disabled={ocupado}><UserPlus size={15} />{ocupado ? 'Invitando…' : 'Invitar'}</Button>
        </form>}
        {aviso && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-exito/30 bg-exito/10 px-3 py-2 text-xs"><span className="flex-1">{aviso.texto}</span>{aviso.gmail && <a href={aviso.gmail} target="_blank" rel="noreferrer" className="rounded-lg bg-primario px-3 py-1 font-semibold text-black hover:brightness-110">Abrir Gmail</a>}</div>}
      </Card>}
    </div>
  )
}
