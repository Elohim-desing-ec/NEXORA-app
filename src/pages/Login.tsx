import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Lock, User } from 'lucide-react'
import { Horizonte } from '../components/Horizonte'
import { useApp } from '../store/useApp'
import { Fondo } from '../components/Layout'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { useTx } from '../lib/idioma'
import { SelectorIdioma } from '../components/SelectorIdioma'

export default function Login() {
  const { login, usuarios } = useApp()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const tx = useTx()
  const entrar = (e: React.FormEvent) => {
    e.preventDefault()
    const q = email.trim().toLowerCase()
    const u = usuarios.find((x) => x.usuario.toLowerCase() === q || (!!x.email && x.email.toLowerCase() === q))
    if (!u || u.clave !== clave) return setError(tx('Usuario o contraseña incorrectos', 'Wrong username or password', 'Usuário ou senha incorretos'))
    login(u)
  }
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden p-4"><Fondo />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh]"><Horizonte tamano={1700} className="top-[30%]" /></div>
      <a href="#/" className="fixed left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-fg/10 bg-fg/5 px-3 py-1.5 text-xs backdrop-blur hover:bg-fg/10"><ArrowLeft size={14} />{tx('Conocer NEXORA', 'Discover NEXORA', 'Conhecer o NEXORA')}</a>
      <SelectorIdioma className="fixed right-4 top-4 z-10" />
      <motion.form onSubmit={entrar} initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="glass relative z-10 w-full max-w-md p-8">
        <div className="mb-6 flex justify-center"><Logo size={44} /></div>
        <h1 className="text-center font-display text-2xl font-bold tracking-tight">{tx('Bienvenido de', 'Welcome', 'Bem-vindo de')} <span className="texto-oro">{tx('nuevo', 'back', 'volta')}</span></h1>
        <p className="mt-1 text-center text-sm text-muted">{tx('Gestión inteligente de operaciones e inventario', 'Smart operations and inventory management', 'Gestão inteligente de operações e estoque')}</p>
        <div className="mt-6 space-y-3">
          <div className="relative"><User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus aria-label={tx('Usuario', 'Username', 'Usuário')} autoComplete="username" autoCapitalize="none" className="inp pl-9" placeholder={tx('Usuario', 'Username', 'Usuário')} value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></div>
          <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input aria-label={tx('Contraseña', 'Password', 'Senha')} autoComplete="current-password" type="password" className="inp pl-9" placeholder={tx('Contraseña', 'Password', 'Senha')} value={clave} onChange={(e) => { setClave(e.target.value); setError('') }} /></div>
          {error && <p className="text-xs text-peligro">{error}</p>}
          <Button variante="primario" type="submit" className="w-full !py-2.5">{tx('Ingresar', 'Sign in', 'Entrar')} <ArrowRight size={16} /></Button>
        </div>
        <p className="mt-5 text-center text-[11px] text-muted">{tx('¿Olvidó su contraseña? El Gerente General puede cambiarla en Configuración → Usuarios.', 'Forgot your password? The General Manager can change it in Settings → Users.', 'Esqueceu a senha? O Gerente Geral pode alterá-la em Configurações → Usuários.')}</p>
      </motion.form>
    </div>
  )
}
