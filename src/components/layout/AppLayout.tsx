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
  Sparkles,
  Newspaper,
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
  { to: '/meu-dia',   label: 'Meu Dia',    icon: Sparkles        },
  { to: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/clientes',  label: 'Clientes',   icon: Users           },
  { to: '/pedidos',   label: 'Pedidos',    icon: ShoppingCart    },
  { to: '/produtos',  label: 'Produtos',   icon: Package         },
  { to: '/compras',   label: 'Compras',    icon: Truck           },
  { to: '/estoque',   label: 'Estoque',    icon: Boxes           },
  { to: '/financeiro',label: 'Financeiro', icon: Landmark        },
  { to: '/tarefas',   label: 'Tarefas',    icon: CheckSquare     },
  { to: '/mural',     label: 'Mural',      icon: Newspaper       },
]

const NAV_BY_ROLE: Record<SellerRole, string[]> = {
  owner:     ALL_NAV_ITEMS.map(i => i.to),
  admin:     ALL_NAV_ITEMS.map(i => i.to),
  manager:   ALL_NAV_ITEMS.map(i => i.to),
  seller:    ['/meu-dia', '/clientes', '/pedidos', '/tarefas', '/mural'],
  logistics: ['/meu-dia', '/estoque', '/tarefas', '/mural'],
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
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="flex flex-col w-60 shrink-0 bg-sidebar border-r border-sidebar-border">

        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-sidebar-border">
          <span className="text-sidebar-primary font-semibold text-base tracking-tight select-none">
            H&amp;H Control
          </span>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'sidebar-item',
                  isActive ? 'active' : '',
                ].join(' ').trim()
              }
            >
              <Icon size={16} strokeWidth={1.75} className="sidebar-item-icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Rodapé — usuário + logout */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 min-w-0">

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-sidebar-accent text-sidebar-primary flex items-center justify-center text-xs font-semibold shrink-0 select-none">
              {initials}
            </div>

            {/* Nome + departamento */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                {displayName}
              </p>
              {department && (
                <p className="text-[11px] text-sidebar-muted-foreground truncate leading-tight mt-0.5">
                  {department}
                </p>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 rounded-md text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
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
