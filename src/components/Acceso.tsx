import { useState, type ReactNode } from 'react'
import { entrarCon, mensajeError, type Destino } from '../lib/cuenta'
import { useTx } from '../lib/idioma'

const IconoGoogle = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)
const IconoFacebook = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /><path fill="#fff" d="m16.7 15.5.5-3.5h-3.4V9.8c0-1 .5-1.9 2-1.9h1.5v-3s-1.4-.2-2.7-.2c-2.7 0-4.5 1.6-4.5 4.7V12h-3v3.5h3v8.4a12 12 0 0 0 3.7 0v-8.4h2.9z" /></svg>
)

function BotonSocial({ icono, texto, onClick, ocupado }: { icono: ReactNode; texto: string; onClick: () => void; ocupado: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado} className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-fg/15 bg-fg/5 px-4 py-2.5 text-sm font-medium transition hover:bg-fg/10 disabled:opacity-50">
      {icono}{texto}
    </button>
  )
}

/** "Continuar con Google / Facebook" + separador "o con su correo". */
export function AccesoSocial({ destino, onError }: { destino: Destino; onError: (m: string) => void }) {
  const tx = useTx()
  const [ocupado, setOcupado] = useState(false)
  const ir = async (p: 'google' | 'facebook') => {
    setOcupado(true)
    const { error } = await entrarCon(p, destino)
    if (error) { setOcupado(false); onError(mensajeError(error, tx)) }
  }
  return (
    <>
      <div className="space-y-2.5">
        <BotonSocial icono={<IconoGoogle />} texto={tx('Continuar con Google', 'Continue with Google', 'Continuar com Google')} onClick={() => ir('google')} ocupado={ocupado} />
        <BotonSocial icono={<IconoFacebook />} texto={tx('Continuar con Facebook', 'Continue with Facebook', 'Continuar com Facebook')} onClick={() => ir('facebook')} ocupado={ocupado} />
      </div>
      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted"><span className="h-px flex-1 bg-fg/10" />{tx('o con su correo', 'or with your email', 'ou com seu e-mail')}<span className="h-px flex-1 bg-fg/10" /></div>
    </>
  )
}
