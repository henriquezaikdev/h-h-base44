import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Truck,
  Boxes,
  Landmark,
  CheckSquare,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type { SellerRole } from '../../types'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/clientes',  label: 'Clientes',   icon: Users           },
  { to: '/pedidos',   label: 'Pedidos',    icon: ShoppingCart    },
  { to: '/produtos',  label: 'Produtos',   icon: Package         },
  { to: '/compras',   label: 'Compras',    icon: Truck           },
  { to: '/estoque',   label: 'Estoque',    icon: Boxes           },
  { to: '/financeiro',label: 'Financeiro', icon: Landmark        },
  { to: '/tarefas',   label: 'Tarefas',    icon: CheckSquare     },
]

const NAV_BY_ROLE: Record<SellerRole, string[]> = {
  owner:     ALL_NAV_ITEMS.map(i => i.to),
  admin:     ALL_NAV_ITEMS.map(i => i.to),
  manager:   ALL_NAV_ITEMS.map(i => i.to),
  seller:    ['/dashboard', '/clientes', '/pedidos', '/tarefas'],
  logistics: ['/dashboard', '/estoque', '/tarefas'],
}

function getNavItems(role: SellerRole | null): NavItem[] {
  if (!role) return []
  const allowed = new Set(NAV_BY_ROLE[role] ?? [])
  return ALL_NAV_ITEMS.filter(item => allowed.has(item.to))
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email ? email.slice(0, 2).toUpperCase() : '?'
}

export default function AppLayout() {
  const { seller, user, role, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = seller?.name ?? user?.email ?? ''
  const department  = seller?.department ?? null
  const initials    = getInitials(seller?.name, user?.email)
  const navItems    = getNavItems(role)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9]">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="flex flex-col w-60 shrink-0 bg-white border-r border-[#E5E7EB]">

        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-[#E5E7EB]">
          <span className="text-[#3B5BDB] font-semibold text-base tracking-tight select-none">
            H&amp;H Control
          </span>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#EEF2FF] text-[#3B5BDB]'
                    : 'text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]',
                ].join(' ')
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé — usuário + logout */}
        <div className="border-t border-[#E5E7EB] p-3">
          <div className="flex items-center gap-3 min-w-0">

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#3B5BDB] flex items-center justify-center text-xs font-semibold shrink-0 select-none">
              {initials}
            </div>

            {/* Nome + departamento */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#111827] truncate leading-tight">
                {displayName}
              </p>
              {department && (
                <p className="text-[11px] text-[#9CA3AF] truncate leading-tight mt-0.5">
                  {department}
                </p>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0"
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>

          </div>
        </div>
      </aside>

      {/* ── Conteúdo principal ──────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  )
}
