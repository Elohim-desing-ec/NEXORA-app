import { useEffect, useState, lazy, Suspense, useCallback, useSyncExternalStore, createElement, type ComponentType } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useApp, permisosDe, tieneRol, hidratado } from './store/useApp'
import { setMoneda } from './lib/format'
import { SIMBOLOS } from './data/paises'
import { Layout } from './components/Layout'
import { Splash } from './components/Splash'
import { DefsGraficos } from './components/charts'
import { useIdioma } from './lib/idioma'
import { recordarTema, temaGuardado } from './lib/temas'
import Login, { NuevaClave } from './pages/Login'
import { useRecuperando } from './lib/cuenta'
import Dashboard from './pages/Dashboard'

/**
 * Como lazy(), pero una vez descargada la página se dibuja al instante: React.lazy siempre "suspende" un cuadro
 * la primera vez que se muestra, y eso se veía como un parpadeo al cambiar de sección.
 */
const PRECARGAS: (() => Promise<unknown>)[] = []
function precargable<P extends object>(f: () => Promise<{ default: ComponentType<P> }>) {
  let listo: ComponentType<P> | null = null
  const cargar = () => f().then((m) => { listo = m.default; return m })
  const Lazy = lazy(cargar)
  PRECARGAS.push(cargar)
  return (props: P) => createElement((listo ?? Lazy) as ComponentType<P>, props)
}
const Resumen = precargable(() => import('./pages/Resumen'))
const Espacio = precargable(() => import('./pages/Espacio'))
const Productos = precargable(() => import('./pages/Productos'))
const Compras = precargable(() => import('./pages/Compras'))
const IA = precargable(() => import('./pages/IA'))
const Auditoria = precargable(() => import('./pages/Auditoria'))
const Reportes = precargable(() => import('./pages/Reportes'))
const Economico = precargable(() => import('./pages/Economico'))
const Configuracion = precargable(() => import('./pages/Configuracion'))
const RedGlobal = precargable(() => import('./pages/RedGlobal'))
const Bienvenida = lazy(() => import('./components/Bienvenida').then((m) => ({ default: m.Bienvenida })))
const Landing = precargable(() => import('./pages/Landing'))
const Comprar = lazy(() => import('./pages/Comprar'))
const Cargando = () => <div className="p-10 text-center text-muted">Cargando…</div>


export default function App() {
  const { usuario: sesion, pagina, tema, empresa, licencia } = useApp()
  // Sin un plan comprado nadie entra (ni sesiones guardadas de antes de exigir la licencia).
  const usuario = licencia ? sesion : null
  // IndexedDB carga de forma asíncrona: se espera antes de mostrar datos
  const listo = useSyncExternalStore((cb) => useApp.persist.onFinishHydration(cb), hidratado)
  setMoneda(SIMBOLOS[empresa.moneda] ?? empresa.moneda)
  const [hash, setHash] = useState(location.hash)
  const [intro, setIntro] = useState(true)
  const recuperando = useRecuperando()
  // Al entrar, descarga en segundo plano todas las secciones para que cambiar entre ellas sea instantáneo
  useEffect(() => { if (!usuario) return; const t = setTimeout(() => PRECARGAS.forEach((p) => p().catch(() => undefined)), 600); return () => clearTimeout(t) }, [usuario])
  const fin = useCallback(() => setIntro(false), [])
  useEffect(() => { document.documentElement.classList.toggle('dark', tema === 'oscuro') }, [tema])
  const idioma = useIdioma((s) => s.idioma)
  const temaColor = useApp((s) => (s.usuario ? s.temasColor?.[s.usuario.id] ?? 'oro' : null))
  useEffect(() => { const t = temaColor ?? temaGuardado(); document.documentElement.dataset.tema = t; if (temaColor) recordarTema(temaColor) }, [temaColor])
  useEffect(() => { document.documentElement.lang = idioma }, [idioma])
  useEffect(() => { const h = () => setHash(location.hash); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])

  let vista
  if (!listo) vista = null
  else if (recuperando) vista = <NuevaClave />
  else if (!usuario) vista = hash.startsWith('#/login') ? <Login /> : hash.startsWith('#/comprar') ? <Suspense fallback={null}><Comprar /></Suspense> : <Suspense fallback={null}><Landing /></Suspense>
  else {
    const p = permisosDe(usuario).includes(pagina) ? pagina : 'dashboard'
    const Pag = { dashboard: Dashboard, espacio: Espacio, resumen: Resumen, red: RedGlobal, productos: Productos, compras: Compras, ia: IA, auditoria: Auditoria, reportes: Reportes, economico: Economico, configuracion: Configuracion }[p]
    vista = <Layout><Suspense fallback={<Cargando />}><Pag />{tieneRol(usuario, 'Gerente General') && !empresa.configurada && <Bienvenida />}</Suspense></Layout>
  }
  return <>{vista}<DefsGraficos /><AnimatePresence>{intro && <Splash onFin={fin} />}</AnimatePresence></>
}
