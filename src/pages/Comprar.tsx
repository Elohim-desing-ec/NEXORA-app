import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Building2, Check, CreditCard, Download, Gift, Lock, Mail, PartyPopper, ShieldCheck, User as IconoUsuario } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Button, cx } from '../components/ui'
import { AccesoSocial } from '../components/Acceso'
import { useTx } from '../lib/idioma'
import { usePlanes } from '../lib/planes'
import { CORREO_NEXORA, DIAS_PRUEBA, enviarCorreo, esComprable, guardarDestino, iniciarPrueba, miAcceso, mensajeError, pruebaUsada, registrarCompra, supabase, tomarErrorRetorno, urlRetorno, type Acceso, type Licencia, type PlanComprable } from '../lib/cuenta'
import { entrarConAcceso } from '../lib/nube'
import { descargarRecibo } from '../lib/recibo'
import { formatoTarjeta, formatoVence, luhn, marcaTarjeta, soloDigitos, venceValido } from '../lib/tarjeta'
import { MarcoAcceso } from './Login'

const planDeRuta = () => new URLSearchParams(location.hash.split('?')[1] ?? '').get('plan') ?? ''

const Aviso = ({ tono = 'error', children }: { tono?: 'error' | 'ok' | 'info'; children: ReactNode }) =>
  <p role={tono === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3 py-2 text-xs', tono === 'error' && 'border-peligro/30 bg-peligro/10 text-peligro', tono === 'ok' && 'border-exito/30 bg-exito/10 text-exito', tono === 'info' && 'border-primario/30 bg-primario/10 text-fg')}>{children}</p>

function Paso({ n, titulo, activo, hecho }: { n: number; titulo: string; activo: boolean; hecho: boolean }) {
  return (
    <div className={cx('flex items-center gap-2 text-xs font-medium', activo ? 'text-fg' : 'text-muted')}>
      <span className={cx('grid h-6 w-6 place-items-center rounded-full border text-[11px]', hecho ? 'border-primario bg-primario text-black' : activo ? 'border-primario text-primario' : 'border-fg/20')}>{hecho ? <Check size={13} /> : n}</span>{titulo}
    </div>
  )
}

export default function Comprar() {
  const tx = useTx()
  const { empresas, emprendimientos, prueba } = usePlanes()
  const [nombrePlan, setNombrePlan] = useState(planDeRuta)
  useEffect(() => { const h = () => setNombrePlan(planDeRuta()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  const plan = [...empresas, ...emprendimientos, prueba].find((p) => p.nombre === nombrePlan)
  const esPrueba = plan?.nombre === 'Prueba'

  const [cuenta, setCuenta] = useState<User | null>(null)
  const [cargando, setCargando] = useState(true)
  const [acceso, setAcceso] = useState<Acceso | null>(null)
  const [usada, setUsada] = useState(false)
  const [hecho, setHecho] = useState<{ licencia: Licencia; titular: string; ultimos: string; correo: boolean | null } | null>(null)
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

  const listo = (licencia: Licencia, titular = '', ultimos = '') => {
    setHecho({ licencia, titular, ultimos, correo: null })
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
      <h1 className="text-center font-display text-2xl font-bold">{plan ? plan.nombre : tx('Plan no encontrado', 'Plan not found', 'Plano não encontrado')}</h1>
      <p className="mt-3 text-center text-sm text-muted">{plan
        ? tx('Este plan se cotiza a la medida de su red de sucursales. Escríbanos y le respondemos con una propuesta; para empezar hoy, elija NEXORA Nube o NEXORA Pro.', 'This plan is quoted for your branch network. Write to us for a proposal; to start today, choose NEXORA Cloud or NEXORA Pro.', 'Este plano é cotado para sua rede de filiais. Escreva-nos para uma proposta; para começar hoje, escolha NEXORA Nuvem ou NEXORA Pro.')
        : tx('Elija uno de los planes disponibles.', 'Choose one of the available plans.', 'Escolha um dos planos disponíveis.')}</p>
      {plan && <a href={`mailto:${CORREO_NEXORA}?subject=${encodeURIComponent('Cotización NEXORA Global')}`} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-primario/40 px-4 py-2.5 text-sm font-medium hover:bg-primario/10"><Mail size={15} />{CORREO_NEXORA}</a>}
      <Button variante="primario" className="mt-3 w-full !py-2.5" onClick={() => { location.hash = '#/planes' }}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>
    </MarcoAcceso>
  )

  // Situación de la cuenta frente al plan elegido.
  const planActual = acceso?.esDueno && acceso.vigente ? acceso.plan : null
  const mismo = !hecho && planActual === plan.nombre
  const pruebaNoDisponible = esPrueba && !hecho && (usada || !!planActual)
  const paso = !cuenta ? 1 : hecho || mismo ? 3 : 2
  const titulo = plan.titulo ?? plan.nombre

  return (
    <MarcoAcceso ancho="max-w-5xl">
      <div className="grid gap-8 md:grid-cols-[1fr_1.25fr]">
        {/* Resumen del plan */}
        <aside className="md:border-r md:border-fg/10 md:pr-8">
          <div className="text-xs uppercase tracking-[.2em] text-muted">{tx('Su plan', 'Your plan', 'Seu plano')} · {plan.tipo}</div>
          <div className="mt-1 font-display text-3xl font-bold">{titulo}</div>
          <div className="mt-3"><span className="texto-oro font-display text-4xl font-bold tnum">{plan.precio}</span><span className="ml-1 text-sm text-muted">{plan.unidad}</span></div>
          <p className="mt-2 text-xs text-muted">{plan.nota}</p>
          <ul className="mt-5 space-y-2 text-sm">{plan.incluye.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primario" /><span>{x}</span></li>)}</ul>
          <button onClick={() => { location.hash = '#/planes' }} className="mt-5 text-xs text-primario hover:underline">{tx('Cambiar de plan', 'Change plan', 'Trocar de plano')}</button>
          <div className="mt-6 flex items-start gap-2 rounded-xl border border-fg/10 bg-fg/5 p-3 text-[11px] text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-primario" />{esPrueba
            ? tx('Sin tarjeta. Al terminar los 14 días elige un plan y sus datos se conservan.', 'No card. After 14 days choose a plan and keep your data.', 'Sem cartão. Após 14 dias escolha um plano e mantenha seus dados.')
            : tx('Al terminar el pago su cuenta queda habilitada al instante para ingresar a NEXORA.', 'Once payment is done your account is enabled instantly to enter NEXORA.', 'Ao concluir o pagamento sua conta é liberada na hora para entrar no NEXORA.')}</div>
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
                      <p className="text-sm text-muted">{planActual ? tx(`Su cuenta ya tiene ${planActual} activo.`, `Your account already has ${planActual} active.`, `Sua conta já tem ${planActual} ativo.`) : tx('Esta cuenta ya usó su prueba gratis. Elija un plan para seguir usando NEXORA: sus datos se conservan.', 'This account already used its free trial. Choose a plan to keep using NEXORA: your data is kept.', 'Esta conta já usou o teste grátis. Escolha um plano para continuar: seus dados são mantidos.')}</p>
                      {planActual ? <Button variante="primario" className="w-full !py-2.5" disabled={entrando} onClick={entrarAhora}>{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></Button>
                        : <Button variante="primario" className="w-full !py-2.5" onClick={() => { location.hash = '#/planes' }}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>}
                    </div>
                  : <PasoPrueba cuenta={cuenta!} onListo={(l) => listo(l)} onOtraCuenta={() => supabase.auth.signOut()} />
                : <PasoPago cuenta={cuenta!} plan={plan.nombre as PlanComprable} precio={`${plan.precio} ${plan.unidad}`.trim()} planActual={planActual} onListo={listo} onOtraCuenta={() => supabase.auth.signOut()} />)
            : <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
                <PartyPopper className="mx-auto text-primario" size={40} />
                <h2 className="mt-3 font-display text-2xl font-bold">{hecho ? (esPrueba ? tx('¡Su prueba gratis empezó!', 'Your free trial started!', 'Seu teste grátis começou!') : tx('¡Compra completada!', 'Purchase complete!', 'Compra concluída!')) : tx('Ya tiene este plan', 'You already have this plan', 'Você já tem este plano')}</h2>
                <p className="mt-2 text-sm text-muted">{esPrueba && hecho
                  ? tx(`Tiene ${DIAS_PRUEBA} días para usar NEXORA con la cuenta ${cuenta?.email}.`, `You have ${DIAS_PRUEBA} days to use NEXORA with ${cuenta?.email}.`, `Você tem ${DIAS_PRUEBA} dias para usar o NEXORA com ${cuenta?.email}.`)
                  : tx(`La cuenta ${cuenta?.email} tiene ${hecho?.licencia.plan ?? planActual} activo. Ya puede ingresar a NEXORA.`, `Account ${cuenta?.email} has ${hecho?.licencia.plan ?? planActual} active. You can now enter NEXORA.`, `A conta ${cuenta?.email} tem ${hecho?.licencia.plan ?? planActual} ativo. Já pode entrar no NEXORA.`)}</p>
                {hecho && <p className="mt-2 text-xs text-muted">{hecho.correo === null ? tx('Enviando su correo de bienvenida…', 'Sending your welcome email…', 'Enviando seu e-mail de boas-vindas…') : hecho.correo ? tx(`Le enviamos la bienvenida${esPrueba ? '' : ' y el comprobante'} a ${cuenta?.email}.`, `We emailed your welcome${esPrueba ? '' : ' and receipt'} to ${cuenta?.email}.`, `Enviamos as boas-vindas${esPrueba ? '' : ' e o comprovante'} para ${cuenta?.email}.`) : ''}</p>}
                <Button variante="primario" className="mt-6 w-full !py-3" disabled={entrando} onClick={entrarAhora}>{entrando ? tx('Abriendo NEXORA…', 'Opening NEXORA…', 'Abrindo o NEXORA…') : <>{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></>}</Button>
                {hecho && !esPrueba && hecho.licencia.id && <Button className="mt-2 w-full" onClick={() => descargarRecibo({ id: hecho.licencia.id!, plan: hecho.licencia.plan, precio: hecho.licencia.precio, empresa: hecho.licencia.empresa, titular: hecho.titular, ultimos: hecho.ultimos, fecha: hecho.licencia.creada, email: cuenta?.email ?? '' })}><Download size={15} />{tx('Descargar comprobante (PDF)', 'Download receipt (PDF)', 'Baixar comprovante (PDF)')}</Button>}
              </motion.div>}
        </section>
      </div>
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
      <p className="mt-4 text-center text-xs text-muted">{modo === 'crear'
        ? <>{tx('¿Ya tiene cuenta?', 'Already have an account?', 'Já tem conta?')} <button onClick={() => { setModo('entrar'); onError('') }} className="font-semibold text-primario hover:underline">{tx('Ingrese', 'Sign in', 'Entre')}</button></>
        : <>{tx('¿Es nuevo?', 'New here?', 'É novo?')} <button onClick={() => { setModo('crear'); onError('') }} className="font-semibold text-primario hover:underline">{tx('Cree una cuenta', 'Create an account', 'Crie uma conta')}</button></>}</p>
    </div>
  )
}

function PasoPago({ cuenta, plan, precio, planActual, onListo, onOtraCuenta }: { cuenta: User; plan: PlanComprable; precio: string; planActual: string | null; onListo: (l: Licencia, titular: string, ultimos: string) => void; onOtraCuenta: () => void }) {
  const tx = useTx()
  const [empresa, setEmpresa] = useState('')
  const [titular, setTitular] = useState(String(cuenta.user_metadata?.full_name ?? ''))
  const [tarjeta, setTarjeta] = useState('')
  const [vence, setVence] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const marca = marcaTarjeta(tarjeta)

  const pagar = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    if (!luhn(tarjeta)) return setError(tx('Número de tarjeta inválido', 'Invalid card number', 'Número de cartão inválido'))
    if (!venceValido(vence)) return setError(tx('Fecha de vencimiento inválida o vencida (MM/AA)', 'Invalid or expired date (MM/YY)', 'Data de validade inválida ou vencida (MM/AA)'))
    if (!/^\d{3,4}$/.test(cvc)) return setError(tx('Código de seguridad inválido', 'Invalid security code', 'Código de segurança inválido'))
    setOcupado(true)
    await new Promise((r) => setTimeout(r, 1200)) // "procesando pago" (simulado)
    try { onListo(await registrarCompra({ plan, precio, empresa, titular, tarjeta }), titular, soloDigitos(tarjeta).slice(-4)) }
    catch (err) { setError(mensajeError(err, tx)); setOcupado(false) }
  }

  return (
    <div>
      <h2 className="mb-1 font-display text-xl font-bold">{tx('Datos de pago', 'Payment details', 'Dados de pagamento')}</h2>
      <p className="mb-4 text-xs text-muted">{tx('Cuenta', 'Account', 'Conta')}: <span className="text-fg">{cuenta.email}</span> · <button onClick={onOtraCuenta} className="text-primario hover:underline">{tx('cambiar', 'change', 'trocar')}</button></p>
      {planActual && <div className="mb-3"><Aviso tono="info">{tx(`Su plan actual (${planActual}) se reemplazará por ${plan} al pagar. Sus datos se conservan.`, `Your current plan (${planActual}) will be replaced by ${plan}. Your data is kept.`, `Seu plano atual (${planActual}) será substituído por ${plan}. Seus dados são mantidos.`)}</Aviso></div>}
      <Aviso tono="info">{tx('Pago de demostración: no se cobra dinero. Use una tarjeta de prueba como 4242 4242 4242 4242, cualquier fecha futura y CVC 123.', 'Demo payment: no money is charged. Use a test card like 4242 4242 4242 4242, any future date and CVC 123.', 'Pagamento de demonstração: nada é cobrado. Use um cartão de teste como 4242 4242 4242 4242, qualquer data futura e CVC 123.')}</Aviso>
      <form onSubmit={pagar} className="mt-4 space-y-3">
        <div className="relative"><Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required autoComplete="organization" aria-label={tx('Empresa', 'Company', 'Empresa')} className="inp pl-9" placeholder={tx('Nombre de su empresa', 'Your company name', 'Nome da sua empresa')} value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
        <div className="relative"><IconoUsuario size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required autoComplete="cc-name" aria-label={tx('Titular de la tarjeta', 'Cardholder name', 'Titular do cartão')} className="inp pl-9" placeholder={tx('Titular de la tarjeta', 'Cardholder name', 'Titular do cartão')} value={titular} onChange={(e) => setTitular(e.target.value)} /></div>
        <div className="relative"><CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required inputMode="numeric" autoComplete="cc-number" aria-label={tx('Número de tarjeta', 'Card number', 'Número do cartão')} className="inp pl-9 pr-28 tnum" placeholder="1234 5678 9012 3456" value={tarjeta} onChange={(e) => setTarjeta(formatoTarjeta(e.target.value))} />{marca && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">{marca}</span>}</div>
        <div className="grid grid-cols-2 gap-3">
          <input required inputMode="numeric" autoComplete="cc-exp" aria-label={tx('Vencimiento (MM/AA)', 'Expiry (MM/YY)', 'Validade (MM/AA)')} className="inp tnum" placeholder={tx('MM/AA', 'MM/YY', 'MM/AA')} value={vence} onChange={(e) => setVence(formatoVence(e.target.value))} />
          <input required inputMode="numeric" autoComplete="cc-csc" aria-label="CVC" className="inp tnum" placeholder="CVC" value={cvc} onChange={(e) => setCvc(soloDigitos(e.target.value).slice(0, 4))} />
        </div>
        {error && <Aviso>{error}</Aviso>}
        <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-3">{ocupado ? tx('Procesando pago…', 'Processing payment…', 'Processando pagamento…') : <><Lock size={15} />{tx(`Pagar ${precio}`, `Pay ${precio}`, `Pagar ${precio}`)}</>}</Button>
      </form>
    </div>
  )
}
