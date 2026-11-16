/** Exportación a Excel (con fórmulas reales) y PDF con el diseño de NEXORA: membrete negro y oro, tablas cuidadas y números de verdad. */
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable, { type CellHookData } from 'jspdf-autotable'
import * as F from './finance'
import type { Params } from './finance'
import { money, num, pct } from './format'
import { aNumero } from './numeros'
import { useApp } from '../store/useApp'

// ───────────── Diseño para Excel ─────────────
const COL = { negro: '0A0907', oro: 'D4AF37', marfil: 'FBF6EA', crema: 'F3E7C4', borde: 'E7DDC2', texto: '1C1917', claro: 'D6CFC0' }
const linea = { style: 'thin', color: { rgb: COL.borde } }
const bordes = { top: linea, bottom: linea, left: linea, right: linea }
const relleno = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } })
const ESTILO = {
  banda: { font: { name: 'Calibri', bold: true, sz: 16, color: { rgb: COL.oro } }, fill: relleno(COL.negro), alignment: { vertical: 'center', indent: 1 } },
  sub: { font: { name: 'Calibri', sz: 10, color: { rgb: COL.claro } }, fill: relleno(COL.negro), alignment: { vertical: 'center', indent: 1 } },
  cab: { font: { name: 'Calibri', bold: true, sz: 10, color: { rgb: COL.negro } }, fill: relleno(COL.oro), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bordes },
  celda: (par: boolean) => ({ font: { name: 'Calibri', sz: 10, color: { rgb: COL.texto } }, fill: relleno(par ? COL.marfil : 'FFFFFF'), alignment: { vertical: 'center' }, border: bordes }),
  total: { font: { name: 'Calibri', bold: true, sz: 10, color: { rgb: COL.texto } }, fill: relleno(COL.crema), alignment: { vertical: 'center' }, border: { ...bordes, top: { style: 'medium', color: { rgb: COL.oro } } } },
}
const derecha = <T extends { alignment?: object }>(s: T) => ({ ...s, alignment: { ...s.alignment, horizontal: 'right' } })
const archivoSeguro = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'NEXORA'

type Fila = (string | number)[]
/** Hoja con membrete NEXORA, encabezados dorados, filas alternas, números con formato, filtros y anchos automáticos. */
function hojaBonita(titulo: string, head: string[], body: Fila[]) {
  const empresa = useApp.getState().empresa.nombre || 'Mi empresa'
  const n = Math.max(head.length, ...body.map((r) => r.length), 1), r0 = 4
  const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet([[`NEXORA · ${empresa}`], [`${titulo} · ${new Date().toLocaleString('es-EC')}`], [], head])
  body.forEach((fila, i) => fila.forEach((x, c) => {
    const ref = XLSX.utils.encode_cell({ r: r0 + i, c }), nu = aNumero(x)
    ws[ref] = nu ? { t: 'n', v: nu.v, z: nu.z } : { t: 's', v: String(x ?? '') }
  }))
  const ultima = XLSX.utils.encode_col(n - 1)
  ws['!ref'] = `A1:${ultima}${r0 + body.length}`
  const celda = (r: number, c: number) => { const ref = XLSX.utils.encode_cell({ r, c }); return (ws[ref] ??= { t: 's', v: '' }) as XLSX.CellObject & { s?: unknown } }
  for (let c = 0; c < n; c++) { celda(0, c).s = ESTILO.banda; celda(1, c).s = ESTILO.sub; celda(3, c).s = ESTILO.cab }
  body.forEach((fila, i) => { const total = /^total/i.test(String(fila[0] ?? '')); for (let c = 0; c < n; c++) { const cel = celda(r0 + i, c), base = total ? ESTILO.total : ESTILO.celda(i % 2 === 1); cel.s = cel.t === 'n' ? derecha(base) : base } })
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: n - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: n - 1 } }]
  ws['!cols'] = Array.from({ length: n }, (_, c) => ({ wch: Math.min(48, Math.max(10, String(head[c] ?? '').length + 2, ...body.map((r) => String(r[c] ?? '').length + 2))) }))
  const anchos = ws['!cols'] as { wch: number }[], falta = Math.max(`NEXORA · ${empresa}`.length * 1.5, `${titulo} · ${new Date().toLocaleString('es-EC')}`.length) - anchos.reduce((a, c) => a + c.wch, 0)
  if (falta > 0) anchos[anchos.length - 1].wch += Math.ceil(falta)
  ws['!rows'] = [{ hpt: 30 }, { hpt: 18 }, { hpt: 6 }, { hpt: 24 }]
  if (body.length) ws['!autofilter'] = { ref: `A4:${ultima}${r0 + body.length}` }
  return ws
}

type Celda = string | number | { f: string } | null
/** Hoja del análisis con fórmulas reales (sin mover celdas) y el diseño de NEXORA. */
const hoja = (filas: Celda[][], anchos?: number[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas.map((r) => r.map((c) => (c && typeof c === 'object' ? null : c))))
  filas.forEach((r, ri) => r.forEach((c, ci) => { if (c && typeof c === 'object') ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = { t: 'n', f: c.f } }))
  const head = (filas[0] ?? []).map((x) => String(x ?? ''))
  filas.forEach((fila, r) => {
    const etiqueta = String(fila[0] ?? ''), total = /^total/i.test(etiqueta)
    fila.forEach((x, c) => {
      const cel = ws[XLSX.utils.encode_cell({ r, c })] as (XLSX.CellObject & { s?: unknown }) | undefined
      if (!cel) return
      if (r === 0) { cel.s = ESTILO.cab; return }
      const base = total ? ESTILO.total : ESTILO.celda(r % 2 === 0)
      if (typeof x === 'number' || (x && typeof x === 'object')) {
        const porcentaje = /%/.test(head[c] ?? '') || (c > 0 && /TMAR|Impuesto|Inflaci|TIR|reducci/i.test(etiqueta))
        cel.z = porcentaje ? '0.00%' : /^(n|Año)$/i.test(head[c] ?? '') ? '0' : '#,##0.00'
        cel.s = derecha(base)
      } else cel.s = c === 0 ? { ...base, font: { ...base.font, bold: true } } : base
    })
  })
  ws['!cols'] = (anchos ?? head.map((h, c) => Math.min(40, Math.max(11, h.length + 3, ...filas.map((r) => (c === 0 ? String(r[0] ?? '').length + 2 : 0)))))).map((w) => ({ wch: w }))
  ws['!rows'] = [{ hpt: 24 }]
  return ws
}
const f = (s: string) => ({ f: s })
// Celdas de la hoja Parametros
const I = 'Parametros!$B$2', P = 'Parametros!$B$6', S = 'Parametros!$B$7', N = 'Parametros!$B$8', T = 'Parametros!$B$9'
const AP = (i: string, n: string) => `(${i}*(1+${i})^${n}/((1+${i})^${n}-1))`
const AF = (i: string, n: string) => `(${i}/((1+${i})^${n}-1))`

export function exportarAnalisisExcel(p: Params) {
  const wb = XLSX.utils.book_new()
  const add = (nombre: string, filas: Celda[][], anchos?: number[]) => XLSX.utils.book_append_sheet(wb, hoja(filas, anchos), nombre)

  add('Parametros', [
    ['Parámetro', 'Valor'], ['TMAR (i)', p.i], ['Licencia', p.licencia], ['Implementación', p.implementacion], ['Capacitación', p.capacitacion],
    ['Inversión P', f('SUM(B3:B5)')], ['Valor residual S', p.S], ['Vida fiscal n', p.n], ['Impuesto', p.impuesto], ['VM defensor hoy', p.defensor.vm0],
    ['Costo original defensor (hundido)', p.defensor.costoOriginal], ['Inflación', p.inflacion], ['TMAR ajustada', f('B2+B12+B2*B12')],
  ], [34, 14])

  const nc = p.conceptos.length
  add('Comparacion', [
    ['Concepto', F.etq(p).defensor, F.etq(p).retador, 'Ahorro', '% reducción'],
    ...p.conceptos.map((c, k) => [c.nombre, c.actual, c.nuevo, f(`B${k + 2}-C${k + 2}`), f(`IF(B${k + 2}=0,0,D${k + 2}/B${k + 2})`)]),
    ['TOTAL', f(`SUM(B2:B${nc + 1})`), f(`SUM(C2:C${nc + 1})`), f(`SUM(D2:D${nc + 1})`), f(`D${nc + 2}/B${nc + 2}`)],
    [], ['Recuperación simple (años)', f(`${P}/D${nc + 2}`)],
  ], [48, 12, 12, 12, 12])

  const tablaCAUE = (inv: string, vm: number[], coa: number[]) => [
    ['n', 'VM_n', 'COA_n', '(P/F,i,n)', 'COA·(P/F)', 'Σ VP COA', '(A/P,i,n)', '(A/F,i,n)', 'RC', 'COA eq', 'CAUE'],
    ...vm.map((v, k) => { const r = k + 2; return [k + 1, v, coa[k], f(`1/(1+${I})^A${r}`), f(`C${r}*D${r}`), f(`SUM($E$2:E${r})`), f(AP(I, `A${r}`)), f(AF(I, `A${r}`)), f(`${inv}*G${r}-B${r}*H${r}`), f(`F${r}*G${r}`), f(`I${r}+J${r}`)] }),
    [], ['CAUE mínimo', f(`MIN(K2:K${vm.length + 1})`), 'Vida económica', f(`MATCH(B${vm.length + 3},K2:K${vm.length + 1},0)`)],
  ]
  add('VidaUtil_Retador', tablaCAUE(P, p.retador.vm, p.retador.coa))
  const d = p.defensor
  add('Reemplazo_Defensor', tablaCAUE(`Parametros!$B$10`, d.vm.slice(0, d.vidaRestante), d.coa.slice(0, d.vidaRestante)))
  add('CostoMarginal', [
    ['Año', 'VM inicio', 'VM fin', 'Pérdida valor', 'Interés i·VM', 'COA', 'Costo marginal', 'CAUE mín. retador', '¿Conservar?'],
    ...d.vm.slice(0, d.vidaRestante).map((v, k) => { const r = k + 2; return [k + 1, k === 0 ? f('Parametros!B10') : f(`C${r - 1}`), v, f(`B${r}-C${r}`), f(`${I}*B${r}`), d.coa[k], f(`D${r}+E${r}+F${r}`), f(`VidaUtil_Retador!B${p.retador.vm.length + 3}`), f(`IF(G${r}<H${r},"Sí","No")`)] }),
  ])

  const n = p.n
  add('Depreciacion', [
    ['Año', 'LR', 'VL LR', 'SDD', 'VL SDD', 'SDA', 'VL SDA', 'MACRS %', 'MACRS', 'Ahorro fiscal LR', 'Ahorro fiscal SDD', 'Ahorro fiscal SDA'],
    [0, null, f(P), null, f(P), null, f(P), null, null, null, null, null],
    ...Array.from({ length: n }, (_, k) => { const r = k + 3; return [k + 1, f(`(${P}-${S})/${N}`), f(`C${r - 1}-B${r}`), f(`MAX(0,MIN(2/${N}*E${r - 1},E${r - 1}-${S}))`), f(`E${r - 1}-D${r}`), f(`(${N}-A${r}+1)/(${N}*(${N}+1)/2)*(${P}-${S})`), f(`G${r - 1}-F${r}`), F.MACRS[p.macrsClase][k] ?? 0, f(`H${r}*${P}`), f(`B${r}*${T}`), f(`D${r}*${T}`), f(`F${r}*${T}`)] }),
    [], ['VP ahorro fiscal', null, null, null, null, null, null, null, null, f(`NPV(${I},J3:J${n + 2})`), f(`NPV(${I},K3:K${n + 2})`), f(`NPV(${I},L3:L${n + 2})`)],
  ])

  const dep = F.depreciar(p, p.depMetodo)
  add('FEDI', [
    ['Año', 'Ahorro', `Depreciación (${F.NOMBRE_DEP[p.depMetodo]})`, 'Renta gravable', 'Impuesto', 'Residual', 'FEDI'],
    [0, 0, 0, 0, 0, 0, f(`-${P}`)],
    ...Array.from({ length: n }, (_, k) => { const r = k + 3; const last = k === n - 1; return [k + 1, f(`Comparacion!$D$${nc + 2}`), dep[k]?.dep ?? 0, f(`B${r}-C${r}`), last ? f(`D${r}*${T}+(${S}-(${P}-SUM(C3:C${r})))*${T}`) : f(`D${r}*${T}`), last ? f(S) : 0, f(`B${r}-E${r}+F${r}`)] }),
    [], ['VP después de impuestos', f(`G2+NPV(${I},G3:G${n + 2})`)], ['VA después de impuestos', f(`B${n + 4}*${AP(I, N)}`)], ['TIR después de impuestos', f(`IRR(G2:G${n + 2})`)],
  ])

  add('Indicadores', [
    ['Año', 'Flujo'], [0, f(`-${P}`)],
    ...Array.from({ length: n }, (_, k) => [k + 1, f(`Comparacion!$D$${nc + 2}${k === n - 1 ? `+${S}` : ''}`)]),
    [], ['VPN', f(`B2+NPV(${I},B3:B${n + 2})`)], ['VAE', f(`B${n + 4}*${AP(I, N)}`)], ['TIR', f(`IRR(B2:B${n + 2})`)],
    ['B/C', f(`NPV(${I},B3:B${n + 2})/${P}`)], ['Ahorro mínimo', f(`(${P}-${S}/(1+${I})^${N})/((1-(1+${I})^-${N})/${I})`)],
  ])

  const e = F.periodoEstudio(p, p.horizonte)
  add('PeriodoEstudio', [['Opción', 'VP costos', 'VA costos'], ...e.opciones.map((o) => [o.etiqueta, o.vp, o.va]), [], ['Mejor', e.mejor.etiqueta]], [30, 14, 14])
  const t = F.tornado(p)
  add('Sensibilidad', [['Variable', 'VPN −20 %', 'VPN +20 %', 'Rango'], ...t.filas.map((x) => [x.variable, x.bajo, x.alto, x.rango]), [], ['Valor de equilibrio defensor', F.equilibrioDefensor(p)]], [30, 14, 14, 14])
  const R = F.reemplazo(p), K = F.indicadores(p), E = F.etq(p)
  XLSX.utils.book_append_sheet(wb, hojaBonita(`Análisis económico — ${E.evaluacion}`, ['Indicador', 'Valor'], [
    ['Lo que tiene hoy (defensor)', E.defensor], ['La alternativa (retador)', E.retador], ['Veredicto', R.veredicto], ['Inversión', money(F.inversion(p))],
    ['Ahorro anual', money(K.A)], ['VPN', money(K.VPN)], ['TIR', pct(K.TIR)], ['B/C', num(K.BC, 4)], ['Recuperación simple', `${num(K.recSimple)} años`],
    ['TMAR', pct(p.i)], ['CAUE mínimo defensor', money(R.def.caueMin)], ['CAUE mínimo retador', money(R.ret.caueMin)],
  ]), 'Resumen')
  wb.SheetNames = ['Resumen', ...wb.SheetNames.filter((n) => n !== 'Resumen')]
  XLSX.writeFile(wb, `NEXORA_Analisis_${archivoSeguro(E.evaluacion)}.xlsx`)
}

// ───────────── PDF ─────────────
type RGB = [number, number, number]
const ORO: RGB = [212, 175, 55], NEGRO: RGB = [10, 9, 7], MARFIL: RGB = [251, 246, 234], BORDE: RGB = [231, 221, 194], TEXTO: RGB = [40, 37, 33], GRIS: RGB = [120, 113, 108]
type Doc = jsPDF & { lastAutoTable?: { finalY: number } }
/** La letra estándar del PDF no tiene algunos signos (−, →, ≈): se cambian por equivalentes que sí tiene. */
const limpio = (t: string | number) => String(t ?? '').replace(/\u2212/g, '-').replace(/→/g, '->').replace(/≈/g, '~').replace(/≤/g, '<=').replace(/≥/g, '>=')
let tituloDoc = ''

/** Membrete: banda negra con el isotipo N dorado, NEXORA, empresa y fecha; título con subrayado dorado. */
export function pdfBase(titulo: string, op: { horizontal?: boolean; sub?: string } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: op.horizontal ? 'landscape' : 'portrait' }) as Doc
  const w = doc.internal.pageSize.getWidth(), empresa = useApp.getState().empresa.nombre || 'Mi empresa'
  doc.setProperties({ title: titulo, author: empresa, creator: 'NEXORA — Intelligent Operations Suite' })
  doc.setFillColor(...NEGRO); doc.rect(0, 0, w, 84, 'F'); doc.setFillColor(...ORO); doc.rect(0, 84, w, 2.5, 'F')
  doc.setDrawColor(...ORO); doc.setLineWidth(0.8); doc.roundedRect(40, 22, 40, 40, 9, 9, 'S')
  doc.setLineWidth(4.2); doc.setLineCap('round'); doc.setLineJoin('round')
  doc.lines([[0, -20], [10, 12.5]], 50, 52, [1, 1], 'S', false); doc.lines([[10, 12.5], [0, -20]], 60, 39.5, [1, 1], 'S', false)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...ORO); doc.text('NEXORA', 94, 46)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(214, 207, 192); doc.text('INTELLIGENT OPERATIONS SUITE', 94, 60, { charSpace: 1.1 })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255); doc.text(empresa, w - 40, 42, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(214, 207, 192); doc.text(new Date().toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' }), w - 40, 58, { align: 'right' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20, 18, 15); doc.text(limpio(titulo), 40, 124)
  if (op.sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text(limpio(op.sub), 40, 141, { maxWidth: w - 80 }) }
  doc.setFillColor(...ORO); doc.rect(40, op.sub ? 150 : 134, 36, 3, 'F')
  tituloDoc = titulo
  return { doc, y: op.sub ? 168 : 152 }
}

/** Fila de indicadores en recuadros (máximo 4 por fila). */
export function pdfKpis(doc: Doc, y: number, items: [string, string][]) {
  const w = doc.internal.pageSize.getWidth(), n = Math.max(1, Math.min(4, items.length)), gap = 10, ancho = (w - 80 - gap * (n - 1)) / n
  items.slice(0, 4).forEach(([t, v], k) => {
    const x = 40 + k * (ancho + gap)
    doc.setFillColor(...MARFIL); doc.setDrawColor(...BORDE); doc.setLineWidth(0.6); doc.roundedRect(x, y, ancho, 56, 8, 8, 'FD')
    doc.setFillColor(...ORO); doc.rect(x, y + 11, 3, 34, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS); doc.text(t.toUpperCase(), x + 12, y + 21, { charSpace: 0.4 })
    const valor = limpio(v); doc.setFont('helvetica', 'bold'); doc.setFontSize(valor.length > 12 ? 10.5 : 13); doc.setTextColor(20, 18, 15); doc.text(valor, x + 12, y + 41, { maxWidth: ancho - 18 })
  })
  return y + 72
}

/** Tabla con encabezado negro y letras doradas, filas alternas, números a la derecha y totales resaltados. */
export function pdfTabla(doc: Doc, y: number, titulo: string, head: string[], body: (string | number)[][]) {
  const h = doc.internal.pageSize.getHeight()
  if (titulo) {
    if (y > h - 140) { doc.addPage(); y = 60 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(20, 18, 15); doc.text(limpio(titulo), 40, y + 12)
    doc.setFillColor(...ORO); doc.rect(40, y + 17, 22, 2, 'F'); y += 26
  }
  autoTable(doc, {
    startY: y, head: [head.map(limpio)], body: body.map((r) => r.map(limpio)), theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: TEXTO, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 }, lineColor: BORDE, lineWidth: 0.5, valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: NEGRO, textColor: ORO, fontStyle: 'bold', lineColor: NEGRO },
    alternateRowStyles: { fillColor: MARFIL },
    margin: { left: 40, right: 40, top: 56, bottom: 54 },
    didParseCell: (d: CellHookData) => {
      if (d.section !== 'body') return
      const t = String(d.cell.raw ?? '')
      if (aNumero(t) || /^[−-]?\s?\S{0,4}\s?[\d.,]+\s?(años|u|×|%)?(\s\/\s[\d.,]+\s?años)?$/.test(t)) d.cell.styles.halign = 'right'
      if (/^total/i.test(String((d.row.raw as unknown[])?.[0] ?? ''))) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [243, 231, 196] }
    },
  })
  return (doc.lastAutoTable?.finalY ?? y) + 18
}

/** Pie en cada página (empresa, fecha y "Página X de Y"), franja superior desde la segunda página, y guardar. */
function terminar(doc: Doc, archivo: string) {
  const n = doc.getNumberOfPages(), w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight()
  const empresa = useApp.getState().empresa.nombre || 'Mi empresa', fecha = new Date().toLocaleDateString('es-EC', { dateStyle: 'long' })
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    if (i > 1) {
      doc.setFillColor(...NEGRO); doc.rect(0, 0, w, 30, 'F'); doc.setFillColor(...ORO); doc.rect(0, 30, w, 1.5, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...ORO); doc.text('NEXORA', 40, 19)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(214, 207, 192); doc.text(tituloDoc, 92, 19, { maxWidth: w - 140 })
    }
    doc.setDrawColor(...ORO); doc.setLineWidth(0.6); doc.line(40, h - 36, w - 40, h - 36)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS)
    doc.text(`NEXORA · ${empresa}`, 40, h - 22); doc.text(`Generado el ${fecha}`, w / 2, h - 22, { align: 'center' }); doc.text(`Página ${i} de ${n}`, w - 40, h - 22, { align: 'right' })
  }
  doc.save(archivo)
}

export function exportarAnalisisPDF(p: Params) {
  const E = F.etq(p), R = F.reemplazo(p), K = F.indicadores(p)
  const { doc, y: y0 } = pdfBase('Análisis económico', { sub: `${E.evaluacion} · ${E.defensor} (defensor) frente a ${E.retador} (retador) · TMAR ${pct(p.i, 0)}` })
  let y = pdfKpis(doc, y0, [['Veredicto', R.veredicto], ['Ahorro anual', money(K.A, 0)], ['VPN', money(K.VPN, 0)], ['TIR', pct(K.TIR, 1)]])
  y = pdfTabla(doc, y, 'Resumen de indicadores', ['Indicador', 'Valor'], [
    ['Inversión', money(F.inversion(p))], ['CAUE mín. defensor', `${money(R.def.caueMin)} (n = ${R.def.nOpt})`], ['CAUE mín. retador', `${money(R.ret.caueMin)} (n = ${R.ret.nOpt})`],
    ['B/C', num(K.BC, 4)], ['Recuperación simple / descontada', `${num(K.recSimple)} / ${num(K.recDesc)} años`],
  ])
  y = pdfTabla(doc, y, 'Comparación de costos anuales', ['Concepto', E.defensor, E.retador, 'Ahorro'], [...p.conceptos.map((c) => [c.nombre, money(c.actual), money(c.nuevo), money(c.actual - c.nuevo)]), ['TOTAL', money(F.totalActual(p)), money(F.totalNuevo(p)), money(K.A)]])
  y = pdfTabla(doc, y, `Vida útil económica de ${E.retador}`, ['n', 'VM', 'COA', 'RC', 'COA eq', 'CAUE'], R.ret.filas.map((r) => [r.n, money(r.vm), money(r.coa), money(r.rc), money(r.coaEq), money(r.caue)]))
  y = pdfTabla(doc, y, `CAUE de ${E.defensor.toLowerCase()} y costo marginal`, ['n', 'CAUE', 'Costo marginal'], R.def.filas.map((r, k) => [r.n, money(r.caue), money(R.marg[k].cm)]))
  const ms: F.MetodoDep[] = ['LR', 'SD', 'SDD_LR', 'SDA', 'MACRS', 'UP']
  y = pdfTabla(doc, y, 'Depreciación — VP del ahorro fiscal', ['Método', 'Año 1', 'VL final', 'VP ahorro fiscal'], ms.map((m) => { const t = F.depreciar(p, m); return [F.NOMBRE_DEP[m], money(t[0].dep), money(t[t.length - 1].vl), money(F.ahorroFiscal(t, p.impuesto, p.i).vp)] }))
  const fe = F.fedi(p, p.depMetodo)
  pdfTabla(doc, y, `FEDI (${F.NOMBRE_DEP[p.depMetodo]}) — VP ${money(fe.VP)}`, ['Año', 'Ahorro', 'Dep.', 'Impuesto', 'FEDI'], fe.filas.map((r) => [r.anio, money(r.ahorro), money(r.dep), money(r.impuesto), money(r.fedi)]))
  terminar(doc, `NEXORA_Analisis_${archivoSeguro(E.evaluacion)}.pdf`)
}

/** Exportación de una tabla a Excel o PDF (inventario, reportes, resumen…), con el diseño de NEXORA. */
export function exportarTabla(nombre: string, head: string[], body: (string | number)[][], formato: 'xlsx' | 'pdf') {
  if (formato === 'xlsx') {
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, hojaBonita(nombre, head, body), nombre.slice(0, 30)); XLSX.writeFile(wb, `NEXORA_${archivoSeguro(nombre)}.xlsx`)
  } else {
    const { doc, y } = pdfBase(nombre, { horizontal: head.length > 7, sub: `${body.length} ${body.length === 1 ? 'registro' : 'registros'}` })
    pdfTabla(doc, y, '', head, body); terminar(doc, `NEXORA_${archivoSeguro(nombre)}.pdf`)
  }
}

/** Libro de Excel con varias hojas (cada una con su membrete), o CSV de la primera hoja. */
export function exportarLibro(nombre: string, hojas: [string, (string | number)[][]][], formato: 'xlsx' | 'csv' = 'xlsx') {
  const wb = XLSX.utils.book_new()
  for (const [n, filas] of hojas) XLSX.utils.book_append_sheet(wb, formato === 'csv' ? XLSX.utils.aoa_to_sheet(filas) : hojaBonita(n, (filas[0] ?? []).map(String), filas.slice(1)), n.slice(0, 30))
  XLSX.writeFile(wb, `NEXORA_${archivoSeguro(nombre)}.${formato}`, { bookType: formato })
}

/** PDF del reporte ejecutivo inteligente (resumen, indicadores, hallazgos con acciones, red de sucursales y top de ventas). */
export function exportarReporteEjecutivo(a: ReturnType<typeof import('./reporteInteligente').analizarNegocio>) {
  const { doc, y: y0 } = pdfBase('Reporte ejecutivo inteligente', { sub: 'Resumen del negocio, hallazgos y acciones recomendadas' })
  const w = doc.internal.pageSize.getWidth()
  let y = pdfKpis(doc, y0, a.kpis.slice(0, 4).map(([k, v]) => [k, v] as [string, string]))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 37, 33)
  const lineas = doc.splitTextToSize(limpio(a.resumen), w - 80)
  doc.text(lineas, 40, y)
  y += lineas.length * 13 + 6
  y = pdfTabla(doc, y, 'Indicadores clave', ['Indicador', 'Valor'], a.kpis.map(([k, v]) => [k, v]))
  const etiqueta = { critico: 'CRÍTICO', alerta: 'Alerta', oportunidad: 'Oportunidad', ok: 'OK' }
  y = pdfTabla(doc, y, 'Hallazgos y acciones recomendadas', ['Nivel', 'Hallazgo', 'Detalle', 'Acción recomendada'], a.hallazgos.map((h) => [etiqueta[h.nivel], h.titulo, h.detalle, h.accion]))
  y = pdfTabla(doc, y, 'Red de sucursales', ['Código', 'Sucursal', 'País', 'Inventario', 'Ventas 30 d', 'Quiebres'], a.porSucursal.map((r) => [r.s.id, r.s.nombre, r.s.pais, money(r.valor, 0), money(r.ventas30, 0), r.quiebres]))
  if (a.top.length) pdfTabla(doc, y, 'Productos más vendidos (30 días)', ['#', 'Producto', 'Unidades'], a.top.map((t, k) => [k + 1, t.p?.nombre ?? '—', t.u]))
  terminar(doc, `NEXORA_Reporte_ejecutivo_${new Date().toISOString().slice(0, 10)}.pdf`)
}
