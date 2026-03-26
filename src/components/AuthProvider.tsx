import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Seller, SellerRole } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user:      User | null
  seller:    Seller | null
  isLoading: boolean
}

export interface AuthContextValue {
  user:      User | null
  seller:    Seller | null
  isLoading: boolean
  role:      SellerRole | null
  logout:    () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearSupabaseStorage() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-'))
    .forEach(k => localStorage.removeItem(k))
}

/**
 * Remove tokens sb- do localStorage que estejam expirados ou não parseáveis.
 * Chamada preventivamente antes de getSession() para evitar loading infinito.
 */
function clearCorruptedTokens() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-'))
    for (const key of keys) {
      const value = localStorage.getItem(key)
      if (!value) continue
      const parsed = JSON.parse(value)
      if (parsed?.expires_at && parsed.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Se não conseguir parsear, remove tudo sb-
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k))
  }
}

async function fetchSeller(userId: string): Promise<Seller | null> {
  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('auth_user_id', userId)
    .single()

  if (error || !data) return null
  return data as Seller
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * AuthProvider — única subscription onAuthStateChange para o app inteiro.
 *
 * Elimina o problema de múltiplos hooks useAuth criando instâncias independentes
 * com estados isolados que causam briefly user=null durante navegação.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:      null,
    seller:    null,
    isLoading: true,
  })

  useEffect(() => {
    let cancelled = false

    // 1. Limpa tokens expirados/corrompidos antes de qualquer operação de auth
    clearCorruptedTokens()

    // 2. Safety timeout — isLoading nunca fica true por mais de 15 segundos
    //    Apenas para isLoading: false, sem signOut (não mata sessão válida)
    const safetyTimer = setTimeout(() => {
      if (cancelled) return
      console.log('[Auth] safety-timeout-fired — desbloqueando loading')
      if (!cancelled) setState(prev => prev.isLoading ? { ...prev, isLoading: false } : prev)
    }, 15000)

    // 3. getSession() com timeout de 10 segundos
    const initSession = async () => {
      console.log('[Auth] initSession:start')
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 10000)
        )
        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ])

        if (cancelled) return

        if (error) {
          console.log('[Auth] initSession:error', error.message)
          clearTimeout(safetyTimer)
          clearCorruptedTokens()
          await supabase.auth.signOut()
          if (!cancelled) setState({ user: null, seller: null, isLoading: false })
          return
        }

        console.log('[Auth] initSession:session-ok', session ? 'has-session' : 'no-session')
        const user = session?.user ?? null
        console.log('[Auth] initSession:fetchSeller:start')
        const seller = user ? await fetchSeller(user.id) : null
        console.log('[Auth] initSession:fetchSeller:done')
        // clearTimeout só após fetchSeller concluir — evita loading infinito se fetchSeller travar
        clearTimeout(safetyTimer)
        if (!cancelled) setState({ user, seller, isLoading: false })
      } catch (e) {
        if (cancelled) return
        console.log('[Auth] initSession:catch', e instanceof Error ? e.message : e)
        clearTimeout(safetyTimer)
        // Não faz signOut — pode ser só timeout de rede. Desbloqueia o loading.
        if (!cancelled) setState({ user: null, seller: null, isLoading: false })
      }
    }

    initSession()

    // 4. onAuthStateChange para mudanças contínuas (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] authStateChange:', event)
        if (cancelled) return

        // TOKEN_REFRESHED com sessão nula = token corrompido — limpa e desloga
        if (event === 'TOKEN_REFRESHED' && !session) {
          clearCorruptedTokens()
          await supabase.auth.signOut()
          return
        }

        // Token atualizado com sucesso — só atualiza user, não rebusca seller
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setState(prev => ({ ...prev, user: session.user }))
          return
        }

        // INITIAL_SESSION já foi tratado por initSession()
        if (event === 'INITIAL_SESSION') return

        // Deslogado ou sessão encerrada — garante limpeza do storage
        if (event === 'SIGNED_OUT' || !session) {
          clearSupabaseStorage()
        }

        const user   = session?.user ?? null
        const seller = user ? await fetchSeller(user.id) : null

        if (!cancelled) {
          clearTimeout(safetyTimer)
          setState({ user, seller, isLoading: false })
        }
      }
    )

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthContextValue = {
    user:      state.user,
    seller:    state.seller,
    isLoading: state.isLoading,
    role:      (state.seller?.role ?? null) as SellerRole | null,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
