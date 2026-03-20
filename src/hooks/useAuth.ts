import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Seller, SellerRole } from '../types'

interface AuthState {
  user: User | null
  seller: Seller | null
  isLoading: boolean
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

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    seller: null,
    isLoading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      const seller = user ? await fetchSeller(user.id) : null

      if (!cancelled) {
        setState({ user, seller, isLoading: false })
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null
        const seller = user ? await fetchSeller(user.id) : null

        if (!cancelled) {
          setState({ user, seller, isLoading: false })
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const role: SellerRole | null = state.seller?.role ?? null

  return {
    user: state.user,
    seller: state.seller,
    role,
    isLoading: state.isLoading,
    logout,
  }
}
