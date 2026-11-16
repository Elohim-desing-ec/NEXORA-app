import { ROLES, MAX_ROLES, DESCRIPCION_ROL, rolesDe, permisosDe, type Rol } from '../store/useApp'
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
      <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">{ROLES.map((r) => {
        const si = elegidos.includes(r), lleno = !si && elegidos.length >= MAX_ROLES
        return (
          <button key={r} type="button" disabled={lleno} onClick={() => onChange(alternarRol(valor, r))} className={cx('rounded-xl border px-3 py-2 text-left transition disabled:opacity-35', si ? 'border-primario/60 bg-primario/10' : 'border-fg/10 hover:bg-fg/5')}>
            <div className="flex items-center justify-between gap-2 text-sm font-semibold">{r}{si && <span className="rounded-full bg-gradient-to-r from-primario to-violeta px-1.5 text-[9px] font-bold text-black">{valor.rol === r ? 'PRINCIPAL' : 'ADICIONAL'}</span>}</div>
            <div className="text-[11px] text-muted">{DESCRIPCION_ROL[r]}</div>
          </button>)
      })}</div>
      <p className="mt-2 text-xs text-muted">Con {elegidos.length > 1 ? 'estos roles' : 'este rol'} verá: {seccionesQueVe(valor).join(', ')}.</p>
    </div>
  )
}
