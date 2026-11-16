/** Temas de color de NEXORA: solo cambian los colores (variables CSS en index.css); diseño, letras y animaciones quedan iguales. */
export type TemaColor = 'oro' | 'azul' | 'morado' | 'mate'
export const TEMAS: { id: TemaColor; nombre: string; en: string; pt: string; desc: [string, string, string]; muestra: [string, string, string] }[] = [
  { id: 'oro', nombre: 'Obsidiana y oro', en: 'Obsidian & gold', pt: 'Obsidiana e ouro', desc: ['El clásico de NEXORA: negro profundo con oro.', 'The NEXORA classic: deep black with gold.', 'O clássico do NEXORA: preto profundo com ouro.'], muestra: ['#F3D58A', '#D4AF37', '#B07D26'] },
  { id: 'azul', nombre: 'Zafiro', en: 'Sapphire', pt: 'Safira', desc: ['Azul eléctrico sobre una noche profunda.', 'Electric blue over a deep night.', 'Azul elétrico sobre uma noite profunda.'], muestra: ['#A5C2FF', '#5C8CFF', '#345CD6'] },
  { id: 'morado', nombre: 'Amatista', en: 'Amethyst', pt: 'Ametista', desc: ['Morado de vidrio, suave y elegante.', 'Soft, elegant glassy purple.', 'Roxo de vidro, suave e elegante.'], muestra: ['#CDB6FF', '#A27AFF', '#7046DE'] },
  { id: 'mate', nombre: 'Negro mate', en: 'Matte black', pt: 'Preto fosco', desc: ['Grafito y plata, sobrio y minimalista.', 'Graphite and silver, sober and minimal.', 'Grafite e prata, sóbrio e minimalista.'], muestra: ['#ECECF2', '#D2D2DC', '#828291'] },
]
const CLAVE = 'nexora-tema-color'
/** Último tema usado en este navegador (para la intro, la portada y el login, antes de saber quién entra). */
export const temaGuardado = (): TemaColor => { try { const t = localStorage.getItem(CLAVE); return TEMAS.some((x) => x.id === t) ? (t as TemaColor) : 'oro' } catch { return 'oro' } }
export const recordarTema = (t: TemaColor) => { try { localStorage.setItem(CLAVE, t) } catch { /* sin almacenamiento */ } }
