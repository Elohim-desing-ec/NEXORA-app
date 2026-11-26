import { ROLES_AREA, ROLES_CARGO, MAX_ROLES, DESCRIPCION_ROL, rolesDe, permisosDe, type Rol } from '../store/useApp'
import { MENU } from './Layout'
import { cx } from './ui'

type ConRoles = { rol: Rol; roles?: Rol[] }

/** Secciones de NEXORA que ve una persona con esos roles. */
export const seccionesQueVe = (u: ConRoles) => MENU.filter((m) => permisosDe(u).includes(m.id)).map((m) => m.label)

/** Marca o desmarca un rol: el primero elegido es el principal; máximo 3. */
export function alternarRol<T extends ConRoles>(u: T, r: Rol): T {
  const rs = rolesDe(u)
  const nuevos = rs.includes(r) ? rs.filter((x) => x !== r) : rs.length >= MAX_ROLES ? rs : [...rs, r]
  return nuevos.length ? { ...u, rol: nuevos[0], roles: nuevos.slice(1) } : u
}

/** Lista de roles para elegir (hasta 3) y lo que podrá ver la persona. */
export function SelectorRoles<T extends ConRoles>({ valor, onChange }: { valor: T; onChange: (v: T) => void }) {
  const elegidos = rolesDe(valor)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between"><span className="text-xs font-medium text-muted">Roles (hasta {MAX_ROLES}, según lo que hace la persona)</span><span className="text-[11px] text-muted">{elegidos.length}/{MAX_ROLES}</span></div>
      <div className="max-h-80 space-y-3 overflow-y-auto overscroll-contain pr-1">{([['Por área', 'Lo más simple para emprendimientos: una persona por tarea', ROLES_AREA], ['Cargos de empresa', 'Para empresas con departamentos', ROLES_CARGO]] as const).map(([g, ayuda, rs]) => (
        <div key={g}>
          <div className="sticky top-0 z-10 mb-1.5 flex items-baseline justify-between gap-2 py-1 backdrop-blur" style={{ background: 'color-mix(in srgb, var(--bg2) 85%, transparent)' }}><span className="text-[11px] font-semibold uppercase tracking-[.18em] text-primario">{g}</span><span className="truncate text-[10px] text-muted">{ayuda}</span></div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{rs.map((r) => {
            const si = elegidos.includes(r), lleno = !si && elegidos.length >= MAX_ROLES
            return (
              <button key={r} type="button" disabled={lleno} onClick={() => onChange(alternarRol(valor, r))} className={cx('rounded-xl border px-3 py-2 text-left transition disabled:opacity-35', si ? 'border-primario/60 bg-primario/10' : 'border-fg/10 hover:bg-fg/5')}>
                <div className="flex items-center justify-between gap-2 text-sm font-semibold">{r}{si && <span className="rounded-full bg-gradient-to-r from-primario to-violeta px-1.5 text-[9px] font-bold text-black">{valor.rol === r ? 'PRINCIPAL' : 'ADICIONAL'}</span>}</div>
                <div className="text-[11px] text-muted">{DESCRIPCION_ROL[r]}</div>
              </button>)
          })}</div>
        </div>))}</div>
      <p className="mt-2 text-xs text-muted">Con {elegidos.length > 1 ? 'estos roles' : 'este rol'} verá: {seccionesQueVe(valor).join(', ')}.</p>
    </div>
  )
}
