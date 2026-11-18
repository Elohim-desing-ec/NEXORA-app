import { useApp } from '../store/useApp'
import { Titulo } from '../components/ui'
import TabVentas from './negocio/TabVentas'

/** Ventas (Operación): registrar ventas y ver el historial. Es lo mismo que antes estaba en Resumen → Ventas. */
export default function Ventas() {
  const { empresa, sucursal } = useApp()
  return (
    <div className="space-y-5">
      <Titulo titulo="Ventas" sub={`${empresa.nombre || 'Su empresa'} · ${sucursal === 'TODAS' ? 'Toda la empresa' : `Sucursal ${sucursal}`}`} />
      <TabVentas />
    </div>
  )
}
