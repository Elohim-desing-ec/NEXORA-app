import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plug, NotebookPen, SquareKanban, Users, UsersRound } from 'lucide-react'
import { useApp } from '../store/useApp'
import { Tabs } from '../components/ui'
import Tablero, { Avatares } from './espacio/Tablero'
import Notas from './espacio/Notas'
import Google from './espacio/Google'
import Equipo from './espacio/Equipo'
import TabEquipo from './negocio/TabEquipo'

/** Espacio de trabajo del equipo (estilo Notion): tablero de tareas, notas con bloques y herramientas de Google. */
export default function Espacio() {
  const { empresa, usuarios, usuario, tareas, notas } = useApp()
  const [tab, setTab] = useState<'tablero' | 'su-equipo' | 'equipo' | 'notas' | 'google'>('tablero')
  const cuenta = (e: string) => tareas.filter((t) => t.estado === e).length
  const hechas = cuenta('hecho'), total = tareas.filter((t) => t.estado !== 'archivado').length
  return (
    <div className="space-y-5">
      <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="glass relative overflow-hidden p-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,rgb(var(--t-oro)/.35),transparent_55%),radial-gradient(90%_120%_at_100%_0%,rgb(var(--t-oscuro)/.4),transparent_60%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
          <div>
            <div className="text-xs text-muted">Espacio de trabajo / {empresa.nombre || 'Mi empresa'}</div>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">Proyectos del equipo</h1>
            <p className="mt-1 text-sm text-muted">Asigne tareas, escriba notas y trabaje con Google, todo en el mismo lugar que su inventario.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            {[['Pendientes', cuenta('pendiente')], ['En progreso', cuenta('progreso')], ['Hechas', hechas], ['Notas', notas.length]].map(([t, v]) => <div key={t} className="text-center"><div className="font-display text-2xl font-bold">{v}</div><div className="text-[10px] uppercase tracking-[.18em] text-muted">{t}</div></div>)}
            <div className="flex items-center gap-2 rounded-full bg-fg/5 py-1 pl-1 pr-3 ring-1 ring-fg/10"><Avatares ids={usuarios.map((u) => u.id)} max={5} /><span className="text-xs text-muted">{usuarios.length} miembros</span></div>
          </div>
        </div>
        {total > 0 && <div className="relative h-1 bg-fg/10"><motion.div className="h-full bg-gradient-to-r from-violeta via-primario to-amber-200" initial={{ width: 0 }} animate={{ width: `${(hechas / total) * 100}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} /></div>}
      </motion.header>
      <Tabs items={[{ id: 'tablero', label: 'Tablero de tareas', icon: <SquareKanban size={14} /> }, { id: 'su-equipo', label: 'Equipo', icon: <UsersRound size={14} /> }, { id: 'equipo', label: 'Equipo y clientes', icon: <Users size={14} /> }, { id: 'notas', label: 'Notas', icon: <NotebookPen size={14} /> }, { id: 'google', label: 'Conexiones', icon: <Plug size={14} /> }]} valor={tab} onChange={setTab} />
      {tab === 'tablero' && <Tablero />}
      {/* «Su equipo»: antes era la pestaña Equipo de Resumen */}
      {tab === 'su-equipo' && <TabEquipo />}
      {tab === 'equipo' && <Equipo />}
      {tab === 'notas' && <Notas />}
      {tab === 'google' && <Google />}
      {usuario && <span className="sr-only">Sesión de {usuario.nombre}</span>}
    </div>
  )
}
