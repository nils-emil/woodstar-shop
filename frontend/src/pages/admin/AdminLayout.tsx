import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Cpu, LayoutDashboard, LogOut, MapPin, Menu, Package, ShoppingBag, Store, Warehouse, X } from 'lucide-react'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Logo } from '@/components/Logo'
import { useT } from '@/i18n'
import { useAuth } from './auth'

export function AdminLayout() {
  const { t } = useT()
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const nav = [
    { to: '/admin', label: t('dashboard'), icon: <LayoutDashboard size={18} />, end: true },
    { to: '/admin/lockers', label: t('lockers'), icon: <Warehouse size={18} /> },
    { to: '/admin/orders', label: t('orders'), icon: <ShoppingBag size={18} /> },
    { to: '/admin/products', label: t('products'), icon: <Package size={18} /> },
    { to: '/admin/sites', label: t('sites'), icon: <MapPin size={18} /> },
    { to: '/admin/devices', label: t('devices'), icon: <Cpu size={18} /> },
  ]

  const onLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 h-11 font-semibold text-sm transition-colors ${
              isActive ? 'bg-accent-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          {n.icon}
          {n.label}
        </NavLink>
      ))}
      <a href="/" className="flex items-center gap-3 rounded-xl px-3 h-11 font-semibold text-sm text-white/70 hover:bg-white/10 hover:text-white">
        <Store size={18} />
        {t('storefront')}
      </a>
    </nav>
  )

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      {/* sidebar (desktop) */}
      <aside className="hidden md:flex flex-col gap-6 bg-night-900 text-white p-4 sticky top-0 h-dvh">
        <div className="flex items-center gap-2.5 px-1">
          <Logo size={32} />
          <span className="text-lg font-bold tracking-tight">{t('appName')}</span>
          <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase mt-0.5">{t('admin')}</span>
        </div>
        {links}
        <div className="mt-auto space-y-3">
          <LanguageToggle variant="dark" />
          <div className="flex items-center justify-between text-sm text-white/60 px-1">
            <span className="truncate">{username}</span>
            <button onClick={() => void onLogout()} className="flex items-center gap-1 text-white font-semibold hover:text-accent-300">
              <LogOut size={16} /> {t('logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* top bar (mobile) */}
      <div className="md:hidden sticky top-0 z-30 bg-night-900 text-white h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-lg font-bold">{t('appName')}</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-20 top-14 bg-night-900 text-white p-4 space-y-4">
          {links}
          <LanguageToggle variant="dark" />
          <button onClick={() => void onLogout()} className="flex items-center gap-2 text-white font-semibold">
            <LogOut size={16} /> {t('logout')}
          </button>
        </div>
      )}

      <main className="p-4 md:p-8 max-w-6xl w-full">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
