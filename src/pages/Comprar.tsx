import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Check, Download, Gift, Lock, Mail, PartyPopper, ShieldCheck, Smartphone, User as IconoUsuario, XCircle } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Button, cx } from '../components/ui'
import { AccesoSocial } from '../components/Acceso'
import { useTx } from '../lib/idioma'
import { money } from '../lib/format'
import { usePlanes, precioPartes, type Periodo } from '../lib/planes'
import { CORREO_NEXORA, DIAS_PRUEBA, confirmarPago, diasRestantes, enviarCorreo, esComprable, guardarDestino, iniciarPrueba, miAcceso, mensajeError, olvidarRetornoPago, prepararPago, pruebaUsada, retornoPago, supabase, tomarErrorRetorno, urlRetorno, type Acceso, type Licencia, type Pago, type PlanComprable } from '../lib/cuenta'
import { entrarConAcceso } from '../lib/nube'
import { descargarRecibo } from '../lib/recibo'
import { MarcoAcceso } from './Login'

const parametro = (k: string) => new URLSearchParams(location.hash.split('?')[1] ?? '').get(k) ?? ''
const fechaLarga = (d: string) => new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

const Aviso = ({ tono = 'error', children }: { tono?: 'error' | 'ok' | 'info'; children: ReactNode }) =>
  <p role={tono === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3 py-2 text-xs', tono === 'error' && 'border-peligro/30 bg-peligro/10 text-peligro', tono === 'ok' && 'border-exito/30 bg-exito/10 text-exito', tono === 'info' && 'border-primario/30 bg-primario/10 text-fg')}>{children}</p>

function Paso({ n, titulo, activo, hecho }: { n: number; titulo: string; activo: boolean; hecho: boolean }) {
  return (
    <div className={cx('flex items-center gap-2 text-xs font-medium', activo ? 'text-fg' : 'text-muted')}>
      <span className={cx('grid h-6 w-6 place-items-center rounded-full border text-[11px]', hecho ? 'border-primario bg-primario text-black' : activo ? 'border-primario text-primario' : 'border-fg/20')}>{hecho ? <Check size={13} /> : n}</span>{titulo}
    </div>
  )
}

/** Mensual / Anual (2 meses gratis). */
export function SelectorPeriodo({ valor, onChange }: { valor: Periodo; onChange: (p: Periodo) => void }) {
  const tx = useTx()
  return (
    <div className="inline-flex rounded-full border border-primario/30 bg-fg/5 p-1 text-xs font-semibold">
      {(['mensual', 'anual'] as const).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} className={cx('rounded-full px-4 py-1.5 transition', valor === p ? 'bg-gradient-to-r from-amber-200 via-primario to-violeta text-black' : 'text-muted hover:text-fg')}>
          {p === 'mensual' ? tx('Mensual', 'Monthly', 'Mensal') : <>{tx('Anual', 'Yearly', 'Anual')} <span className={valor === p ? '' : 'text-primario'}>· {tx('2 meses gratis', '2 months free', '2 meses grátis')}</span></>}
        </button>
      ))}
    </div>
  )
}

export default function Comprar() {
  const tx = useTx()
  const { planes, prueba } = usePlanes()
  const [nombrePlan, setNombrePlan] = useState(() => parametro('plan'))
  const [periodo, setPeriodo] = useState<Periodo>(() => (parametro('periodo') === 'anual' ? 'anual' : 'mensual'))
  useEffect(() => { const h = () => setNombrePlan(parametro('plan')); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const plan = [...planes, prueba].find((p) => p.nombre === nombrePlan)
  const esPrueba = plan?.nombre === 'Prueba'

  const [cuenta, setCuenta] = useState<User | null>(null)
  const [cargando, setCargando] = useState(true)
  const [acceso, setAcceso] = useState<Acceso | null>(null)
  const [usada, setUsada] = useState(false)
  const [hecho, setHecho] = useState<{ licencia: Licencia; correo: boolean | null } | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState(() => tomarErrorRetorno())

  // Sesión actual y, si existe, su plan y si ya usó la prueba gratis.
  useEffect(() => {
    let vivo = true
    const revisar = async (u: User | null) => {
      if (!vivo) return
      setCuenta(u)
      if (u) {
        try { const [a, us] = await Promise.all([miAcceso(), pruebaUsada()]); if (vivo) { setAcceso(a); setUsada(us) } }
        catch (e) { if (vivo) setError(mensajeError(e, tx)) }
      }
      if (vivo) setCargando(false)
    }
    supabase.auth.getSession().then(({ data }) => revisar(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => revisar(s?.user ?? null), 0) })
    return () => { vivo = false; data.subscription.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pruebaLista = (licencia: Licencia) => {
    setHecho({ licencia, correo: null })
    enviarCorreo({ tipo: 'recibo' }).then((correo) => setHecho((h) => (h ? { ...h, correo } : h)))
  }

  const entrarAhora = async () => {
    if (!cuenta) return
    setEntrando(true); setError('')
    try {
      const r = await entrarConAcceso(cuenta)
      if (r.estado === 'ok') location.hash = '#/login'
      else setError(tx('No encontramos un plan vigente en esta cuenta.', 'No active plan found on this account.', 'Nenhum plano vigente nesta conta.'))
    } catch (e) { setError(mensajeError(e, tx)) } finally { setEntrando(false) }
  }

  if (!plan || (!esPrueba && !esComprable(plan.nombre))) return (
    <MarcoAcceso>
      <h1 className="text-center font-display text-2xl font-bold">{tx('Elija su plan', 'Choose your plan', 'Escolha seu plano')}</h1>
      <p className="mt-3 text-center text-sm text-muted">{tx('Ese plan ya no está disponible. Vea los planes para emprendimientos o escríbanos si su empresa necesita algo a la medida.', 'That plan is no longer available. See the small-business plans or write to us for something tailored.', 'Esse plano não está mais disponível. Veja os planos ou escreva-nos para algo sob medida.')}</p>
      <a href={`mailto:${CORREO_NEXORA}?subject=${encodeURIComponent('NEXORA para mi empresa')}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-primario/40 px-4 py-2.5 text-sm font-medium hover:bg-primario/10"><Mail size={15} />{CORREO_NEXORA}</a>
      <Button variante="primario" className="mt-3 w-full !py-2.5" onClick={() => { location.hash = '#/planes' }}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>
    </MarcoAcceso>
  )

  // Situación de la cuenta frente al plan elegido.
  const vigente = acceso?.esDueno && acceso.vigente ? acceso : null
  const pruebaNoDisponible = esPrueba && !hecho && (usada || !!vigente?.plan)
  const paso = !cuenta ? 1 : hecho ? 3 : 2
  const titulo = plan.titulo ?? plan.nombre

  return (
    <MarcoAcceso ancho="max-w-5xl">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.25fr]">
        {/* Resumen del plan */}
        <aside className="md:border-r md:border-fg/10 md:pr-8">
          <div className="text-xs uppercase tracking-[.2em] text-muted">{tx('Su plan', 'Your plan', 'Seu plano')} · {plan.tipo}</div>
          <div className="mt-1 font-display text-3xl font-bold">{titulo}</div>
          {esPrueba
            ? <div className="mt-3"><span className="texto-oro font-display text-4xl font-bold tnum">{money(0, 0)}</span><span className="ml-1 text-sm text-muted">{tx('por 14 días', 'for 14 days', 'por 14 dias')}</span></div>
            : <>
                <div className="mt-4"><SelectorPeriodo valor={periodo} onChange={setPeriodo} /></div>
                <div className="mt-3"><span className="texto-oro font-display text-4xl font-bold tnum">{precioPartes(plan, periodo, tx)[0]}</span><span className="ml-1 text-sm text-muted">{precioPartes(plan, periodo, tx)[1]}</span></div>
                <p className="text-xs text-muted">{tx('IVA incluido', 'VAT included', 'IVA incluído')}{periodo === 'anual' ? ` · ${tx(`equivale a ${money(plan.anual / 12, 2)} al mes`, `equals ${money(plan.anual / 12, 2)} a month`, `equivale a ${money(plan.anual / 12, 2)} por mês`)}` : ''}</p>
              </>}
          <p className="mt-3 text-xs text-muted">{plan.nota}</p>
          <ul className="mt-5 space-y-2 text-sm">{plan.incluye.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primario" /><span>{x}</span></li>)}</ul>
          <button onClick={() => { location.hash = '#/planes' }} className="mt-5 text-xs text-primario hover:underline">{tx('Cambiar de plan', 'Change plan', 'Trocar de plano')}</button>
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-fg/10 bg-fg/5 p-3 text-[11px] text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-primario" />{esPrueba
            ? tx('Sin tarjeta. Al terminar los 14 días elige un plan y sus datos se conservan.', 'No card. After 14 days choose a plan and keep your data.', 'Sem cartão. Após 14 dias escolha um plano e mantenha seus dados.')
            : tx('Pago seguro con Payphone. Sin renovación automática: usted decide cuándo renovar y sus datos siempre se conservan.', 'Secure payment with Payphone. No automatic renewal: you decide when to renew and your data is always kept.', 'Pagamento seguro com Payphone. Sem renovação automática: você decide quando renovar e seus dados são mantidos.')}</div>
        </aside>

        {/* Pasos */}
        <section>
          <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2">
            <Paso n={1} titulo={tx('Cuenta', 'Account', 'Conta')} activo={paso === 1} hecho={paso > 1} />
            <Paso n={2} titulo={esPrueba ? tx('Empresa', 'Company', 'Empresa') : tx('Pago', 'Payment', 'Pagamento')} activo={paso === 2} hecho={paso > 2} />
            <Paso n={3} titulo={tx('Listo', 'Done', 'Pronto')} activo={paso === 3} hecho={false} />
          </div>
          {error && <div className="mb-4"><Aviso>{error}</Aviso></div>}
          {cargando ? <p className="py-10 text-center text-sm text-muted">{tx('Cargando…', 'Loading…', 'Carregando…')}</p>
            : paso === 1 ? <PasoCuenta plan={plan.nombre} onError={setError} />
            : paso === 2 ? (esPrueba
                ? pruebaNoDisponible
                  ? <div className="space-y-4 text-center">
                      <Gift className="mx-auto text-primario" size={36} />
                      <p className="text-sm text-muted">{vigente?.plan ? tx(`Su cuenta ya tiene ${vigente.plan} activo.`, `Your account already has ${vigente.plan} active.`, `Sua conta já tem ${vigente.plan} ativo.`) : tx('Esta cuenta ya usó su prueba gratis. Elija un plan para seguir usando NEXORA: sus datos se conservan.', 'This account already used its free trial. Choose a plan to keep using NEXORA: your data is kept.', 'Esta conta já usou o teste grátis. Escolha um plano para continuar: seus dados são mantidos.')}</p>
                      {vigente?.plan ? <Button variante="primario" className="w-full !py-2.5" disabled={entrando} onClick={entrarAhora}>{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></Button>
                        : <Button variante="primario" className="w-full !py-2.5" onClick={() => { location.hash = '#/planes' }}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>}
                    </div>
                  : <PasoPrueba cuenta={cuenta!} onListo={pruebaLista} onOtraCuenta={() => supabase.auth.signOut({ scope: 'local' })} />
                : <PasoPayphone cuenta={cuenta!} plan={plan.nombre as PlanComprable} periodo={periodo} total={periodo === 'anual' ? plan.anual : plan.mensual} acceso={acceso} onOtraCuenta={() => supabase.auth.signOut({ scope: 'local' })} />)
            : <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <PartyPopper className="mx-auto text-primario" size={40} />
                <h2 className="mt-3 font-display text-2xl font-bold">{tx('¡Su prueba gratis empezó!', 'Your free trial started!', 'Seu teste grátis começou!')}</h2>
                <p className="mt-2 text-sm text-muted">{tx(`Tiene ${DIAS_PRUEBA} días para usar NEXORA con la cuenta ${cuenta?.email}.`, `You have ${DIAS_PRUEBA} days to use NEXORA with ${cuenta?.email}.`, `Você tem ${DIAS_PRUEBA} dias para usar o NEXORA com ${cuenta?.email}.`)}</p>
                {hecho?.correo && <p className="mt-2 text-xs text-muted">{tx(`Le enviamos la bienvenida a ${cuenta?.email}.`, `We emailed your welcome to ${cuenta?.email}.`, `Enviamos as boas-vindas para ${cuenta?.email}.`)}</p>}
                <Button variante="primario" className="mt-6 w-full !py-3" disabled={entrando} onClick={entrarAhora}>{entrando ? tx('Abriendo NEXORA…', 'Opening NEXORA…', 'Abrindo o NEXORA…') : <>{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></>}</Button>
              </motion.div>}
        </section>
      </div>
    </MarcoAcceso>
  )
}

/** Paso de pago: prepara el cobro y lleva a la página segura de Payphone. */
function PasoPayphone({ cuenta, plan, periodo, total, acceso, onOtraCuenta }: { cuenta: User; plan: PlanComprable; periodo: Periodo; total: number; acceso: Acceso | null; onOtraCuenta: () => void }) {
  const tx = useTx()
  const tieneEmpresa = !!acceso?.esDueno
  const [empresa, setEmpresa] = useState(acceso?.esDueno ? acceso.empresa : '')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const vigente = acceso?.esDueno && acceso.vigente ? acceso : null
  const dias = vigente?.vence ? diasRestantes(vigente.vence) : null

  const pagar = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true)
    try { location.href = await prepararPago(plan, periodo, empresa) } // la persona paga en Payphone y vuelve a NEXORA
    catch (err) { setError(mensajeError(err, tx)); setOcupado(false) }
  }

  return (
    <form onSubmit={pagar} className="space-y-4">
      <div>
        <h2 className="mb-1 font-display text-xl font-bold">{tx('Pago', 'Payment', 'Pagamento')}</h2>
        <p className="text-xs text-muted">{tx('Cuenta', 'Account', 'Conta')}: <span className="text-fg">{cuenta.email}</span> · <button type="button" onClick={onOtraCuenta} className="text-primario hover:underline">{tx('cambiar', 'change', 'trocar')}</button></p>
      </div>
      {vigente?.plan === 'Prueba' && <Aviso tono="info">{tx('Su prueba gratis termina al pagar. Todos sus datos se conservan.', 'Your free trial ends when you pay. All your data is kept.', 'Seu teste grátis termina ao pagar. Todos os seus dados são mantidos.')}</Aviso>}
      {vigente?.plan && vigente.plan !== 'Prueba' && vigente.vence && <Aviso tono="info">{tx(`Su plan ${vigente.plan} vence el ${fechaLarga(vigente.vence)}${dias !== null ? ` (en ${dias} días)` : ''}. Lo que pague ahora se suma desde esa fecha: no pierde días.`, `Your ${vigente.plan} plan ends on ${fechaLarga(vigente.vence)}. What you pay now is added from that date: you lose no days.`, `Seu plano ${vigente.plan} vence em ${fechaLarga(vigente.vence)}. O que pagar agora soma a partir dessa data.`)}</Aviso>}
      {!tieneEmpresa && <div className="relative"><Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required autoComplete="organization" aria-label={tx('Empresa', 'Company', 'Empresa')} className="inp pl-9" placeholder={tx('Nombre de su empresa o emprendimiento', 'Your company or business name', 'Nome da sua empresa ou negócio')} value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>}

      <div className="rounded-xl border border-fg/10 bg-fg/5 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">{plan} · {periodo === 'anual' ? tx('1 año', '1 year', '1 ano') : tx('1 mes', '1 month', '1 mês')}</span><span className="tnum">{money(total, 2)}</span></div>
        <div className="mt-2 flex justify-between border-t border-fg/10 pt-2 font-semibold"><span>{tx('Total (IVA incluido)', 'Total (VAT included)', 'Total (IVA incluído)')}</span><span className="tnum">{money(total, 2)}</span></div>
      </div>

      {error && <Aviso>{error}</Aviso>}
      <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-3">{ocupado ? tx('Abriendo Payphone…', 'Opening Payphone…', 'Abrindo Payphone…') : <><Lock size={15} />{tx(`Pagar ${money(total, 2)} con Payphone`, `Pay ${money(total, 2)} with Payphone`, `Pagar ${money(total, 2)} com Payphone`)}</>}</Button>
      <p className="flex items-start gap-2 text-[11px] text-muted"><Smartphone size={14} className="mt-0.5 shrink-0" />{tx('Pagará en la página segura de Payphone con tarjeta de crédito o débito, o con la app Payphone. Al terminar volverá a NEXORA y su plan se activa al instante.', 'You will pay on Payphone\'s secure page with a credit/debit card or the Payphone app. Then you return to NEXORA and your plan is activated instantly.', 'Você pagará na página segura do Payphone com cartão ou com o app Payphone. Depois volta ao NEXORA e seu plano é ativado na hora.')}</p>
      <p className="text-center text-[11px] leading-relaxed text-muted">{tx('Al pagar acepta los', 'By paying you accept the', 'Ao pagar você aceita os')} <a href="terminos.html" target="_blank" rel="noopener" className="text-primario hover:underline">{tx('Términos y condiciones', 'Terms and conditions', 'Termos e condições')}</a>. {tx('Garantía de 7 días: si no le convence, le devolvemos su primer pago.', '7-day guarantee: if you are not satisfied, we refund your first payment.', 'Garantia de 7 dias: se não gostar, devolvemos seu primeiro pagamento.')}</p>
    </form>
  )
}

/** Al volver de Payphone (#/pago): confirma el pago y muestra el resultado. */
export function ResultadoPago() {
  const tx = useTx()
  const [estado, setEstado] = useState<'confirmando' | 'ok' | 'error' | 'sin-datos'>('confirmando')
  const [pago, setPago] = useState<Pago | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [correo, setCorreo] = useState<boolean | null>(null)
  const [cuenta, setCuenta] = useState<User | null>(null)
  const [entrando, setEntrando] = useState(false)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    supabase.auth.getSession().then(({ data }) => setCuenta(data.session?.user ?? null))
    const r = retornoPago()
    if (!r) { setEstado('sin-datos'); return }
    confirmarPago(r.id, r.clientTxId)
      .then((p) => { setPago(p); setEstado('ok'); enviarCorreo({ tipo: 'recibo' }).then(setCorreo) })
      .catch((e) => { setMensaje(String(e?.message ?? e)); setEstado('error') })
      .finally(olvidarRetornoPago)
  }, [])

  const entrar = async () => {
    if (!cuenta) { location.hash = '#/login'; return }
    setEntrando(true)
    try { const r = await entrarConAcceso(cuenta); location.hash = '#/login'; if (r.estado !== 'ok') setEntrando(false) } catch { location.hash = '#/login' }
  }

  return (
    <MarcoAcceso>
      {estado === 'confirmando' && <div className="py-6 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primario border-t-transparent" />
        <h1 className="mt-4 font-display text-xl font-bold">{tx('Confirmando su pago…', 'Confirming your payment…', 'Confirmando seu pagamento…')}</h1>
        <p className="mt-1 text-sm text-muted">{tx('No cierre esta ventana.', 'Please don\'t close this window.', 'Não feche esta janela.')}</p>
      </div>}
      {estado === 'ok' && pago && <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <PartyPopper className="mx-auto text-primario" size={40} />
        <h1 className="mt-3 font-display text-2xl font-bold">{tx('¡Pago aprobado!', 'Payment approved!', 'Pagamento aprovado!')}</h1>
        <p className="mt-2 text-sm text-muted">{tx(`Su plan ${pago.plan} está activo hasta el ${fechaLarga(pago.vence)}.`, `Your ${pago.plan} plan is active until ${fechaLarga(pago.vence)}.`, `Seu plano ${pago.plan} está ativo até ${fechaLarga(pago.vence)}.`)}</p>
        {correo && <p className="mt-1 text-xs text-muted">{tx(`Le enviamos el comprobante a ${cuenta?.email ?? 'su correo'}.`, `We emailed your receipt to ${cuenta?.email ?? 'your email'}.`, `Enviamos o comprovante para ${cuenta?.email ?? 'seu e-mail'}.`)}</p>}
        <Button variante="primario" className="mt-6 w-full !py-3" disabled={entrando} onClick={entrar}>{entrando ? tx('Abriendo NEXORA…', 'Opening NEXORA…', 'Abrindo o NEXORA…') : <>{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></>}</Button>
        <Button className="mt-2 w-full" onClick={() => descargarRecibo({ id: pago.id, plan: `${pago.plan} (${pago.periodo === 'anual' ? '1 año' : '1 mes'})`, precio: money(pago.monto / 100, 2), empresa: pago.empresa, titular: String(cuenta?.user_metadata?.full_name ?? ''), formaPago: ['Payphone', pago.tarjeta].filter(Boolean).join(' · '), fecha: pago.confirmado, email: cuenta?.email ?? '', vigencia: `${fechaLarga(pago.desde)} – ${fechaLarga(pago.vence)}` })}><Download size={15} />{tx('Descargar comprobante (PDF)', 'Download receipt (PDF)', 'Baixar comprovante (PDF)')}</Button>
      </motion.div>}
      {(estado === 'error' || estado === 'sin-datos') && <div className="text-center">
        <XCircle className="mx-auto text-peligro" size={40} />
        <h1 className="mt-3 font-display text-2xl font-bold">{estado === 'error' ? tx('El pago no se completó', 'The payment was not completed', 'O pagamento não foi concluído') : tx('No hay un pago para confirmar', 'No payment to confirm', 'Nenhum pagamento para confirmar')}</h1>
        <p className="mt-2 text-sm text-muted">{estado === 'error' ? `${mensaje}. ${tx('No se realizó ningún cobro. Puede intentarlo de nuevo.', 'You were not charged. You can try again.', 'Nada foi cobrado. Pode tentar novamente.')}` : tx('Si pagó y no ve su plan activo, escríbanos con el número de su transacción.', 'If you paid and your plan is not active, write to us with your transaction number.', 'Se pagou e o plano não está ativo, escreva-nos com o número da transação.')}</p>
        <Button variante="primario" className="mt-6 w-full !py-2.5" onClick={() => { location.hash = '#/planes' }}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>
        <a href={`mailto:${CORREO_NEXORA}?subject=${encodeURIComponent('Ayuda con mi pago de NEXORA')}`} className="mt-3 inline-block text-xs text-primario hover:underline">{CORREO_NEXORA}</a>
      </div>}
    </MarcoAcceso>
  )
}

function PasoPrueba({ cuenta, onListo, onOtraCuenta }: { cuenta: User; onListo: (l: Licencia) => void; onOtraCuenta: () => void }) {
  const tx = useTx()
  const [empresa, setEmpresa] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const empezar = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true)
    try { onListo(await iniciarPrueba(empresa)) } catch (err) { setError(mensajeError(err, tx)); setOcupado(false) }
  }
  return (
    <form onSubmit={empezar} className="space-y-3">
      <h2 className="mb-1 font-display text-xl font-bold">{tx('Su empresa', 'Your company', 'Sua empresa')}</h2>
      <p className="text-xs text-muted">{tx('Cuenta', 'Account', 'Conta')}: <span className="text-fg">{cuenta.email}</span> · <button type="button" onClick={onOtraCuenta} className="text-primario hover:underline">{tx('cambiar', 'change', 'trocar')}</button></p>
      <div className="relative"><Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required autoFocus autoComplete="organization" aria-label={tx('Empresa', 'Company', 'Empresa')} className="inp pl-9" placeholder={tx('Nombre de su empresa o emprendimiento', 'Your company or business name', 'Nome da sua empresa ou negócio')} value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
      {error && <Aviso>{error}</Aviso>}
      <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-3">{ocupado ? tx('Activando…', 'Activating…', 'Ativando…') : <><Gift size={15} />{tx(`Empezar mis ${DIAS_PRUEBA} días gratis`, `Start my ${DIAS_PRUEBA} free days`, `Começar meus ${DIAS_PRUEBA} dias grátis`)}</>}</Button>
    </form>
  )
}

function PasoCuenta({ plan, onError }: { plan: string; onError: (m: string) => void }) {
  const tx = useTx()
  const [modo, setModo] = useState<'crear' | 'entrar'>('crear')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault(); onError('')
    if (modo === 'crear' && clave.length < 8) return onError(tx('La contraseña debe tener al menos 8 caracteres', 'Password must be at least 8 characters', 'A senha deve ter pelo menos 8 caracteres'))
    setOcupado(true)
    if (modo === 'crear') {
      guardarDestino(`comprar:${plan}`) // si hay que confirmar el correo, el enlace vuelve aquí
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: clave, options: { data: { full_name: nombre.trim() }, emailRedirectTo: urlRetorno() } })
      setOcupado(false)
      if (error) return onError(mensajeError(error, tx))
      if (!data.session) setConfirmar(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
      setOcupado(false)
      if (error) onError(mensajeError(error, tx))
    }
  }

  if (confirmar) return (
    <div className="space-y-4 text-center">
      <Mail className="mx-auto text-primario" size={36} />
      <h2 className="font-display text-xl font-bold">{tx('Confirme su correo', 'Confirm your email', 'Confirme seu e-mail')}</h2>
      <p className="text-sm text-muted">{tx(`Le enviamos un enlace a ${email.trim()}. Ábralo en este mismo navegador y volverá aquí para terminar la compra.`, `We sent a link to ${email.trim()}. Open it in this same browser and you'll come back here to finish the purchase.`, `Enviamos um link para ${email.trim()}. Abra-o neste mesmo navegador e você voltará aqui para concluir a compra.`)}</p>
      <button onClick={() => setConfirmar(false)} className="text-xs text-primario hover:underline">{tx('Usar otro correo', 'Use another email', 'Usar outro e-mail')}</button>
    </div>
  )

  return (
    <div>
      <h2 className="mb-1 font-display text-xl font-bold">{modo === 'crear' ? tx('Cree su cuenta NEXORA', 'Create your NEXORA account', 'Crie sua conta NEXORA') : tx('Ingrese a su cuenta', 'Sign in to your account', 'Entre na sua conta')}</h2>
      <p className="mb-5 text-xs text-muted">{tx('Con esta cuenta ingresará a NEXORA después de comprar.', 'You will use this account to enter NEXORA after buying.', 'Você usará esta conta para entrar no NEXORA após comprar.')}</p>
      <AccesoSocial destino={`comprar:${plan}`} onError={onError} />
      <form onSubmit={enviar} className="space-y-3">
        {modo === 'crear' && <div className="relative"><IconoUsuario size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required autoComplete="name" aria-label={tx('Nombre completo', 'Full name', 'Nome completo')} className="inp pl-9" placeholder={tx('Nombre completo', 'Full name', 'Nome completo')} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>}
        <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required type="email" autoComplete="email" aria-label={tx('Correo electrónico', 'Email', 'E-mail')} className="inp pl-9" placeholder={tx('Correo electrónico', 'Email', 'E-mail')} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required type="password" autoComplete={modo === 'crear' ? 'new-password' : 'current-password'} aria-label={tx('Contraseña', 'Password', 'Senha')} className="inp pl-9" placeholder={modo === 'crear' ? tx('Contraseña (mínimo 8 caracteres)', 'Password (at least 8 characters)', 'Senha (mínimo 8 caracteres)') : tx('Contraseña', 'Password', 'Senha')} value={clave} onChange={(e) => setClave(e.target.value)} /></div>
        <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-2.5">{ocupado ? tx('Un momento…', 'One moment…', 'Um momento…') : <>{modo === 'crear' ? tx('Crear cuenta y continuar', 'Create account and continue', 'Criar conta e continuar') : tx('Ingresar y continuar', 'Sign in and continue', 'Entrar e continuar')} <ArrowRight size={16} /></>}</Button>
      </form>
      {modo === 'crear' && <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{tx('Al crear su cuenta acepta los', 'By creating an account you accept the', 'Ao criar sua conta você aceita os')} <a href="terminos.html" target="_blank" rel="noopener" className="text-primario hover:underline">{tx('Términos y condiciones', 'Terms and conditions', 'Termos e condições')}</a> {tx('y la', 'and the', 'e a')} <a href="privacidad.html" target="_blank" rel="noopener" className="text-primario hover:underline">{tx('Política de privacidad', 'Privacy policy', 'Política de privacidade')}</a>.</p>}
      <p className="mt-4 text-center text-xs text-muted">{modo === 'crear'
        ? <>{tx('¿Ya tiene cuenta?', 'Already have an account?', 'Já tem conta?')} <button onClick={() => { setModo('entrar'); onError('') }} className="font-semibold text-primario hover:underline">{tx('Ingrese', 'Sign in', 'Entre')}</button></>
        : <>{tx('¿Es nuevo?', 'New here?', 'É novo?')} <button onClick={() => { setModo('crear'); onError('') }} className="font-semibold text-primario hover:underline">{tx('Cree una cuenta', 'Create an account', 'Crie uma conta')}</button></>}</p>
    </div>
  )
}

