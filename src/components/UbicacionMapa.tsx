import { lazy, Suspense, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import type { Vuelo } from './Globo'
import { buscarDireccion, type Lugar } from '../lib/geo'

const Globo = lazy(() => import('./Globo'))

export interface Ubicacion { lat?: number; lng?: number; ciudad?: string; pais?: string; direccion?: string }

/** Buscar una dirección o tocar el mapa para ubicar algo (un proveedor, un cliente…). La ubicación es opcional. */
export function UbicacionMapa({ valor, nombre, inicio, onChange }: { valor: Ubicacion; nombre: string; inicio: { lat: number; lng: number }; onChange: (u: Ubicacion) => void }) {
  const [q, setQ] = useState(''), [res, setRes] = useState<Lugar[]>([]), [cargando, setCargando] = useState(false), [msg, setMsg] = useState('')
  const hay = Number.isFinite(valor.lat) && Number.isFinite(valor.lng)
  const [vuelo, setVuelo] = useState<Vuelo | null>(() => (hay ? { lat: valor.lat!, lng: valor.lng!, zoom: 13, t: Date.now() } : { ...inicio, zoom: 5, t: Date.now() }))
  const buscar = async () => {
    if (!q.trim()) return
    setCargando(true); setMsg('')
    try { const r = await buscarDireccion(q); setRes(r); if (!r.length) setMsg('Sin resultados. Pruebe con barrio y ciudad, ej.: "La Florida, Guayaquil".') }
    catch { setMsg('No se pudo consultar el mapa (¿sin internet?). Puede tocar el mapa para ubicarlo.') }
    setCargando(false)
  }
  const elegir = (l: Lugar) => {
    onChange({ ...valor, lat: +l.lat.toFixed(6), lng: +l.lng.toFixed(6), ciudad: valor.ciudad || l.ciudad, pais: l.pais || valor.pais, direccion: valor.direccion || l.nombre.split(',').slice(0, 2).join(',') })
    setVuelo({ lng: l.lng, lat: l.lat, zoom: 15, t: Date.now() }); setRes([])
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="inp" placeholder="Buscar dirección, barrio o ciudad…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }} />
        <button type="button" onClick={buscar} className="grid w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-primario to-violeta text-black" aria-label="Buscar dirección">{cargando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}</button>
      </div>
      {res.length > 0 && <ul className="max-h-36 space-y-1 overflow-y-auto">{res.map((l, k) => <li key={k}><button type="button" onClick={() => elegir(l)} className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-primario/15">{l.nombre}</button></li>)}</ul>}
      {msg && <p className="text-xs text-alerta">{msg}</p>}
      <Suspense fallback={<div className="espacio h-56 rounded-xl" />}>
        <Globo className="h-56" autoRotar={false} volarA={vuelo} seleccion="aqui"
          puntos={hay ? [{ id: 'aqui', nombre: nombre || 'Proveedor', lat: valor.lat!, lng: valor.lng!, valor: 1, detalle: valor.direccion || valor.ciudad || '' }] : []}
          onClickMapa={(lng, lat) => onChange({ ...valor, lat: +lat.toFixed(6), lng: +lng.toFixed(6) })} />
      </Suspense>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1"><MapPin size={12} className="text-cian" />{hay ? `${valor.lat!.toFixed(4)}, ${valor.lng!.toFixed(4)}` : 'Toque el mapa o busque la dirección (opcional)'}</span>
        {hay && <button type="button" onClick={() => onChange({ ...valor, lat: undefined, lng: undefined })} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-fg/10"><X size={12} />Quitar ubicación</button>}
      </div>
    </div>
  )
}
