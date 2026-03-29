import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const companyId = '00000000-0000-0000-0000-000000000001'
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString()

    // 1. Buscar clientes inativos que não são janela_longa
    const { data: inactiveClients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, last_order_at, total_orders')
      .eq('company_id', companyId)
      .eq('status', 'inactive')
      .eq('janela_longa', false)

    if (clientsErr) throw clientsErr
    if (!inactiveClients || inactiveClients.length === 0) {
      return new Response(JSON.stringify({ processed: 0, timestamp: now.toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientIds = inactiveClients.map((c: { id: string }) => c.id)

    // 2. Buscar pedidos dos últimos 12 meses para esses clientes
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, client_id, total, created_at, status')
      .eq('company_id', companyId)
      .in('client_id', clientIds)
      .in('status', ['approved', 'invoiced'])
      .gte('created_at', twelveMonthsAgo)

    if (ordersErr) throw ordersErr

    // 3. Agrupar pedidos por cliente
    const ordersByClient = new Map<string, { total: number; count: number }>()
    for (const o of (orders ?? [])) {
      const existing = ordersByClient.get(o.client_id) ?? { total: 0, count: 0 }
      existing.total += (o.total ?? 0)
      existing.count += 1
      ordersByClient.set(o.client_id, existing)
    }

    // 4. Calcular score para cada cliente
    let processed = 0
    for (const client of inactiveClients) {
      const orderData = ordersByClient.get(client.id) ?? { total: 0, count: 0 }

      // valor_medio_mensal: receita últimos 12 meses / 12
      const valorMedioMensal = orderData.total / 12

      // dias_inativo: dias desde último pedido
      let diasInativo = 0
      if (client.last_order_at) {
        const lastOrder = new Date(String(client.last_order_at).replace(' ', 'T'))
        diasInativo = Math.floor((now.getTime() - lastOrder.getTime()) / 86_400_000)
      } else {
        diasInativo = 365 // sem pedidos = 1 ano como fallback
      }

      // total_pedidos_historico
      const totalPedidosHistorico = client.total_orders ?? 0

      // sazonalidade_bonus: placeholder
      const sazonalidadeBonus = 0

      // Score = (valor_medio_mensal × 0.4) + (dias_inativo × 0.3) + (total_pedidos_historico × 0.2) + (sazonalidade_bonus × 0.1)
      const score = (valorMedioMensal * 0.4) + (diasInativo * 0.3) + (totalPedidosHistorico * 0.2) + (sazonalidadeBonus * 0.1)

      // Arredondar para 2 casas decimais
      const roundedScore = Math.round(score * 100) / 100

      const { error: updateErr } = await supabase
        .from('clients')
        .update({ reativacao_score: roundedScore })
        .eq('id', client.id)

      if (!updateErr) processed++
    }

    console.log(`[calcular-score-reativacao] Processados: ${processed}/${inactiveClients.length} | ${now.toISOString()}`)

    return new Response(
      JSON.stringify({ processed, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[calcular-score-reativacao] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
