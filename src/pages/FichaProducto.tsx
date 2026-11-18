/** Página pública que abre el QR de la etiqueta: muestra la ficha del producto de forma elegante (no hace falta iniciar sesión). */
import { useEffect, useState } from 'react'
import { Ficha, leerFicha } from '../components/Ficha'
import { Fondo } from '../components/Layout'

export default function FichaProducto() {
  const [d, setD] = useState(() => leerFicha(location.hash))
  useEffect(() => { const h = () => setD(leerFicha(location.hash)); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  useEffect(() => { document.title = d ? `${d.n} · NEXORA` : 'NEXORA' }, [d])
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Fondo />
      {d ? <Ficha d={d} />
        : <div className="glass max-w-sm p-6 text-center"><h1 className="font-display text-xl font-bold">Código no reconocido</h1><p className="mt-2 text-sm text-muted">Este código no es una etiqueta de NEXORA o está incompleto.</p></div>}
    </div>
  )
}
