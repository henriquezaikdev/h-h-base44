import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import PrivateRoute from './components/layout/PrivateRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ClientesPage from './pages/crm/ClientesPage'
import ClientePage from './pages/crm/ClientePage'
import ProdutosPage from './pages/products/ProdutosPage'
import PedidosPage from './pages/orders/PedidosPage'
import FinanceiroPage from './pages/financial/FinanceiroPage'
import ComprasPage from './pages/purchases/ComprasPage'
import EstoquePage from './pages/stock/EstoquePage'
import TarefasPage from './pages/tasks/TarefasPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Privadas — verificam autenticação via Supabase */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/clientes/:id" element={<ClientePage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/pedidos" element={<PedidosPage />} />
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/compras" element={<ComprasPage />} />
            <Route path="/estoque" element={<EstoquePage />} />
            <Route path="/tarefas" element={<TarefasPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
