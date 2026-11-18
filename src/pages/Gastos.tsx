import { useApp } from '../store/useApp'
import { Titulo } from '../components/ui'
import TabGastos from './negocio/TabGastos'

/** Gastos (Operación): arriendo, sueldos, servicios… Es lo mismo que antes estaba en Resumen → Gastos. */
export default function Gastos() {
  const { empresa, sucursal } = useApp()
  return (
    <div className="space-y-5">
      <Titulo titulo="Gastos" sub={`${empresa.nombre || 'Su empresa'} · ${sucursal === 'TODAS' ? 'Toda la empresa' : `Sucursal ${sucursal}`}`} />
      <TabGastos />
    </div>
  )
}
