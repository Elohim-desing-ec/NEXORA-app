/** Comprobante de compra en PDF (pago simulado). jsPDF se descarga solo cuando se pide el comprobante. */
import { CORREO_NEXORA } from './cuenta'

export interface DatosRecibo { id: string; plan: string; precio: string; empresa: string; titular: string; ultimos: string; fecha: string; email: string }

export async function descargarRecibo(r: DatosRecibo) {
  const { default: JsPDF } = await import('jspdf')
  const d = new JsPDF({ unit: 'mm', format: 'a5' })
  const W = d.internal.pageSize.getWidth()
  const fecha = new Date(r.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

  d.setFillColor(28, 25, 23); d.rect(0, 0, W, 30, 'F')
  d.setFont('helvetica', 'bold'); d.setFontSize(20); d.setTextColor(228, 181, 74); d.text('NEXORA', 12, 16)
  d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(200, 200, 200); d.text('INTELLIGENT OPERATIONS', 12, 22)

  d.setTextColor(30, 30, 30); d.setFont('helvetica', 'bold'); d.setFontSize(14); d.text('Comprobante de compra', 12, 44)
  d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(110, 110, 110)
  d.text(`N.º ${r.id.slice(0, 8).toUpperCase()}   ·   ${fecha}`, 12, 50)

  const filas: [string, string][] = [['Cliente', r.email], ['Empresa', r.empresa || '—'], ['Titular', r.titular || '—'], ['Plan', r.plan], ['Forma de pago', r.ultimos ? `Tarjeta **** ${r.ultimos}` : '—']]
  let y = 62
  d.setFontSize(10)
  for (const [k, v] of filas) {
    d.setTextColor(120, 120, 120); d.text(k, 12, y)
    d.setTextColor(30, 30, 30); d.text(v, W - 12, y, { align: 'right' })
    d.setDrawColor(230, 230, 230); d.line(12, y + 3, W - 12, y + 3)
    y += 10
  }
  d.setFont('helvetica', 'bold'); d.setFontSize(12); d.setTextColor(30, 30, 30)
  d.text('Total', 12, y + 4); d.text(r.precio, W - 12, y + 4, { align: 'right' })

  d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(140, 140, 140)
  d.text('Pago de demostración: no se realizó ningún cobro real.', 12, y + 18)
  d.text(`Soporte: ${CORREO_NEXORA}`, 12, y + 23)
  d.save(`NEXORA-comprobante-${r.id.slice(0, 8).toUpperCase()}.pdf`)
}
