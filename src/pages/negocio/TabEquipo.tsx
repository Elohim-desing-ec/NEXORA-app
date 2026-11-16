import { ArrowRight } from 'lucide-react'
import { useApp, permisosDe, rolesDe, tieneRol } from '../../store/useApp'
import { Badge, Button, Card, Scroll } from '../../components/ui'
import { EDITAN } from '../../lib/resumen'

/** Quién usa "Tu negocio" y qué puede hacer. Los usuarios se crean y editan en Configuración. */
export default function TabEquipo() {
  const { usuarios, usuario, ir } = useApp()
  const acceso = (u: Parameters<typeof permisosDe>[0]) => !permisosDe(u).includes('resumen') ? ['gris', 'Sin acceso a esta sección'] as const : rolesDe(u).some((r) => EDITAN.includes(r)) ? ['verde', 'Registra ventas, gastos, productos y cierres'] as const : ['azul', 'Solo puede mirar'] as const
  return (
    <Card titulo="Su equipo" accion={tieneRol(usuario, 'Gerente General', 'Administrador de Sistemas') && <Button variante="primario" onClick={() => ir('configuracion')}>Crear o editar usuarios<ArrowRight size={14} /></Button>}>
      <p className="mb-4 text-sm text-muted">Cada persona entra con su propio usuario y contraseña. Lo que hace queda guardado en Trazabilidad con su nombre.</p>
      <Scroll><table className="tabla">
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Roles</th><th>En «Tu negocio»</th></tr></thead>
        <tbody>{usuarios.map((u) => { const [tono, txt] = acceso(u); return (
          <tr key={u.id}><td className="font-medium">{u.nombre}{u.id === usuario?.id && <span className="ml-2 text-xs text-primario">(usted)</span>}</td><td className="font-mono text-xs">{u.usuario}</td><td>{rolesDe(u).join(' · ')}</td><td><Badge tono={tono}>{txt}</Badge></td></tr>) })}</tbody>
      </table></Scroll>
    </Card>
  )
}
