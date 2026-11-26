import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Bot, Check, Brain, Menu, X, FileBarChart2, Globe2, LineChart, ScanBarcode, ShieldCheck, Sparkles, TrendingDown, Workflow, Users, Cloud, History, Lock } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Horizonte } from '../components/Horizonte'
import { Fondo } from '../components/Layout'
import { Contador, cx } from '../components/ui'
import { money, num } from '../lib/format'
import { useIdioma, useTx } from '../lib/idioma'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { InstalarApp } from '../components/InstalarApp'
import { usePlanes, precioPartes, type Periodo } from '../lib/planes'
import { SelectorPeriodo } from './Comprar'
import { CORREO_NEXORA } from '../lib/cuenta'
import { ROLES } from '../store/useApp'

const suave = [0.16, 1, 0.3, 1] as const
const ingresar = () => { location.hash = '#/login' }
const comprar = (plan: string, periodo = 'mensual') => { location.hash = `#/comprar?plan=${encodeURIComponent(plan)}&periodo=${periodo}` }

/** Aparece al entrar en pantalla (scroll reveal). */
function Revelar({ children, retraso = 0, className }: { children: ReactNode; retraso?: number; className?: string }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.8, delay: retraso, ease: suave }}>{children}</motion.div>
}
function Cifra({ valor, formato, titulo }: { valor: number; formato: (v: number) => string; titulo: string }) {
  const ref = useRef(null), visto = useInView(ref, { once: true })
  return <div ref={ref} className="text-center"><div className="texto-oro font-display text-4xl font-bold sm:text-5xl">{visto ? <Contador valor={valor} formato={formato} /> : formato(0)}</div><div className="mt-2 text-xs uppercase tracking-[.2em] text-muted">{titulo}</div></div>
}

/** Datos de muestra del panel (ilustración de la portada, no son datos de un cliente). */
const DEMO = { ventas: 48250, margen: 38.4, quiebre: 3, rotacion: 6.2, meses: [62, 58, 71, 66, 74, 80, 77, 85, 83, 91, 88, 100] }

/** Maqueta del panel de NEXORA (ilustración en HTML, no una captura). */
function Maqueta() {
  const tx = useTx()
  const actual = DEMO.meses.length
  return (
    <div className="overflow-hidden rounded-2xl border border-primario/25 bg-[#070604]/95 shadow-[0_40px_120px_-30px_rgb(var(--t-oro)/.45)]">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3"><Logo size={22} /><div className="ml-6 hidden gap-5 text-[11px] text-stone-400 sm:flex">{['Dashboard', tx('Ventas', 'Sales', 'Vendas'), tx('Inventario', 'Inventory', 'Estoque'), tx('Compras', 'Purchasing', 'Compras'), tx('Reportes', 'Reports', 'Relatórios')].map((t, k) => <span key={t} className={k === 0 ? 'text-amber-200' : ''}>{t}</span>)}</div><div className="ml-auto h-6 w-6 rounded-full bg-gradient-to-br from-amber-200 to-amber-700" /></div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        {[[tx('Ventas del mes', 'Sales this month', 'Vendas do mês'), money(DEMO.ventas, 0)], [tx('Margen bruto', 'Gross margin', 'Margem bruta'), `${num(DEMO.margen, 1)} %`], [tx('Productos en quiebre', 'Out-of-stock products', 'Produtos em ruptura'), num(DEMO.quiebre, 0)], [tx('Rotación de inventario', 'Inventory turnover', 'Giro de estoque'), `${num(DEMO.rotacion, 1)}×`]].map(([t, v]) => <div key={t} className="rounded-xl border border-white/5 bg-white/[.03] p-3"><div className="text-[10px] text-stone-400">{t}</div><div className="mt-1 font-display text-lg font-semibold text-amber-100">{v}</div></div>)}
        <div className="rounded-xl border border-white/5 bg-white/[.03] p-3 sm:col-span-3"><div className="mb-3 flex justify-between text-[10px] text-stone-400"><span>{tx('Ventas de los últimos 12 meses', 'Sales over the last 12 months', 'Vendas dos últimos 12 meses')}</span><span className="text-amber-200">{tx('Mes actual: récord', 'This month: record high', 'Mês atual: recorde')}</span></div>
          <div className="flex h-28 items-end gap-1.5">{DEMO.meses.map((v, k) => <motion.div key={k} className={cx('flex-1 rounded-t bg-gradient-to-t', k + 1 === actual ? 'from-amber-600 via-amber-200 to-white shadow-[0_0_20px_rgb(var(--t-claro)/.8)]' : 'from-amber-900 via-violeta to-primario')} initial={{ height: 0 }} whileInView={{ height: `${v}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + k * 0.05, duration: 0.8, ease: suave }} />)}</div></div>
        <div className="rounded-xl border border-white/5 bg-white/[.03] p-3"><div className="text-[10px] text-stone-400">{tx('Sucursales', 'Branches', 'Filiais')}</div><GloboDibujo className="mx-auto mt-1 h-28 w-28" /></div>
      </div>
    </div>
  )
}

/** Globo dibujado en SVG con meridianos que giran (ilusión de rotación) y una ruta entre sucursales. */
function GloboDibujo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs><radialGradient id="gl" cx=".35" cy=".3"><stop offset="0" stopColor="rgb(var(--t-sombra))" /><stop offset="1" stopColor="#050403" /></radialGradient></defs>
      <circle cx="60" cy="60" r="52" fill="url(#gl)" stroke="rgb(var(--t-oro))" strokeOpacity=".6" />
      {[-30, 0, 30].map((y) => <ellipse key={y} cx="60" cy={60 + y} rx={Math.sqrt(52 * 52 - y * y)} ry={5} fill="none" stroke="rgb(var(--t-oro))" strokeOpacity=".25" />)}
      {[0, 1, 2, 3].map((k) => <ellipse key={k} cx="60" cy="60" rx="52" ry="52" fill="none" stroke="rgb(var(--t-claro))" strokeOpacity=".35" className="meridiano" style={{ animationDelay: `${-k * 2}s` }} />)}
      <motion.path d="M38 70 Q60 20 86 46" fill="none" stroke="rgb(var(--t-palido))" strokeWidth="1.6" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.6, delay: 0.5 }} />
      {[[38, 70], [86, 46], [70, 84]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.2" fill="rgb(var(--t-claro))" className="animate-destello" />)}
    </svg>
  )
}

function Bento({ icono, titulo, texto, children, className }: { icono: ReactNode; titulo: string; texto: string; children?: ReactNode; className?: string }) {
  return (
    <motion.div className={cx('glass glass-hover group relative overflow-hidden p-6', className)} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.7, ease: suave }}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primario/10 blur-3xl transition group-hover:bg-primario/25" />
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-primario/30 bg-primario/10 text-cian">{icono}</div>
      <h3 className="font-display text-lg font-semibold">{titulo}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{texto}</p>
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  )
}

const AVISO_COOKIES = 'nexora-aviso-cookies'
/** Aviso informativo de la primera visita: NEXORA solo usa almacenamiento necesario (no hay cookies de rastreo que aceptar). */
function AvisoCookies() {
  const tx = useTx()
  const [ver, setVer] = useState(() => { try { return !localStorage.getItem(AVISO_COOKIES) } catch { return false } })
  if (!ver) return null
  const cerrar = () => { try { localStorage.setItem(AVISO_COOKIES, '1') } catch { /* sin almacenamiento */ } setVer(false) }
  return (
    <motion.div role="region" aria-label={tx('Aviso de cookies', 'Cookie notice', 'Aviso de cookies')} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 0.6, ease: suave }}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-primario/25 bg-black/80 p-4 text-sm shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
      <p className="flex-1 text-xs leading-relaxed text-muted">{tx('NEXORA solo guarda en su dispositivo lo necesario para funcionar (su sesión y sus preferencias). No usamos cookies de publicidad ni de rastreo.', 'NEXORA only stores what it needs to work on your device (your session and preferences). We use no advertising or tracking cookies.', 'O NEXORA só guarda no seu dispositivo o necessário para funcionar (sua sessão e preferências). Não usamos cookies de publicidade nem de rastreamento.')} <a href="cookies.html" className="text-primario hover:underline">{tx('Más información', 'Learn more', 'Saiba mais')}</a></p>
      <button onClick={cerrar} className="shrink-0 rounded-full bg-gradient-to-r from-amber-200 via-primario to-violeta px-5 py-2 text-xs font-semibold text-black">{tx('Entendido', 'Got it', 'Entendi')}</button>
    </motion.div>
  )
}

export default function Landing() {
  const tx = useTx(), idioma = useIdioma((s) => s.idioma)
  const [periodo, setPeriodo] = useState<Periodo>('mensual')
  const [menu, setMenu] = useState(false)
  const secciones = [[tx('Funciones', 'Features', 'Funcionalidades'), '#funciones'], [tx('Soluciones', 'Solutions', 'Soluções'), '#objetivos'], [tx('Para quién', 'Who it\'s for', 'Para quem'), '#inversion'], [tx('Por qué NEXORA', 'Why NEXORA', 'Por que NEXORA'), '#economia'], [tx('Planes', 'Pricing', 'Planos'), '#planes']]
  const irA = (h: string) => { setMenu(false); document.querySelector(h)?.scrollIntoView({ behavior: 'smooth' }) }
  const { planes } = usePlanes()
  // #/planes (desde Ingresar o Comprar): baja directo a los planes
  useEffect(() => { if (location.hash === '#/planes') setTimeout(() => document.querySelector('#planes')?.scrollIntoView({ behavior: 'smooth' }), 300) }, [])
  const hero = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const panelY = useTransform(scrollYProgress, [0, 0.5], [0, -440])
  const panelRot = useTransform(scrollYProgress, [0, 0.55], [26, 0])
  const panelEsc = useTransform(scrollYProgress, [0, 0.55], [0.86, 1])
  const textoOp = useTransform(scrollYProgress, [0, 0.4], [1, 0])
  const textoY = useTransform(scrollYProgress, [0, 0.4], [0, -60])
  const arcoY = useTransform(scrollYProgress, [0, 0.5], [0, 120])
  const tarjeta = useRef<HTMLDivElement>(null)
  const { scrollYProgress: pt } = useScroll({ target: tarjeta, offset: ['start end', 'end start'] })
  const tarjetaRot = useTransform(pt, [0, 1], [-18, 18]), tarjetaRotX = useTransform(pt, [0, 1], [14, -10])

  return (
    <div className="relative min-h-full overflow-x-clip"><Fondo /><AvisoCookies />
      {/* Navegación */}
      <motion.nav className="fixed inset-x-0 top-0 z-40 border-b border-primario/10 bg-black/40 backdrop-blur-xl" initial={{ y: -80 }} animate={{ y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: suave }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6"><Logo size={30} />
          <div className="ml-6 hidden gap-6 text-sm text-muted md:flex">{secciones.map(([t, h]) => <a key={t} href={h} onClick={(e) => { e.preventDefault(); irA(h) }} className="transition hover:text-fg">{t}</a>)}</div>
          <InstalarApp className="ml-auto hidden md:flex" />
          <SelectorIdioma className="hidden md:flex" />
          <button onClick={ingresar} className="flex items-center gap-2 rounded-full max-md:ml-auto bg-gradient-to-r from-amber-200 via-primario to-violeta px-4 py-2 text-sm font-semibold text-black shadow-[0_8px_30px_-6px_rgb(var(--t-oro)/.6)] transition hover:brightness-110 sm:px-5">{tx('Ingresar', 'Sign in', 'Entrar')} <ArrowRight size={15} /></button>
          <button onClick={() => setMenu(!menu)} aria-label={menu ? tx('Cerrar menú', 'Close menu', 'Fechar menu') : tx('Abrir menú', 'Open menu', 'Abrir menu')} aria-expanded={menu} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-fg/15 bg-fg/5 md:hidden">{menu ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        {/* Menú del celular y la tablet: secciones, idioma e instalar la app */}
        {menu && <div className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-t border-primario/10 px-4 pb-4 pt-2 md:hidden">
          <div className="grid">{secciones.map(([t, h]) => <a key={t} href={h} onClick={(e) => { e.preventDefault(); irA(h) }} className="rounded-xl px-3 py-3 text-sm text-fg/90 transition hover:bg-fg/5">{t}</a>)}</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-fg/10 px-1 pt-3"><SelectorIdioma /><InstalarApp /></div>
        </div>}
      </motion.nav>

      {/* Hero con horizonte y panel que emerge al hacer scroll */}
      <section ref={hero} className="relative h-[200vh]">
        <div className="alto-pantalla sticky top-0 overflow-hidden">
          <motion.div className="absolute inset-x-0 h-[120vh]" style={{ y: arcoY, top: 'max(70vh, 660px)' }} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 2, ease: suave }}><Horizonte tamano={1800} className="top-0" /></motion.div>
          <motion.div style={{ opacity: textoOp, y: textoY }} className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pt-32 text-center sm:pt-36">
            <motion.button onClick={() => document.querySelector('#funciones')?.scrollIntoView({ behavior: 'smooth' })} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: suave }} className="flex items-center gap-2 rounded-full border border-primario/30 bg-black/40 p-1 pr-3 text-xs backdrop-blur">
              <span className="rounded-full bg-gradient-to-r from-amber-200 to-primario px-2.5 py-1 font-semibold text-black">{tx('Nuevo', 'New', 'Novo')}</span>{tx('Software de gestión para empresas y emprendimientos', 'Management software for companies and startups', 'Software de gestão para empresas e empreendedores')} <ArrowRight size={13} /></motion.button>
            <h1 className="mt-7 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              {[tx('El software de gestión', 'The management software', 'O software de gestão'), tx('para empresas', 'for companies', 'para empresas'), tx('que crecen.', 'that grow.', 'que crescem.')].map((l, k) => <motion.span key={l} className={cx('block', k === 2 && 'texto-oro')} initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.7 + k * 0.15, duration: 0.9, ease: suave }}>{l}</motion.span>)}
            </h1>
            <motion.p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 1 }}>{tx('NEXORA es el software empresarial para negocios que quieren crecer: controle ventas, inventario, compras, gastos y a su equipo en todas sus sucursales, con reportes que le dicen qué hacer. Desde un emprendimiento hasta una empresa con presencia en varios países.', 'NEXORA is business software for companies that want to grow: manage sales, inventory, purchasing, expenses and your team across every branch, with reports that tell you what to do. From a startup to a company operating in several countries.', 'O NEXORA é o software empresarial para negócios que querem crescer: controle vendas, estoque, compras, despesas e sua equipe em todas as filiais, com relatórios que dizem o que fazer. De um pequeno negócio a uma empresa presente em vários países.')}</motion.p>
            <motion.div className="mt-8 flex flex-wrap justify-center gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 0.8, ease: suave }}>
              <button onClick={() => comprar('Prueba')} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 via-primario to-violeta px-6 py-3 text-sm font-semibold text-black shadow-[0_10px_40px_-8px_rgb(var(--t-oro)/.7)] transition hover:brightness-110">{tx('Probar 14 días gratis', 'Try 14 days free', 'Testar 14 dias grátis')} <ArrowRight size={16} /></button>
              <button onClick={() => document.querySelector('#funciones')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full border border-fg/15 bg-fg/5 px-6 py-3 text-sm font-medium backdrop-blur transition hover:bg-fg/10">{tx('Ver cómo funciona', 'See how it works', 'Veja como funciona')}</button>
            </motion.div>
          </motion.div>
          <motion.div style={{ y: panelY, rotateX: panelRot, scale: panelEsc, transformPerspective: 1400, top: 'max(80vh, 760px)' }} className="absolute inset-x-0 z-20 mx-auto max-w-5xl origin-top px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1.2 }}><Maqueta /></motion.div>
        </div>
      </section>

      {/* Cifras */}
      <section className="relative mx-auto max-w-6xl px-4 py-20">
        <Revelar><p className="mb-10 text-center text-xs uppercase tracking-[.3em] text-muted">{tx('Listo para operar desde el primer día', 'Ready to run from day one', 'Pronto para operar desde o primeiro dia')}</p></Revelar>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <Cifra valor={47} formato={(v) => num(v, 0)} titulo={tx('Países y monedas', 'Countries and currencies', 'Países e moedas')} />
          <Cifra valor={ROLES.length} formato={(v) => num(v, 0)} titulo={tx('Roles de equipo', 'Team roles', 'Funções de equipe')} />
          <Cifra valor={3} formato={(v) => num(v, 0)} titulo={tx('Idiomas', 'Languages', 'Idiomas')} />
          <Cifra valor={14} formato={(v) => num(v, 0)} titulo={tx('Días de prueba gratis', 'Free trial days', 'Dias de teste grátis')} />
        </div>
      </section>

      {/* Funciones (bento) */}
      <section id="funciones" className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-20">
        <Revelar className="mx-auto mb-12 max-w-2xl text-center"><h2 className="font-display text-3xl font-bold sm:text-5xl">{tx('Todo su negocio,', 'Your whole business,', 'Todo o seu negócio,')} <span className="texto-oro">{tx('en un solo lugar', 'in one place', 'em um só lugar')}</span></h2><p className="mt-4 text-muted">{tx('Diseñado para una tienda o para una red multinacional.', 'Designed for a single store or a multinational network.', 'Feito para uma loja ou para uma rede multinacional.')}</p></Revelar>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Bento className="md:col-span-2" icono={<Globe2 size={20} />} titulo={tx('Red global en 3D', '3D global network', 'Rede global em 3D')} texto={tx('Todas sus sucursales sobre un globo terráqueo real: gírelo, acérquese hasta la calle y vea las transferencias entre países con tipos de cambio del día.', 'All your branches on a real globe: spin it, zoom down to street level and see transfers between countries with today\'s exchange rates.', 'Todas as suas filiais em um globo real: gire, aproxime até a rua e veja as transferências entre países com o câmbio do dia.')}>
            <div className="flex items-center gap-6"><GloboDibujo className="h-36 w-36 shrink-0" /><ul className="space-y-2 text-sm text-muted">{[tx('Sucursales en cualquier país', 'Branches in any country', 'Filiais em qualquer país'), tx('Direcciones reales de OpenStreetMap', 'Real addresses from OpenStreetMap', 'Endereços reais do OpenStreetMap'), tx('Vista oscura, clara y satélite', 'Dark, light and satellite views', 'Visão escura, clara e satélite')].map((t) => <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primario" />{t}</li>)}</ul></div>
          </Bento>
          <Bento icono={<Brain size={20} />} titulo={tx('IA predictiva', 'Predictive AI', 'IA preditiva')} texto={tx('Pronóstico de demanda a 30 días, punto de reorden y compras sugeridas en un clic.', '30-day demand forecast, reorder point and suggested purchases in one click.', 'Previsão de demanda de 30 dias, ponto de reposição e compras sugeridas em um clique.')}>
            <svg viewBox="0 0 200 60" className="w-full"><motion.path d="M0 50 C30 45 40 20 70 28 S110 50 130 30 S170 8 200 12" fill="none" stroke="rgb(var(--t-oro))" strokeWidth="2.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.8 }} /><path d="M130 30 S170 8 200 12" fill="none" stroke="rgb(var(--t-claro))" strokeWidth="2.5" strokeDasharray="4 5" /></svg>
          </Bento>
          <Bento icono={<FileBarChart2 size={20} />} titulo={tx('Reportes inteligentes', 'Smart reports', 'Relatórios inteligentes')} texto={tx('El sistema analiza sus datos y le dice qué hacer: quiebres, mermas, sobrestock y productos por vencer.', 'The system analyzes your data and tells you what to do: stockouts, shrinkage, overstock and expiring products.', 'O sistema analisa seus dados e diz o que fazer: rupturas, perdas, excesso de estoque e produtos a vencer.')}>
            <div className="space-y-1.5 text-xs">{[[tx('Crítico', 'Critical', 'Crítico'), 'bg-peligro'], [tx('Alerta', 'Warning', 'Alerta'), 'bg-alerta'], [tx('Oportunidad', 'Opportunity', 'Oportunidade'), 'bg-primario']].map(([t, c], k) => <motion.div key={t} className="flex items-center gap-2 rounded-lg bg-fg/5 px-2.5 py-1.5" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + k * 0.15 }}><span className={cx('h-2 w-2 rounded-full', c)} />{t}</motion.div>)}</div>
          </Bento>
          <Bento icono={<ScanBarcode size={20} />} titulo={tx('Inventario y kardex', 'Inventory and stock cards', 'Estoque e kardex')} texto={tx('Stock por sucursal, costo promedio ponderado, lotes, vencimientos, códigos de barras y QR.', 'Stock per branch, weighted average cost, batches, expiry dates, barcodes and QR codes.', 'Estoque por filial, custo médio ponderado, lotes, validades, códigos de barras e QR.')} />
          <Bento icono={<Bot size={20} />} titulo={tx('Asistente NEXORA', 'NEXORA assistant', 'Assistente NEXORA')} texto={tx('Pregunte en lenguaje natural: «¿cuánto stock hay de café?», «¿cómo registro una venta?».', 'Ask in plain language: “how much coffee is in stock?”, “how do I record a sale?”.', 'Pergunte em linguagem natural: “quanto café tem em estoque?”, “como registro uma venda?”.')} />
        </div>
      </section>

      {/* Objetivos + tarjeta dorada 3D */}
      <section id="objetivos" className="relative mx-auto grid max-w-7xl scroll-mt-24 items-center gap-12 px-4 py-24 lg:grid-cols-2">
        <div>
          <Revelar><h2 className="font-display text-3xl font-bold sm:text-5xl">{tx('Menos pérdidas.', 'Fewer losses.', 'Menos perdas.')}<br /><span className="texto-oro">{tx('Más control.', 'More control.', 'Mais controle.')}</span></h2><p className="mt-4 max-w-lg text-muted">{tx('NEXORA ordena la operación diaria para que usted dedique su tiempo a vender y a crecer.', 'NEXORA organizes daily operations so you can spend your time selling and growing.', 'O NEXORA organiza a operação diária para que você dedique seu tempo a vender e crescer.')}</p></Revelar>
          <div className="mt-8 space-y-4">{([[<TrendingDown key="a" size={18} />, tx('Reducir las pérdidas', 'Reduce losses', 'Reduzir as perdas'), tx('Kardex, control de mermas y vencimientos, y detección de anomalías con IA.', 'Stock cards, shrinkage and expiry control, and AI anomaly detection.', 'Kardex, controle de perdas e validades, e detecção de anomalias com IA.')], [<Workflow key="b" size={18} />, tx('Automatizar los procesos', 'Automate processes', 'Automatizar os processos'), tx('Reorden automático, órdenes con aprobación y carga masiva desde Excel.', 'Automatic reordering, purchase orders with approval and bulk upload from Excel.', 'Reposição automática, pedidos com aprovação e carga em massa pelo Excel.')], [<LineChart key="c" size={18} />, tx('Generar reportes inteligentes', 'Generate smart reports', 'Gerar relatórios inteligentes'), tx('Hallazgos con acciones recomendadas, en PDF y Excel con fórmulas reales.', 'Findings with recommended actions, in PDF and Excel with real formulas.', 'Descobertas com ações recomendadas, em PDF e Excel com fórmulas reais.')]] as const).map(([i, t, d], k) => (
            <Revelar key={t} retraso={k * 0.12}><div className="flex gap-4 rounded-2xl border border-primario/15 bg-fg/[.03] p-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-violeta text-black">{i}</div><div><div className="font-semibold">{t}</div><p className="text-sm text-muted">{d}</p></div></div></Revelar>))}</div>
        </div>
        <div ref={tarjeta} className="relative flex justify-center [perspective:1200px]">
          <motion.div style={{ rotateY: tarjetaRot, rotateX: tarjetaRotX }} className="relative aspect-[1.6] w-full max-w-md rounded-3xl bg-gradient-to-br from-amber-100 via-primario to-violeta p-[1px] shadow-[0_50px_120px_-30px_rgb(var(--t-oro)/.6)]">
            <div className="flex h-full flex-col justify-between rounded-3xl bg-gradient-to-br from-[rgb(var(--t-sombra))] via-[rgb(var(--t-sombra)/.45)] to-black p-7">
              <div className="flex items-center justify-between"><Logo size={26} /><Sparkles className="text-cian" size={20} /></div>
              <div><div className="text-xs uppercase tracking-[.25em] text-amber-100/60">{tx('Ventas del mes', 'Sales this month', 'Vendas do mês')}</div><div className="texto-oro mt-1 font-display text-5xl font-bold">{money(DEMO.ventas, 0)}</div></div>
              <div className="flex justify-between text-xs text-amber-100/70"><span>{tx('Margen', 'Margin', 'Margem')} {num(DEMO.margen, 1)} %</span><span>{tx('Quiebres', 'Stockouts', 'Rupturas')} {DEMO.quiebre}</span><span>{tx('Rotación', 'Turnover', 'Giro')} {num(DEMO.rotacion, 1)}×</span></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Para quién es y seguridad */}
      <section id="inversion" className="relative mx-auto grid max-w-6xl scroll-mt-24 gap-6 px-4 py-20 lg:grid-cols-2">
        <Revelar><div className="glass h-full p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{tx('Hecho para', 'Built for', 'Feito para')} <span className="texto-oro">{tx('su negocio', 'your business', 'o seu negócio')}</span></h2>
          <div className="mt-6 flex flex-wrap gap-2">{({ es: ['Emprendimientos', 'Pymes', 'Tiendas y boutiques', 'Distribuidoras', 'Cadenas de retail', 'Supermercados', 'Farmacias', 'Ferreterías', 'Restaurantes', 'Industrias', 'Repuestos', 'Servicios'], en: ['Startups', 'SMBs', 'Shops and boutiques', 'Distributors', 'Retail chains', 'Supermarkets', 'Pharmacies', 'Hardware stores', 'Restaurants', 'Manufacturers', 'Spare parts', 'Services'], pt: ['Empreendedores', 'PMEs', 'Lojas e boutiques', 'Distribuidoras', 'Redes de varejo', 'Supermercados', 'Farmácias', 'Lojas de ferragens', 'Restaurantes', 'Indústrias', 'Autopeças', 'Serviços'] })[idioma].map((c) => <span key={c} className="rounded-full border border-primario/25 bg-primario/10 px-3 py-1.5 text-xs">{c}</span>)}</div>
          <p className="mt-5 text-sm leading-relaxed text-muted">{tx('Desde el emprendimiento que vende por WhatsApp e Instagram hasta la empresa con bodegas y sucursales en varios países. NEXORA se adapta a su sector: prendas por color y talla, lotes y vencimientos, servicios sin stock y más.', 'From the startup selling on WhatsApp and Instagram to the company with warehouses and branches in several countries. NEXORA adapts to your industry: apparel by color and size, batches and expiry dates, services without stock and more.', 'Do pequeno negócio que vende pelo WhatsApp e Instagram à empresa com depósitos e filiais em vários países. O NEXORA se adapta ao seu setor: roupas por cor e tamanho, lotes e validades, serviços sem estoque e mais.')}</p>
        </div></Revelar>
        <Revelar retraso={0.12}><div className="glass h-full p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{tx('Seguro y', 'Secure and', 'Seguro e')} <span className="texto-oro">{tx('respaldado', 'backed up', 'protegido')}</span></h2>
          <ul className="mt-6 space-y-4 text-sm">{([[<Cloud key="a" size={16} />, tx('Datos en la nube', 'Cloud data', 'Dados na nuvem'), tx('Su información sincronizada entre todos sus equipos y sucursales.', 'Your data synced across all your devices and branches.', 'Seus dados sincronizados entre todos os dispositivos e filiais.')], [<Users key="b" size={16} />, tx('Roles y permisos', 'Roles and permissions', 'Funções e permissões'), tx('Cada persona ve y edita solo lo que le corresponde.', 'Each person sees and edits only what they should.', 'Cada pessoa vê e edita apenas o que lhe cabe.')], [<History key="c" size={16} />, tx('Auditoría y papelera', 'Audit log and trash', 'Auditoria e lixeira'), tx('Quién hizo qué y cuándo; lo eliminado se recupera con un clic.', 'Who did what and when; deleted items come back in one click.', 'Quem fez o quê e quando; o que foi excluído volta com um clique.')], [<Lock key="d" size={16} />, tx('Respaldo propio', 'Your own backup', 'Backup próprio'), tx('Descargue una copia completa de sus datos cuando quiera.', 'Download a full copy of your data whenever you want.', 'Baixe uma cópia completa dos seus dados quando quiser.')]] as const).map(([i, t, d]) => (
            <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primario/30 bg-primario/10 text-cian">{i}</span><span><span className="block font-semibold">{t}</span><span className="text-muted">{d}</span></span></li>))}</ul>
        </div></Revelar>
      </section>

      {/* Por qué NEXORA: comparación */}
      <section id="economia" className="relative mx-auto max-w-5xl scroll-mt-24 px-4 py-20">
        <Revelar className="text-center"><h2 className="font-display text-3xl font-bold sm:text-5xl">{tx('¿Por qué', 'Why', 'Por que')} <span className="texto-oro">NEXORA?</span></h2><p className="mx-auto mt-4 max-w-2xl text-muted">{tx('Deje atrás las hojas de cálculo sueltas y el software antiguo que nadie actualiza.', 'Leave behind scattered spreadsheets and old software nobody updates.', 'Deixe para trás planilhas soltas e o software antigo que ninguém atualiza.')}</p></Revelar>
        <Revelar retraso={0.15}><div className="glass mt-10 overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-fg/10 px-5 py-3 text-xs uppercase tracking-[.2em] text-muted sm:px-8"><span></span><span className="text-center">{tx('Hojas de cálculo / software antiguo', 'Spreadsheets / old software', 'Planilhas / software antigo')}</span><span className="texto-oro text-center font-semibold">NEXORA</span></div>
          {[tx('Stock al día en todas las sucursales', 'Up-to-date stock in every branch', 'Estoque em dia em todas as filiais'), tx('Avisos de quiebre, sobrestock y vencimientos', 'Stockout, overstock and expiry alerts', 'Alertas de ruptura, excesso e validade'), tx('Compras sugeridas con IA', 'AI-suggested purchases', 'Compras sugeridas com IA'), tx('Ventas, gastos y ganancias en tiempo real', 'Real-time sales, expenses and profit', 'Vendas, despesas e lucro em tempo real'), tx('Reportes en PDF y Excel en un clic', 'PDF and Excel reports in one click', 'Relatórios em PDF e Excel em um clique'), tx('Funciona en computadora, tablet y celular', 'Works on computer, tablet and phone', 'Funciona no computador, tablet e celular'), tx('Equipo con roles y auditoría', 'Team with roles and audit log', 'Equipe com funções e auditoria')].map((t, k) => (
            <div key={t} className={cx('grid grid-cols-[1.4fr_1fr_1fr] items-center px-5 py-3 text-sm sm:px-8', k % 2 === 0 && 'bg-fg/[.02]')}><span>{t}</span><span className="text-center text-muted"><X size={16} className="mx-auto opacity-50" /></span><span className="text-center"><Check size={18} className="mx-auto text-primario" /></span></div>))}
        </div></Revelar>
      </section>

      {/* Cómo empezar */}
      <section id="empezar" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
        <Revelar className="text-center"><h2 className="font-display text-3xl font-bold sm:text-5xl">{tx('Empiece', 'Start', 'Comece')} <span className="texto-oro">{tx('hoy', 'today', 'hoje')}</span></h2></Revelar>
        <div className="mt-10 grid gap-4 md:grid-cols-3">{[['01', tx('Configure su empresa', 'Set up your company', 'Configure sua empresa'), tx('País, moneda, identificación fiscal y sucursales ubicadas en el mapa.', 'Country, currency, tax ID and branches placed on the map.', 'País, moeda, identificação fiscal e filiais no mapa.')], ['02', tx('Cargue sus datos', 'Load your data', 'Carregue seus dados'), tx('Productos con la plantilla de Excel, proveedores y su equipo con roles.', 'Products with the Excel template, suppliers and your team with roles.', 'Produtos com o modelo do Excel, fornecedores e sua equipe com funções.')], ['03', tx('Opere y decida', 'Operate and decide', 'Opere e decida'), tx('Registre ventas y compras; la IA y los reportes hacen el resto.', 'Record sales and purchases; AI and reports do the rest.', 'Registre vendas e compras; a IA e os relatórios fazem o resto.')]].map(([n, t, d], k) => (
          <Revelar key={n} retraso={k * 0.12}><div className="glass glass-hover h-full p-6"><div className="texto-oro font-display text-4xl font-bold">{n}</div><div className="mt-3 font-semibold">{t}</div><p className="mt-1 text-sm text-muted">{d}</p></div></Revelar>))}</div>

        {/* Planes para emprendimientos (precios en src/lib/planes.ts y en la función payphone) */}
        <Revelar className="mt-20 scroll-mt-24 text-center"><div id="planes" className="scroll-mt-24" /><h3 className="font-display text-2xl font-bold sm:text-4xl">{tx('Elija su', 'Choose your', 'Escolha seu')} <span className="texto-oro">{tx('plan', 'plan', 'plano')}</span></h3><p className="mx-auto mt-3 max-w-2xl text-sm text-muted">{tx('Para emprendimientos y negocios que están creciendo. Empiece con 14 días gratis y pague mes a mes o por año.', 'For small and growing businesses. Start with 14 free days and pay monthly or yearly.', 'Para pequenos negócios e empresas em crescimento. Comece com 14 dias grátis e pague por mês ou por ano.')}</p>
          <div className="mt-6"><SelectorPeriodo valor={periodo} onChange={setPeriodo} /></div></Revelar>
        <Revelar className="mt-8"><button onClick={() => comprar('Prueba')} className="mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-primario/40 bg-primario/10 px-5 py-3 text-sm transition hover:bg-primario/20">
          <Sparkles size={16} className="text-primario" /><span><b>{tx('¿Quiere probar primero?', 'Want to try first?', 'Quer testar primeiro?')}</b> {tx('14 días gratis, sin tarjeta.', '14 days free, no card.', '14 dias grátis, sem cartão.')}</span><span className="flex items-center gap-1 font-semibold text-primario">{tx('Probar gratis', 'Try free', 'Testar grátis')} <ArrowRight size={14} /></span>
        </button></Revelar>
        <div className="mt-8 grid items-stretch gap-4 md:grid-cols-3">{planes.map((pl, k) => (
          <Revelar key={pl.nombre} retraso={k * 0.12} className="h-full"><div className={cx('glass relative flex h-full flex-col p-6 sm:p-7', pl.destacado && 'border-primario/60 shadow-[0_20px_60px_-20px_rgb(var(--t-oro)/.55)]')}>
            {pl.destacado && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-200 via-primario to-violeta px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-black">{tx('Recomendado', 'Recommended', 'Recomendado')}</span>}
            <div className="text-xs uppercase tracking-[.2em] text-muted">{pl.tipo}</div>
            <div className="mt-1 font-display text-2xl font-bold">{pl.nombre}</div>
            <div className="mt-4"><span className="texto-oro font-display text-4xl font-bold tnum">{precioPartes(pl, periodo, tx)[0]}</span><span className="ml-1 text-sm text-muted">{precioPartes(pl, periodo, tx)[1]}</span></div>
            <p className="text-[11px] text-muted">{tx('IVA incluido', 'VAT included', 'IVA incluído')}{periodo === 'anual' ? ` · ${tx('2 meses gratis', '2 months free', '2 meses grátis')}` : ''}</p>
            <p className="mt-1 min-h-[2.5rem] text-xs text-muted">{pl.nota}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">{pl.incluye.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primario" /><span>{x}</span></li>)}</ul>
            <button onClick={() => comprar(pl.nombre, periodo)} className={cx('mt-6 flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition', pl.destacado ? 'bg-gradient-to-r from-amber-200 via-primario to-violeta text-black hover:brightness-110' : 'border border-primario/40 hover:bg-primario/10')}>{pl.boton} <ArrowRight size={15} /></button>
          </div></Revelar>))}</div>
        <p className="mt-6 text-center text-xs text-muted">{tx('Pagos seguros con Payphone · sin renovación automática · cancele cuando quiera.', 'Secure payments with Payphone · no automatic renewal · cancel anytime.', 'Pagamentos seguros com Payphone · sem renovação automática · cancele quando quiser.')} {tx('¿Su empresa necesita más?', 'Need more for your company?', 'Sua empresa precisa de mais?')} <a href={`mailto:${CORREO_NEXORA}?subject=${encodeURIComponent('NEXORA para mi empresa')}`} className="text-primario hover:underline">{tx('Escríbanos', 'Write to us', 'Escreva-nos')}</a></p>
      </section>

      {/* Llamado final con horizonte */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden">
        <Horizonte tamano={1600} className="top-[48%]" />
        <Revelar className="relative z-10 mx-auto max-w-3xl px-4 pt-20 text-center">
          <ShieldCheck className="mx-auto mb-4 text-cian" size={30} />
          <h2 className="font-display text-4xl font-bold sm:text-6xl">{tx('Su operación,', 'Your operation,', 'Sua operação,')} <span className="texto-oro">{tx('iluminada.', 'illuminated.', 'iluminada.')}</span></h2>
          <button onClick={ingresar} className="mx-auto mt-8 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 via-primario to-violeta px-7 py-3 text-sm font-semibold text-black shadow-[0_10px_40px_-8px_rgb(var(--t-oro)/.7)] transition hover:brightness-110">{tx('Ingresar a NEXORA', 'Enter NEXORA', 'Entrar no NEXORA')} <ArrowRight size={16} /></button>
        </Revelar>
      </section>
      <footer className="relative border-t border-primario/10 bg-black/60 px-4 py-10 text-sm text-muted backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8"><div><Logo size={26} /><p className="mt-3 max-w-xs text-xs">{tx('Software de gestión empresarial para empresas y emprendimientos: ventas, inventario, compras y finanzas en un solo lugar.', 'Business management software for companies and startups: sales, inventory, purchasing and finance in one place.', 'Software de gestão empresarial para empresas e empreendedores: vendas, estoque, compras e finanças em um só lugar.')}</p><p className="mt-3 text-[11px]">© {new Date().getFullYear()} NEXORA · {tx('Hecho por', 'Made by', 'Feito por')} <span className="font-semibold text-fg">Elohim</span> · {tx('Todos los derechos reservados', 'All rights reserved', 'Todos os direitos reservados')}</p></div>
          <div className="flex flex-wrap gap-12 text-xs">
            <div><div className="mb-2 font-semibold text-fg">{tx('Producto', 'Product', 'Produto')}</div><ul className="space-y-1.5">{secciones.map(([t, h]) => <li key={t}><a href={h} onClick={(e) => { e.preventDefault(); irA(h) }} className="hover:text-fg">{t}</a></li>)}</ul></div>
            <div><div className="mb-2 font-semibold text-fg">{tx('Empresa', 'Company', 'Empresa')}</div><ul className="space-y-1.5"><li><a href={`mailto:${CORREO_NEXORA}`} className="hover:text-fg">{tx('Contacto', 'Contact', 'Contato')}</a></li><li><a href={`mailto:${CORREO_NEXORA}?subject=${encodeURIComponent('Soporte NEXORA')}`} className="hover:text-fg">{tx('Soporte', 'Support', 'Suporte')}</a></li></ul></div>
            <div><div className="mb-2 font-semibold text-fg">Legal</div><ul className="space-y-1.5"><li><a href="privacidad.html" className="hover:text-fg">{tx('Política de privacidad', 'Privacy policy', 'Política de privacidade')}</a></li><li><a href="cookies.html" className="hover:text-fg">{tx('Política de cookies', 'Cookie policy', 'Política de cookies')}</a></li><li><a href="seguridad.html" className="hover:text-fg">{tx('Seguridad', 'Security', 'Segurança')}</a></li></ul></div>
          </div></div>
      </footer>
    </div>
  )
}
