import { PROYECTO } from '../data/proyecto'
import * as F from './finance'
import { money, num } from './format'
import { useTx } from './idioma'

export interface Plan { tipo: string; nombre: string; precio: string; unidad: string; nota: string; boton: string; incluye: string[]; destacado?: boolean }

/** Planes de NEXORA: sus precios salen de los valores del proyecto (portada y página de compra). */
export function usePlanes(): { empresas: Plan[]; emprendimientos: Plan[] } {
  const p = PROYECTO
  const tx = useTx()
  const K = F.indicadores(p)
  // Planes: licencia = caso analizado; SaaS = inversión + soporte repartidos en cuotas (A/P a n años con la TMAR).
  const soporte = p.conceptos.find((c) => /soporte/i.test(c.nombre))?.nuevo ?? 0
  const cuotaMes = (F.inversion(p) * F.AP(p.i, p.n) + soporte) / 12
  // Emprendimientos: autoservicio, sin implementación; cuotas = A/P a n años con la TMAR.
  const cuota = (monto: number) => (monto * F.AP(p.i, p.n)) / 12
  const emprendimientos = [
    { tipo: tx('Mensual', 'Monthly', 'Mensal'), nombre: 'Emprende', precio: money(cuota(p.licencia), 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx(`Solo la licencia en cuotas a ${p.n} años. Usted mismo lo configura.`, `License only, in installments over ${p.n} years. You set it up yourself.`, `Só a licença, em parcelas por ${p.n} anos. Você mesmo configura.`), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('1 sucursal', '1 branch', '1 filial'), tx('Inventario, ventas y compras', 'Inventory, sales and purchasing', 'Estoque, vendas e compras'), tx('Carga con plantilla de Excel', 'Upload with an Excel template', 'Carga com modelo do Excel'), tx('Ayuda del asistente con IA', 'Help from the AI assistant', 'Ajuda do assistente com IA')] },
    { tipo: tx('Mensual', 'Monthly', 'Mensal'), nombre: 'Emprende Plus', precio: money(cuota(p.licencia + p.capacitacion), 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx(`Licencia + capacitación (${money(p.capacitacion, 0)}) en cuotas a ${p.n} años.`, `License + training (${money(p.capacitacion, 0)}) in installments over ${p.n} years.`, `Licença + treinamento (${money(p.capacitacion, 0)}) em parcelas por ${p.n} anos.`), boton: tx('Empezar', 'Get started', 'Começar'), destacado: true,
      incluye: [tx('Hasta 2 sucursales', 'Up to 2 branches', 'Até 2 filiais'), tx('Capacitación para su equipo', 'Training for your team', 'Treinamento para sua equipe'), tx('Roles para sus empleados', 'Roles for your employees', 'Funções para seus funcionários'), tx('Reportes en Excel y PDF', 'Excel and PDF reports', 'Relatórios em Excel e PDF')] },
    { tipo: tx('Pago único', 'One-time payment', 'Pagamento único'), nombre: 'Emprende Propio', precio: money(p.licencia, 0), unidad: tx('pago único', 'one-time', 'pagamento único'), nota: tx('Solo la licencia: el software queda para usted, sin cuotas.', 'License only: the software is yours, no installments.', 'Só a licença: o software é seu, sem parcelas.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('1 sucursal', '1 branch', '1 filial'), tx('El software es suyo', 'The software is yours', 'O software é seu'), tx('Sin pagos mensuales', 'No monthly payments', 'Sem mensalidades'), tx('Ayuda del asistente con IA', 'Help from the AI assistant', 'Ajuda do assistente com IA')] },
  ]
  const empresas = [
    { tipo: tx('Suscripción', 'Subscription', 'Assinatura'), nombre: 'NEXORA Nube', precio: money(cuotaMes, 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx(`Sin inversión inicial: la inversión y el soporte en cuotas a ${p.n} años (TMAR ${num(p.i * 100, 0)} %).`, `No upfront investment: investment and support in installments over ${p.n} years (MARR ${num(p.i * 100, 0)} %).`, `Sem investimento inicial: investimento e suporte em parcelas por ${p.n} anos (TMA ${num(p.i * 100, 0)} %).`), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('Implementación y capacitación incluidas', 'Implementation and training included', 'Implantação e treinamento incluídos'), tx('Soporte y actualizaciones', 'Support and updates', 'Suporte e atualizações'), tx('Se paga como gasto operativo', 'Paid as an operating expense', 'Pago como despesa operacional'), tx('Cancele cuando quiera', 'Cancel anytime', 'Cancele quando quiser')] },
    { tipo: tx('Licencia perpetua', 'Perpetual license', 'Licença perpétua'), nombre: 'NEXORA Pro', precio: money(F.inversion(p), 0), unidad: tx('pago único', 'one-time', 'pagamento único'), nota: tx(`Licencia ${money(p.licencia, 0)} + implementación ${money(p.implementacion, 0)} + capacitación ${money(p.capacitacion, 0)}. Soporte ${money(soporte, 0)} / año.`, `License ${money(p.licencia, 0)} + implementation ${money(p.implementacion, 0)} + training ${money(p.capacitacion, 0)}. Support ${money(soporte, 0)} / year.`, `Licença ${money(p.licencia, 0)} + implantação ${money(p.implementacion, 0)} + treinamento ${money(p.capacitacion, 0)}. Suporte ${money(soporte, 0)} / ano.`), boton: tx('Empezar', 'Get started', 'Começar'), destacado: true,
      incluye: [tx('El software es de su empresa', 'The software belongs to your company', 'O software é da sua empresa'), tx('Es el caso del análisis económico', 'It is the economic analysis case', 'É o caso da análise econômica'), tx(`Se recupera en ${num(K.recSimple)} años`, `Pays back in ${num(K.recSimple)} years`, `Retorna em ${num(K.recSimple)} anos`), tx(`Ahorro de ${money(K.A, 0)} por año`, `Saves ${money(K.A, 0)} per year`, `Economia de ${money(K.A, 0)} por ano`)] },
    { tipo: tx('A medida', 'Custom', 'Sob medida'), nombre: 'NEXORA Global', precio: tx('Cotización', 'Quote', 'Cotação'), unidad: '', nota: tx('Para redes con muchas sucursales y países (fase 2 del proyecto).', 'For networks with many branches and countries (project phase 2).', 'Para redes com muitas filiais e países (fase 2 do projeto).'), boton: tx('Conversemos', 'Let\'s talk', 'Vamos conversar'),
      incluye: [tx('Sucursales y países ilimitados', 'Unlimited branches and countries', 'Filiais e países ilimitados'), tx('Base de datos en la nube en tiempo real', 'Real-time cloud database', 'Banco de dados na nuvem em tempo real'), tx('Facturación electrónica por país', 'E-invoicing for each country', 'Faturamento eletrônico por país'), tx('Integración con ERP y tiendas en línea', 'ERP and online store integration', 'Integração com ERP e lojas online')] },
  ]
  return { empresas, emprendimientos }
}
