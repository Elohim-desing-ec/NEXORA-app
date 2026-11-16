import { PROYECTO } from '../data/proyecto'
import * as F from './finance'
import { money, num } from './format'
import { useTx } from './idioma'

export interface Plan { tipo: string; nombre: string; titulo?: string; precio: string; unidad: string; nota: string; boton: string; incluye: string[]; destacado?: boolean }

/** Planes de NEXORA: sus precios salen de los valores del proyecto (portada y página de compra). */
export function usePlanes(): { empresas: Plan[]; emprendimientos: Plan[]; prueba: Plan } {
  const p = PROYECTO
  const tx = useTx()
  const K = F.indicadores(p)
  // Planes: licencia = caso analizado; SaaS = inversión + soporte repartidos en cuotas (A/P a n años con la TMAR).
  const soporte = p.conceptos.find((c) => /soporte/i.test(c.nombre))?.nuevo ?? 0
  const cuotaMes = (F.inversion(p) * F.AP(p.i, p.n) + soporte) / 12
  // Emprendimientos: precio de mercado para una tienda pequeña (los sistemas de inventario para negocios
  // pequeños cuestan unos $20–$100 al mes). Los planes de empresa siguen el análisis económico.
  const EMPRENDE = { mensual: 29, plus: 59, propio: 590 }
  const emprendimientos = [
    { tipo: tx('Mensual', 'Monthly', 'Mensal'), nombre: 'Emprende', precio: money(EMPRENDE.mensual, 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx('Para empezar sin contratos: usted mismo lo configura y cancela cuando quiera.', 'Start with no contract: set it up yourself and cancel anytime.', 'Comece sem contrato: você mesmo configura e cancela quando quiser.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('1 sucursal', '1 branch', '1 filial'), tx('Inventario, ventas y compras', 'Inventory, sales and purchasing', 'Estoque, vendas e compras'), tx('Datos en la nube', 'Cloud data', 'Dados na nuvem'), tx('Ayuda del asistente con IA', 'Help from the AI assistant', 'Ajuda do assistente com IA')] },
    { tipo: tx('Mensual', 'Monthly', 'Mensal'), nombre: 'Emprende Plus', precio: money(EMPRENDE.plus, 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx('Para un negocio que crece: más sucursales y su equipo trabajando a la vez.', 'For a growing business: more branches and your team working together.', 'Para um negócio que cresce: mais filiais e sua equipe trabalhando junta.'), boton: tx('Empezar', 'Get started', 'Começar'), destacado: true,
      incluye: [tx('Hasta 3 sucursales', 'Up to 3 branches', 'Até 3 filiais'), tx('Invite a su equipo con roles', 'Invite your team with roles', 'Convide sua equipe com funções'), tx('Reportes en Excel y PDF', 'Excel and PDF reports', 'Relatórios em Excel e PDF'), tx('Capacitación en línea', 'Online training', 'Treinamento online')] },
    { tipo: tx('Pago único', 'One-time payment', 'Pagamento único'), nombre: 'Emprende Propio', precio: money(EMPRENDE.propio, 0), unidad: tx('pago único', 'one-time', 'pagamento único'), nota: tx('Pague una vez: el software queda para usted, con 1 año de actualizaciones.', 'Pay once: the software is yours, with 1 year of updates.', 'Pague uma vez: o software é seu, com 1 ano de atualizações.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('1 sucursal', '1 branch', '1 filial'), tx('El software es suyo', 'The software is yours', 'O software é seu'), tx('Sin pagos mensuales', 'No monthly payments', 'Sem mensalidades'), tx('1 año de actualizaciones', '1 year of updates', '1 ano de atualizações')] },
  ]
  const empresas = [
    { tipo: tx('Suscripción', 'Subscription', 'Assinatura'), nombre: 'NEXORA Nube', precio: money(cuotaMes, 0), unidad: tx('/ mes', '/ month', '/ mês'), nota: tx(`Sin inversión inicial: la inversión y el soporte en cuotas a ${p.n} años (TMAR ${num(p.i * 100, 0)} %).`, `No upfront investment: investment and support in installments over ${p.n} years (MARR ${num(p.i * 100, 0)} %).`, `Sem investimento inicial: investimento e suporte em parcelas por ${p.n} anos (TMA ${num(p.i * 100, 0)} %).`), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('Implementación y capacitación incluidas', 'Implementation and training included', 'Implantação e treinamento incluídos'), tx('Soporte y actualizaciones', 'Support and updates', 'Suporte e atualizações'), tx('Se paga como gasto operativo', 'Paid as an operating expense', 'Pago como despesa operacional'), tx('Cancele cuando quiera', 'Cancel anytime', 'Cancele quando quiser')] },
    { tipo: tx('Licencia perpetua', 'Perpetual license', 'Licença perpétua'), nombre: 'NEXORA Pro', precio: money(F.inversion(p), 0), unidad: tx('pago único', 'one-time', 'pagamento único'), nota: tx(`Licencia ${money(p.licencia, 0)} + implementación ${money(p.implementacion, 0)} + capacitación ${money(p.capacitacion, 0)}. Soporte ${money(soporte, 0)} / año.`, `License ${money(p.licencia, 0)} + implementation ${money(p.implementacion, 0)} + training ${money(p.capacitacion, 0)}. Support ${money(soporte, 0)} / year.`, `Licença ${money(p.licencia, 0)} + implantação ${money(p.implementacion, 0)} + treinamento ${money(p.capacitacion, 0)}. Suporte ${money(soporte, 0)} / ano.`), boton: tx('Empezar', 'Get started', 'Começar'), destacado: true,
      incluye: [tx('El software es de su empresa', 'The software belongs to your company', 'O software é da sua empresa'), tx('Es el caso del análisis económico', 'It is the economic analysis case', 'É o caso da análise econômica'), tx(`Se recupera en ${num(K.recSimple)} años`, `Pays back in ${num(K.recSimple)} years`, `Retorna em ${num(K.recSimple)} anos`), tx(`Ahorro de ${money(K.A, 0)} por año`, `Saves ${money(K.A, 0)} per year`, `Economia de ${money(K.A, 0)} por ano`)] },
    { tipo: tx('A medida', 'Custom', 'Sob medida'), nombre: 'NEXORA Global', precio: tx('Cotización', 'Quote', 'Cotação'), unidad: '', nota: tx('Para redes con muchas sucursales y países (fase 2 del proyecto).', 'For networks with many branches and countries (project phase 2).', 'Para redes com muitas filiais e países (fase 2 do projeto).'), boton: tx('Conversemos', 'Let\'s talk', 'Vamos conversar'),
      incluye: [tx('Sucursales y países ilimitados', 'Unlimited branches and countries', 'Filiais e países ilimitados'), tx('Base de datos en la nube en tiempo real', 'Real-time cloud database', 'Banco de dados na nuvem em tempo real'), tx('Facturación electrónica por país', 'E-invoicing for each country', 'Faturamento eletrônico por país'), tx('Integración con ERP y tiendas en línea', 'ERP and online store integration', 'Integração com ERP e lojas online')] },
  ]
  const prueba: Plan = { tipo: tx('Sin tarjeta', 'No card needed', 'Sem cartão'), nombre: 'Prueba', titulo: tx('Prueba gratis', 'Free trial', 'Teste grátis'), precio: money(0, 0), unidad: tx('por 14 días', 'for 14 days', 'por 14 dias'),
    nota: tx('Todas las funciones de NEXORA durante 14 días. Al terminar elige un plan y sus datos se conservan.', 'Every NEXORA feature for 14 days. Then choose a plan and keep your data.', 'Todas as funções do NEXORA por 14 dias. Depois escolha um plano e mantenha seus dados.'), boton: tx('Probar gratis', 'Try free', 'Testar grátis'),
    incluye: [tx('Inventario, ventas, compras y reportes', 'Inventory, sales, purchasing and reports', 'Estoque, vendas, compras e relatórios'), tx('Datos en la nube', 'Cloud data', 'Dados na nuvem'), tx('Invite a su equipo', 'Invite your team', 'Convide sua equipe'), tx('Sin tarjeta y sin compromiso', 'No card, no commitment', 'Sem cartão e sem compromisso')] }
  return { empresas, emprendimientos, prueba }
}
