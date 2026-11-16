import { useState } from 'react'
import { BarChart3, Boxes, Database, Receipt, ShoppingBag, Users } from 'lucide-react'
import { useApp } from '../store/useApp'
import { Tabs, Titulo } from '../components/ui'
import TabResumen from './negocio/TabResumen'
import TabInventario from './negocio/TabInventario'
import TabVentas from './negocio/TabVentas'
import TabGastos from './negocio/TabGastos'
import TabDatos from './negocio/TabDatos'
import TabEquipo from './negocio/TabEquipo'

export type TabNegocio = 'resumen' | 'inventario' | 'ventas' | 'gastos' | 'datos' | 'equipo'
const TABS: { id: TabNegocio; label: string; icon: JSX.Element }[] = [
  { id: 'resumen', label: 'Resumen', icon: <BarChart3 size={14} /> },
  { id: 'inventario', label: 'Inventario', icon: <Boxes size={14} /> },
  { id: 'ventas', label: 'Ventas', icon: <ShoppingBag size={14} /> },
  { id: 'gastos', label: 'Gastos', icon: <Receipt size={14} /> },
  { id: 'datos', label: 'Datos', icon: <Database size={14} /> },
  { id: 'equipo', label: 'Equipo', icon: <Users size={14} /> },
]

/** "Tu negocio": resumen de ganancias y, en pestañas, inventario, ventas, gastos, datos y equipo (todo sobre los mismos datos de NEXORA). */
export default function Resumen() {
  const { empresa, sucursal } = useApp()
  const [tab, setTab] = useState<TabNegocio>('resumen')
  return (
    <div className="space-y-5">
      <Titulo titulo="Tu negocio en números" sub={`${empresa.nombre || 'Su empresa'} · ${sucursal === 'TODAS' ? 'Toda la empresa' : `Sucursal ${sucursal} (sin gastos generales)`}`} />
      <Tabs items={TABS} valor={tab} onChange={setTab} />
      {tab === 'resumen' && <TabResumen irA={setTab} />}
      {tab === 'inventario' && <TabInventario />}
      {tab === 'ventas' && <TabVentas />}
      {tab === 'gastos' && <TabGastos />}
      {tab === 'datos' && <TabDatos />}
      {tab === 'equipo' && <TabEquipo />}
    </div>
  )
}
