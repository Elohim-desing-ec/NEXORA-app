/** Respaldo completo de NEXORA en un archivo .json (datos del sistema + análisis económico). */
import { useApp } from '../store/useApp'
import { useEcon } from '../store/useEcon'

export function descargarRespaldo() {
  const econ = useEcon.getState()
  const blob = new Blob([JSON.stringify({ app: 'NEXORA', version: 3, fecha: new Date().toISOString(), datos: useApp.getState().respaldo(), economico: { p: econ.p, escenarios: econ.escenarios, evaluaciones: econ.evaluaciones, activa: econ.activa } }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `NEXORA_respaldo_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href)
}

/** Restaura un respaldo (pide confirmación). Devuelve 'ok', 'cancelado' o 'invalido'. */
export async function cargarRespaldo(f: File): Promise<'ok' | 'cancelado' | 'invalido'> {
  try {
    const j = JSON.parse(await f.text())
    if (j.app !== 'NEXORA' || !j.datos?.usuarios) return 'invalido'
    if (!confirm(`¿Restaurar el respaldo del ${new Date(j.fecha).toLocaleString('es-EC')}? Reemplaza todos los datos actuales.`)) return 'cancelado'
    useApp.getState().restaurar(j.datos)
    if (j.economico) useEcon.setState({ p: j.economico.p, escenarios: j.economico.escenarios ?? [], ...(j.economico.evaluaciones ? { evaluaciones: j.economico.evaluaciones, activa: j.economico.activa ?? 'ejemplo' } : {}) })
    return 'ok'
  } catch { return 'invalido' }
}
