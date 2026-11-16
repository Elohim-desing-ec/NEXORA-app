import { money } from './format'
import { useTx } from './idioma'

export type Periodo = 'mensual' | 'anual'
/** Límites de cada plan (null = sin límite). Personas incluye al titular. */
export interface Limites { sucursales: number | null; personas: number | null }

export interface Plan {
  nombre: string; titulo?: string; tipo: string; nota: string; boton: string; incluye: string[]; destacado?: boolean
  /** Precio en dólares, IVA incluido (los mismos que cobra la función `payphone`). */
  mensual: number; anual: number
  limites: Limites
}

/** Precios y límites (deben coincidir con PRECIOS de supabase/functions/payphone). Anual = 10 meses: 2 gratis. */
export const PRECIOS: Record<string, { mensual: number; anual: number }> = {
  'Emprende': { mensual: 29, anual: 290 },
  'Emprende Plus': { mensual: 59, anual: 590 },
  'Crece': { mensual: 99, anual: 990 },
}
export const LIMITES: Record<string, Limites> = {
  'Emprende': { sucursales: 1, personas: 3 },
  'Emprende Plus': { sucursales: 3, personas: 10 },
  'Crece': { sucursales: 10, personas: null },
}
/** Límites del plan vigente (la prueba y los planes anteriores no tienen límite). */
export const limitesDe = (plan: string | null | undefined): Limites => LIMITES[plan ?? ''] ?? { sucursales: null, personas: null }

/** Precio y unidad por separado: ["$ 29", "/ mes"] o ["$ 290", "/ año"]. */
export const precioPartes = (p: { mensual: number; anual: number }, periodo: Periodo, tx: (es: string, en: string, pt: string) => string): [string, string] =>
  [money(periodo === 'anual' ? p.anual : p.mensual, 0), periodo === 'anual' ? tx('/ año', '/ year', '/ ano') : tx('/ mes', '/ month', '/ mês')]

/** Planes de NEXORA para emprendimientos y negocios que están creciendo. */
export function usePlanes(): { planes: Plan[]; prueba: Plan } {
  const tx = useTx()
  const planes: Plan[] = [
    { nombre: 'Emprende', ...PRECIOS['Emprende'], limites: LIMITES['Emprende'], tipo: tx('Para empezar', 'To get started', 'Para começar'),
      nota: tx('Su tienda o emprendimiento ordenado desde el primer día.', 'Your store or small business organized from day one.', 'Sua loja ou negócio organizado desde o primeiro dia.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('1 sucursal', '1 branch', '1 filial'), tx('Usted + 2 personas', 'You + 2 people', 'Você + 2 pessoas'), tx('Inventario, ventas y compras', 'Inventory, sales and purchasing', 'Estoque, vendas e compras'), tx('Datos en la nube', 'Cloud data', 'Dados na nuvem'), tx('Asistente con IA', 'AI assistant', 'Assistente com IA')] },
    { nombre: 'Emprende Plus', ...PRECIOS['Emprende Plus'], limites: LIMITES['Emprende Plus'], tipo: tx('El más elegido', 'Most popular', 'O mais escolhido'), destacado: true,
      nota: tx('Para el negocio que ya tiene equipo y más de un local.', 'For a business with a team and more than one location.', 'Para o negócio com equipe e mais de um local.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('Hasta 3 sucursales', 'Up to 3 branches', 'Até 3 filiais'), tx('Hasta 10 personas con roles', 'Up to 10 people with roles', 'Até 10 pessoas com funções'), tx('Reportes en Excel y PDF', 'Excel and PDF reports', 'Relatórios em Excel e PDF'), tx('Compras sugeridas con IA', 'AI-suggested purchases', 'Compras sugeridas com IA'), tx('Todo lo de Emprende', 'Everything in Emprende', 'Tudo do Emprende')] },
    { nombre: 'Crece', ...PRECIOS['Crece'], limites: LIMITES['Crece'], tipo: tx('Negocio en crecimiento', 'Growing business', 'Negócio em crescimento'),
      nota: tx('Para la empresa que está creciendo: más locales, ciudades o países.', 'For a growing company: more locations, cities or countries.', 'Para a empresa que cresce: mais locais, cidades ou países.'), boton: tx('Empezar', 'Get started', 'Começar'),
      incluye: [tx('Hasta 10 sucursales', 'Up to 10 branches', 'Até 10 filiais'), tx('Personas ilimitadas', 'Unlimited people', 'Pessoas ilimitadas'), tx('Red global en 3D y varias monedas', '3D global network and multiple currencies', 'Rede global 3D e várias moedas'), tx('Análisis económico y auditoría', 'Economic analysis and audit', 'Análise econômica e auditoria'), tx('Todo lo de Emprende Plus', 'Everything in Emprende Plus', 'Tudo do Emprende Plus')] },
  ]
  const prueba: Plan = { nombre: 'Prueba', titulo: tx('Prueba gratis', 'Free trial', 'Teste grátis'), mensual: 0, anual: 0, limites: { sucursales: null, personas: null }, tipo: tx('Sin tarjeta', 'No card needed', 'Sem cartão'),
    nota: tx('Todas las funciones de NEXORA durante 14 días. Al terminar elige un plan y sus datos se conservan.', 'Every NEXORA feature for 14 days. Then choose a plan and keep your data.', 'Todas as funções do NEXORA por 14 dias. Depois escolha um plano e mantenha seus dados.'), boton: tx('Probar gratis', 'Try free', 'Testar grátis'),
    incluye: [tx('Inventario, ventas, compras y reportes', 'Inventory, sales, purchasing and reports', 'Estoque, vendas, compras e relatórios'), tx('Datos en la nube', 'Cloud data', 'Dados na nuvem'), tx('Invite a su equipo', 'Invite your team', 'Convide sua equipe'), tx('Sin tarjeta y sin compromiso', 'No card, no commitment', 'Sem cartão e sem compromisso')] }
  return { planes, prueba }
}
