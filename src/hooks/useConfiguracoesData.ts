import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSupabaseQuery } from './useSupabaseQuery'
import { useAuth } from './useAuth'

const CID = '00000000-0000-0000-0000-000000000001'

/* ── app_config ────────────────────────────────────────────────────────────── */

export function useAppConfig() {
  return useSupabaseQuery<Record<string, string>>(async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('company_id', CID)

    if (error) return { data: null, error }

    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value ?? ''
    return { data: map, error: null }
  }, [])
}

export async function upsertAppConfig(key: string, value: string) {
  return supabase.from('app_config').upsert(
    { company_id: CID, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'company_id,key' },
  )
}

/* ── sellers para config ───────────────────────────────────────────────────── */

export interface SellerConfig {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  active: boolean
  auth_user_id: string | null
  avatar_url: string | null
  is_sales_active: boolean | null
  status: string | null
}

export function useSellersParaConfig() {
  const { seller } = useAuth()
  const { data: sellers = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['sellers-config', seller?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers')
        .select('id, name, email, role, department, active, auth_user_id, avatar_url, is_sales_active, status')
        .order('name')

      if (error) { console.error('[useSellersParaConfig]', error); throw error }
      return (data ?? []) as SellerConfig[]
    },
    enabled: !!seller,
    staleTime: 1000 * 60 * 2,
  })

  return { data: sellers.length > 0 ? sellers : null, loading, error: null, refetch }
}

/* ── monthly_goals ─────────────────────────────────────────────────────────── */

interface MonthlyGoal {
  id: string
  seller_id: string
  month: number
  year: number
  sales_target: number
  sales_achieved: number
  calls_target: number
  call_attempts_target: number
  whatsapp_response_target: number
  whatsapp_no_response_target: number
  scope: string
  sellers: { name: string } | null
}

export function useMonthlyGoals(month: number, year: number) {
  return useSupabaseQuery<MonthlyGoal[]>(
    ({ company_id }) =>
      supabase
        .from('monthly_goals')
        .select('*, sellers(name)')
        .eq('company_id', company_id)
        .eq('month', month)
        .eq('year', year)
        .order('created_at'),
    [month, year],
  )
}
