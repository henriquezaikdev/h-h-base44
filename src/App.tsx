import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { AuthProvider, useAuthContext } from './components/AuthProvider'
import PrivateRoute from './components/layout/PrivateRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ClientesPage from './pages/crm/ClientesPage'
import ClientePage from './pages/crm/ClientePage'
import ProdutosPage from './pages/products/ProdutosPage'
import PedidosPage from './pages/orders/PedidosPage'
import PedidoDetalhePage from './pages/orders/PedidoDetalhePage'
import FinanceiroPage from './pages/financial/FinanceiroPage'
import ComprasPage from './pages/purchases/ComprasPage'
import EstoquePage from './pages/stock/EstoquePage'
import TarefasPage from './pages/tasks/TarefasPage'
import ActionCenter from './pages/ActionCenter'
import EntregadorDashboard from './pages/EntregadorDashboard'
import AdminMeuDia from './pages/AdminMeuDia'
import LogisticaMeuDia from './pages/LogisticaMeuDia'
import OwnerMeuDia from './pages/OwnerMeuDia'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
    },
  },
})

// ── Redireciona para o cockpit correto baseado nos valores reais do banco ──
// Ordem obrigatória: department='entregas' ANTES de role='logistics'
// (Cláudio e Adriana ambos têm role='logistics' — department diferencia os dois)
function RootRedirect() {
  const { seller, isLoading } = useAuthContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading || !seller) return

    if (seller.department === 'entregas') {
      navigate('/entregador', { replace: true })
    } else if (seller.department === 'logistics') {
      navigate('/logistica', { replace: true })
    } else if (seller.department === 'admin') {
      navigate('/admin', { replace: true })
    } else if (seller.role === 'owner') {
      navigate('/owner', { replace: true })
    } else {
      // role='seller' (Joésio, Murilo, Nayara) ou qualquer outro não mapeado
      navigate('/vendedor', { replace: true })
    }
  }, [seller, isLoading, navigate])

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Privadas */}
        <Route element={<PrivateRoute />}>

          {/* /entregador — fora do AppLayout (sem sidebar, mobile-first) */}
          <Route path="/entregador" element={<EntregadorDashboard />} />

          <Route element={<AppLayout />}>

            {/* Raiz → detecta perfil e redireciona para o cockpit */}
            <Route path="/" element={<RootRedirect />} />

            {/* Cockpits por perfil */}
            {/* /owner      → Henrique (role='owner')              */}
            {/* /admin      → Anna     (department='admin')         */}
            {/* /logistica  → Adriana  (department='logistics')     */}
            {/* /vendedor   → Joésio, Murilo, Nayara (role='seller')*/}
            {/* Nota: ActionCenter detecta internamente qual cockpit */}
            {/*       renderizar enquanto as páginas dedicadas não   */}
            {/*       existem. Trocar por componentes específicos    */}
            {/*       conforme forem construídos.                    */}
            <Route path="/owner"     element={<OwnerMeuDia />} />
            <Route path="/admin"     element={<AdminMeuDia />} />
            <Route path="/logistica" element={<LogisticaMeuDia />} />
            <Route path="/vendedor"  element={<ActionCenter />} />

            {/* Compatibilidade — mantém /meu-dia funcionando */}
            <Route path="/meu-dia" element={<Navigate to="/" replace />} />

            {/* Módulos do sistema */}
            <Route path="/dashboard"    element={<DashboardPage />} />
            <Route path="/clientes"     element={<ClientesPage />} />
            <Route path="/clientes/:id" element={<ClientePage />} />
            <Route path="/produtos"     element={<ProdutosPage />} />
            <Route path="/pedidos"      element={<PedidosPage />} />
            <Route path="/pedidos/:id"  element={<PedidoDetalhePage />} />
            <Route path="/financeiro"   element={<FinanceiroPage />} />
            <Route path="/compras"      element={<ComprasPage />} />
            <Route path="/estoque"      element={<EstoquePage />} />
            <Route path="/tarefas"      element={<TarefasPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  )
}
