/**
 * useAuth — lê o estado de autenticação do AuthContext.
 *
 * Todos os componentes que chamam useAuth() compartilham o mesmo estado,
 * gerenciado pelo AuthProvider em App.tsx (única subscription onAuthStateChange).
 */
export { useAuthContext as useAuth } from '../components/AuthProvider'
export type { AuthContextValue } from '../components/AuthProvider'
