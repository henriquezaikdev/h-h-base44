import { useEffect, useRef, useState, useCallback } from 'react'
import type { Seller } from '../types'
import { useAuth } from './useAuth'

const SELLER_TIMEOUT_MS = 5_000

interface QueryContext {
  seller: Seller
  company_id: string
}

interface QueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook que aguarda o seller estar disponível antes de executar qualquer query.
 *
 * Uso:
 *   const { data, loading, error } = useSupabaseQuery(
 *     ({ company_id }) =>
 *       supabase.from('orders').select('*').eq('company_id', company_id),
 *     []
 *   )
 *
 * @param queryFn  Função que recebe { seller, company_id } e retorna uma
 *                 Promise com { data, error } (formato Supabase).
 * @param deps     Dependências extras que re-executam a query quando mudam.
 */
export function useSupabaseQuery<T>(
  queryFn: (ctx: QueryContext) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[] = [],
): QueryResult<T> {
  const { seller, isLoading: authLoading } = useAuth()

  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Stable ref so refetch can always call the latest queryFn
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const runQuery = useCallback(async (ctx: QueryContext) => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: err } = await queryFnRef.current(ctx)
      if (err) {
        console.error('[useSupabaseQuery]', err)
        setError(err.message)
        setData(null)
      } else {
        setData(result)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[useSupabaseQuery] unexpected:', msg)
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ref to the refetch context so the timeout can cancel correctly
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    // If auth finished but seller is null → show actionable error
    if (!authLoading && !seller) {
      setError('Perfil de vendedor não encontrado. Verifique se o auth_user_id está vinculado na tabela sellers.')
      setLoading(false)
      return
    }

    // Auth still loading → start timeout watchdog
    if (authLoading) {
      const timer = setTimeout(() => {
        if (!cancelledRef.current) {
          setError('Tempo limite excedido aguardando autenticação. Tente recarregar a página.')
          setLoading(false)
        }
      }, SELLER_TIMEOUT_MS)

      return () => {
        cancelledRef.current = true
        clearTimeout(timer)
      }
    }

    // seller is ready — run query
    runQuery({ seller: seller!, company_id: seller!.company_id })

    return () => { cancelledRef.current = true }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, seller, runQuery, ...deps])

  const refetch = useCallback(() => {
    if (seller) runQuery({ seller, company_id: seller.company_id })
  }, [seller, runQuery])

  return { data, loading, error, refetch }
}
