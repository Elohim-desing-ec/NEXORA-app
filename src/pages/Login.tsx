import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, KeyRound, Lock, Mail, ShieldCheck, User as IconoUsuario, Users } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { Horizonte } from '../components/Horizonte'
import { useApp, licenciaVigente } from '../store/useApp'
import { Fondo } from '../components/Layout'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { useTx } from '../lib/idioma'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { AccesoSocial } from '../components/Acceso'
import { enviarRecuperacion, mensajeError, pruebaUsada, supabase, terminarRecuperacion, tomarContinuar, tomarErrorRetorno, type Acceso } from '../lib/cuenta'
import { entrarConAcceso } from '../lib/nube'

/** Marco común de las pantallas de acceso (fondo, volver, idioma y tarjeta). */
export function MarcoAcceso({ children, ancho = 'max-w-md' }: { children: ReactNode; ancho?: string }) {
  const tx = useTx()
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden p-4 py-16"><Fondo />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh]"><Horizonte tamano={1700} className="top-[30%]" /></div>
      <a href="#/" className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-fg/10 bg-fg/5 px-3 py-1.5 text-xs backdrop-blur hover:bg-fg/10"><ArrowLeft size={14} />{tx('Conocer NEXORA', 'Discover NEXORA', 'Conhecer o NEXORA')}</a>
      <SelectorIdioma className="fixed right-4 top-4 z-10" />
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`glass relative z-10 w-full ${ancho} p-6 sm:p-8`}>
        {children}
      </motion.div>
    </div>
  )
}

const Aviso = ({ tono = 'error', children }: { tono?: 'error' | 'ok'; children: ReactNode }) =>
  <p role={tono === 'error' ? 'alert' : 'status'} className={tono === 'error' ? 'rounded-lg border border-peligro/30 bg-peligro/10 px-3 py-2 text-xs text-peligro' : 'rounded-lg border border-exito/30 bg-exito/10 px-3 py-2 text-xs text-exito'}>{children}</p>

const Encabezado = ({ titulo, sub }: { titulo: ReactNode; sub: ReactNode }) => (
  <>
    <div className="mb-6 flex justify-center"><Logo size={44} /></div>
    <h1 className="text-center font-display text-2xl font-bold tracking-tight">{titulo}</h1>
    <p className="mt-1 text-center text-sm text-muted">{sub}</p>
  </>
)

const verPlanes = () => { location.hash = '#/planes' }

const probarGratis = () => { location.hash = '#/comprar?plan=Prueba' }

type Modo = 'entrar' | 'recuperar' | 'enviado' | 'equipo'

export default function Login() {
  const tx = useTx()
  const { login, usuarios, licencia } = useApp()
  const [modo, setModo] = useState<Modo>('entrar')
  const [cuenta, setCuenta] = useState<User | null>(null)
  // Sin plan vigente: por qué (nunca compró / se venció) y si aún puede usar la prueba gratis.
  const [bloqueo, setBloqueo] = useState<{ motivo: 'sin-plan' | 'vencida'; acceso: Acceso | null; prueba: boolean } | null>(null)
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState(() => tomarErrorRetorno())
  const [ocupado, setOcupado] = useState(false)

  const continuar = async (u: User) => {
    setOcupado(true); setError('')
    try {
      // La sesión pudo cerrarse en otra pestaña: sin ella no se ve ninguna licencia.
      if (!(await supabase.auth.getSession()).data.session) { setCuenta(null); return }
      const r = await entrarConAcceso(u)
      if (r.estado !== 'ok') setBloqueo({ motivo: r.estado, acceso: r.acceso, prueba: (r.estado === 'sin-plan' || !!r.acceso?.esDueno) && !(await pruebaUsada()) })
    } catch (e) { setError(mensajeError(e, tx)) } finally { setOcupado(false) }
  }

  // Sesión ya abierta (o recién vuelta de Google/Facebook): se muestra la cuenta y, si viene de allá, sigue sola.
  useEffect(() => {
    let vivo = true
    const auto = tomarContinuar()
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      if (!vivo || !u) return
      setCuenta(u)
      if (auto) continuar(u)
    })
    return () => { vivo = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const otraCuenta = async () => { await supabase.auth.signOut({ scope: 'local' }); setCuenta(null); setBloqueo(null); setError('') }

  const entrar = async (e: FormEvent) => {
    e.preventDefault(); setOcupado(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setOcupado(false)
    if (error) return setError(mensajeError(error, tx))
    setCuenta(data.user); continuar(data.user)
  }

  const recuperar = async (e: FormEvent) => {
    e.preventDefault(); setOcupado(true); setError('')
    const { error } = await enviarRecuperacion(email)
    setOcupado(false)
    if (error) return setError(mensajeError(error, tx))
    setModo('enviado')
  }

  const entrarEquipo = (e: FormEvent) => {
    e.preventDefault()
    if (!licenciaVigente(licencia)) return setError(tx('Este equipo aún no tiene un plan activo. El titular de la cuenta debe comprar NEXORA e ingresar aquí primero.', 'This device has no active plan yet. The account owner must buy NEXORA and sign in here first.', 'Este dispositivo ainda não tem um plano ativo. O titular deve comprar o NEXORA e entrar aqui primeiro.'))
    const q = email.trim().toLowerCase()
    const u = usuarios.find((x) => x.usuario.toLowerCase() === q || (!!x.email && x.email.toLowerCase() === q))
    if (!u || u.clave !== clave) return setError(tx('Usuario o contraseña incorrectos', 'Wrong username or password', 'Usuário ou senha incorretos'))
    login(u)
  }

  const cambiar = (m: Modo) => { setModo(m); setError(''); setClave('') }

  // Cuenta abierta: continuar o, si no tiene plan, invitar a comprarlo.
  if (cuenta && modo === 'entrar') return (
    <MarcoAcceso>
      <Encabezado titulo={bloqueo ? tx('Active su plan', 'Activate your plan', 'Ative seu plano') : <>{tx('Bienvenido de', 'Welcome', 'Bem-vindo de')} <span className="texto-oro">{tx('nuevo', 'back', 'volta')}</span></>} sub={cuenta.email} />
      <div className="mt-6 space-y-3">
        {bloqueo
          ? <>
              <p className="text-center text-sm text-muted">{bloqueo.motivo === 'sin-plan'
                ? tx('Su cuenta está creada, pero aún no tiene un plan. Pruebe NEXORA gratis o elija un plan para habilitar el ingreso.', 'Your account exists but has no plan yet. Try NEXORA free or choose a plan to unlock it.', 'Sua conta existe, mas ainda não tem plano. Teste o NEXORA grátis ou escolha um plano.')
                : !bloqueo.acceso?.esDueno
                  ? tx(`El plan de ${bloqueo.acceso?.empresa || 'su empresa'} no está activo. Pida al titular de la cuenta que lo renueve.`, `${bloqueo.acceso?.empresa || 'Your company'}'s plan is not active. Ask the account owner to renew it.`, `O plano de ${bloqueo.acceso?.empresa || 'sua empresa'} não está ativo. Peça ao titular que o renove.`)
                  : tx('Su prueba gratis o su plan terminó. Elija un plan para seguir: sus datos se conservan.', 'Your free trial or plan ended. Choose a plan to continue: your data is kept.', 'Seu teste ou plano terminou. Escolha um plano para continuar: seus dados são mantidos.')}</p>
              {bloqueo.prueba && <Button variante="primario" className="w-full !py-2.5" onClick={probarGratis}>{tx('Probar gratis 14 días', 'Try free for 14 days', 'Testar grátis por 14 dias')} <ArrowRight size={16} /></Button>}
              {(bloqueo.motivo === 'sin-plan' || bloqueo.acceso?.esDueno) && <Button variante={bloqueo.prueba ? 'vidrio' : 'primario'} className="w-full !py-2.5" onClick={verPlanes}>{tx('Ver planes', 'See plans', 'Ver planos')} <ArrowRight size={16} /></Button>}
            </>
          : <Button variante="primario" className="w-full !py-2.5" disabled={ocupado} onClick={() => continuar(cuenta)}>{ocupado ? tx('Verificando su plan…', 'Checking your plan…', 'Verificando seu plano…') : <>{tx('Continuar a NEXORA', 'Continue to NEXORA', 'Continuar para o NEXORA')} <ArrowRight size={16} /></>}</Button>}
        {error && <Aviso>{error}</Aviso>}
        <button onClick={otraCuenta} className="w-full text-center text-xs text-muted hover:text-fg">{tx('Usar otra cuenta', 'Use another account', 'Usar outra conta')}</button>
      </div>
    </MarcoAcceso>
  )

  if (modo === 'recuperar' || modo === 'enviado') return (
    <MarcoAcceso>
      <Encabezado titulo={tx('Recuperar contraseña', 'Reset password', 'Recuperar senha')} sub={tx('Le enviaremos un enlace para crear una nueva', 'We will email you a link to create a new one', 'Enviaremos um link para criar uma nova')} />
      {modo === 'enviado'
        ? <div className="mt-6 space-y-4">
            <Aviso tono="ok">{tx(`Si existe una cuenta con ${email.trim()}, le llegará un correo en unos minutos. Abra el enlace en este mismo navegador para crear su nueva contraseña.`, `If an account exists for ${email.trim()}, an email will arrive in a few minutes. Open the link in this same browser to create your new password.`, `Se existir uma conta com ${email.trim()}, um e-mail chegará em alguns minutos. Abra o link neste mesmo navegador para criar sua nova senha.`)}</Aviso>
            <p className="text-center text-[11px] text-muted">{tx('¿No llegó? Revise la carpeta de spam.', 'Didn\'t get it? Check your spam folder.', 'Não chegou? Verifique o spam.')}</p>
            <Button className="w-full" onClick={() => cambiar('entrar')}><ArrowLeft size={15} />{tx('Volver a ingresar', 'Back to sign in', 'Voltar ao login')}</Button>
          </div>
        : <form onSubmit={recuperar} className="mt-6 space-y-3">
            <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus required type="email" autoComplete="email" aria-label={tx('Correo electrónico', 'Email', 'E-mail')} className="inp pl-9" placeholder={tx('Correo electrónico', 'Email', 'E-mail')} value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></div>
            {error && <Aviso>{error}</Aviso>}
            <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-2.5">{ocupado ? tx('Enviando…', 'Sending…', 'Enviando…') : <>{tx('Enviar enlace', 'Send link', 'Enviar link')} <ArrowRight size={16} /></>}</Button>
            <button type="button" onClick={() => cambiar('entrar')} className="w-full text-center text-xs text-muted hover:text-fg">{tx('Volver a ingresar', 'Back to sign in', 'Voltar ao login')}</button>
          </form>}
    </MarcoAcceso>
  )

  if (modo === 'equipo') return (
    <MarcoAcceso>
      <Encabezado titulo={tx('Acceso del equipo', 'Team access', 'Acesso da equipe')} sub={tx('Usuarios creados por su empresa en Configuración → Usuarios', 'Users created by your company in Settings → Users', 'Usuários criados pela empresa em Configurações → Usuários')} />
      <form onSubmit={entrarEquipo} className="mt-6 space-y-3">
        <div className="relative"><IconoUsuario size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus aria-label={tx('Usuario', 'Username', 'Usuário')} autoComplete="username" autoCapitalize="none" className="inp pl-9" placeholder={tx('Usuario', 'Username', 'Usuário')} value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></div>
        <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label={tx('Contraseña', 'Password', 'Senha')} autoComplete="current-password" type="password" className="inp pl-9" placeholder={tx('Contraseña', 'Password', 'Senha')} value={clave} onChange={(e) => { setClave(e.target.value); setError('') }} /></div>
        {error && <Aviso>{error}</Aviso>}
        <Button variante="primario" type="submit" className="w-full !py-2.5">{tx('Ingresar', 'Sign in', 'Entrar')} <ArrowRight size={16} /></Button>
        <p className="text-center text-[11px] text-muted">{tx('¿Olvidó su contraseña? El Gerente General puede cambiarla en Configuración → Usuarios.', 'Forgot your password? The General Manager can change it in Settings → Users.', 'Esqueceu a senha? O Gerente Geral pode alterá-la em Configurações → Usuários.')}</p>
        <button type="button" onClick={() => cambiar('entrar')} className="w-full text-center text-xs text-muted hover:text-fg">{tx('Ingresar con mi cuenta NEXORA', 'Sign in with my NEXORA account', 'Entrar com minha conta NEXORA')}</button>
      </form>
    </MarcoAcceso>
  )

  return (
    <MarcoAcceso>
      <Encabezado titulo={<>{tx('Bienvenido de', 'Welcome', 'Bem-vindo de')} <span className="texto-oro">{tx('nuevo', 'back', 'volta')}</span></>} sub={tx('Ingrese con la cuenta con la que compró NEXORA', 'Sign in with the account you bought NEXORA with', 'Entre com a conta com que comprou o NEXORA')} />
      <div className="mt-6">
        <AccesoSocial destino="login" onError={setError} />
        <form onSubmit={entrar} className="space-y-3">
          <div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required type="email" autoComplete="email" aria-label={tx('Correo electrónico', 'Email', 'E-mail')} className="inp pl-9" placeholder={tx('Correo electrónico', 'Email', 'E-mail')} value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></div>
          <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input required aria-label={tx('Contraseña', 'Password', 'Senha')} autoComplete="current-password" type="password" className="inp pl-9" placeholder={tx('Contraseña', 'Password', 'Senha')} value={clave} onChange={(e) => { setClave(e.target.value); setError('') }} /></div>
          <div className="text-right"><button type="button" onClick={() => cambiar('recuperar')} className="text-xs text-primario hover:underline">{tx('¿Olvidó su contraseña?', 'Forgot your password?', 'Esqueceu a senha?')}</button></div>
          {error && <Aviso>{error}</Aviso>}
          <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-2.5">{ocupado ? tx('Ingresando…', 'Signing in…', 'Entrando…') : <>{tx('Ingresar', 'Sign in', 'Entrar')} <ArrowRight size={16} /></>}</Button>
        </form>
        <div className="mt-6 space-y-2 border-t border-fg/10 pt-5 text-center text-xs text-muted">
          <p>{tx('¿Aún no tiene NEXORA?', 'Don\'t have NEXORA yet?', 'Ainda não tem o NEXORA?')} <button onClick={probarGratis} className="font-semibold text-primario hover:underline">{tx('Pruébelo gratis 14 días', 'Try it free for 14 days', 'Teste grátis por 14 dias')}</button> {tx('o', 'or', 'ou')} <button onClick={verPlanes} className="font-semibold text-primario hover:underline">{tx('elija un plan', 'choose a plan', 'escolha um plano')}</button></p>
          <button onClick={() => cambiar('equipo')} className="inline-flex items-center gap-1.5 hover:text-fg"><Users size={13} />{tx('Soy parte del equipo de una empresa', 'I\'m part of a company team', 'Faço parte da equipe de uma empresa')}</button>
          <p className="flex flex-wrap justify-center gap-x-3 gap-y-1"><a href="terminos.html" className="hover:text-fg hover:underline">{tx('Términos', 'Terms', 'Termos')}</a><a href="privacidad.html" className="hover:text-fg hover:underline">{tx('Privacidad', 'Privacy', 'Privacidade')}</a><a href="cookies.html" className="hover:text-fg hover:underline">Cookies</a><a href="seguridad.html" className="hover:text-fg hover:underline">{tx('Seguridad', 'Security', 'Segurança')}</a></p>
        </div>
      </div>
    </MarcoAcceso>
  )
}

/** Llega desde el correo de "¿Olvidó su contraseña?": crea la nueva y entra. */
export function NuevaClave() {
  const tx = useTx()
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (clave.length < 8) return setError(tx('La contraseña debe tener al menos 8 caracteres', 'Password must be at least 8 characters', 'A senha deve ter pelo menos 8 caracteres'))
    if (clave !== repetir) return setError(tx('Las contraseñas no coinciden', 'Passwords do not match', 'As senhas não coincidem'))
    setOcupado(true); setError('')
    const { data, error } = await supabase.auth.updateUser({ password: clave })
    if (error) { setOcupado(false); return setError(mensajeError(error, tx)) }
    try { await entrarConAcceso(data.user) } catch { /* sin plan: queda en la pantalla de ingreso */ }
    location.hash = '#/login'
    terminarRecuperacion()
  }
  return (
    <MarcoAcceso>
      <Encabezado titulo={tx('Nueva contraseña', 'New password', 'Nova senha')} sub={tx('Elija una contraseña de al menos 8 caracteres', 'Choose a password of at least 8 characters', 'Escolha uma senha de pelo menos 8 caracteres')} />
      <form onSubmit={guardar} className="mt-6 space-y-3">
        <div className="relative"><KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus type="password" autoComplete="new-password" aria-label={tx('Nueva contraseña', 'New password', 'Nova senha')} className="inp pl-9" placeholder={tx('Nueva contraseña', 'New password', 'Nova senha')} value={clave} onChange={(e) => { setClave(e.target.value); setError('') }} /></div>
        <div className="relative"><ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="password" autoComplete="new-password" aria-label={tx('Repetir contraseña', 'Repeat password', 'Repetir senha')} className="inp pl-9" placeholder={tx('Repetir contraseña', 'Repeat password', 'Repetir senha')} value={repetir} onChange={(e) => { setRepetir(e.target.value); setError('') }} /></div>
        {error && <Aviso>{error}</Aviso>}
        <Button variante="primario" type="submit" disabled={ocupado} className="w-full !py-2.5">{ocupado ? tx('Guardando…', 'Saving…', 'Salvando…') : <>{tx('Guardar y entrar', 'Save and sign in', 'Salvar e entrar')} <ArrowRight size={16} /></>}</Button>
      </form>
    </MarcoAcceso>
  )
}
