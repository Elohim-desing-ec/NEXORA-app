import { useState } from 'react'
import { BarChart3, Boxes, Database } from 'lucide-react'
import { useApp } from '../store/useApp'
import { Tabs, Titulo } from '../components/ui'
import TabResumen from './negocio/TabResumen'
import TabInventario from './negocio/TabInventario'
import TabDatos from './negocio/TabDatos'

export type TabNegocio = 'resumen' | 'inventario' | 'datos'
const TABS: { id: TabNegocio; label: string; icon: JSX.Element }[] = [
  { id: 'resumen', label: 'Resumen', icon: <BarChart3 size={14} /> },
  { id: 'inventario', label: 'Inventario', icon: <Boxes size={14} /> },
  { id: 'datos', label: 'Datos', icon: <Database size={14} /> },
]

/** "Tu negocio": resumen de ganancias y, en pestañas, inventario y datos (Ventas y Gastos están en Operación y Equipo en el Espacio de trabajo; todo sobre los mismos datos de NEXORA). */
export default function Resumen() {
  const { empresa, sucursal } = useApp()
  const [tab, setTab] = useState<TabNegocio>('resumen')
  return (
    <div className="space-y-5">
      <Titulo titulo="Tu negocio en números" sub={`${empresa.nombre || 'Su empresa'} · ${sucursal === 'TODAS' ? 'Toda la empresa' : `Sucursal ${sucursal} (sin gastos generales)`}`} />
      <Tabs items={TABS} valor={tab} onChange={setTab} />
      {tab === 'resumen' && <TabResumen irA={setTab} />}
      {tab === 'inventario' && <TabInventario />}
      {tab === 'datos' && <TabDatos />}
    </div>
  )
}
