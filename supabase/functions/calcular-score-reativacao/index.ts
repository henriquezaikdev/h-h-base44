import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString()

    // 1. Buscar clientes inativos (não janela_longa)
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, last_order_at, total_orders')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'inactive')
      .eq('janela_longa', false)

    if (clientsErr) {
      console.error('[calcular-score] Erro ao buscar clients:', clientsErr)
      throw new Error(clientsErr.message)
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, timestamp: now.toISOString(), message: 'Nenhum cliente inativo encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[calcular-score] Encontrados ${clients.length} clientes inativos`)

    let processed = 0

    // 2. Para cada cliente, queries individuais
    for (const client of clients) {

      // 2a. Receita últimos 12 meses
      const { data: recentOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('total')
        .eq('company_id', COMPANY_ID)
        .eq('client_id', client.id)
        .in('status', ['approved', 'invoiced'])
        .gte('created_at', twelveMonthsAgo)

      if (ordersErr) {
        console.error(`[calcular-score] Erro orders cliente ${client.id}:`, ordersErr.message)
        continue
      }

      const receitaTotal = (recentOrders ?? []).reduce((sum: number, o: { total: number }) => sum + (o.total ?? 0), 0)
      const valorMedioMensal = receitaTotal / 12

      // 2b. Dias inativo
      let diasInativo = 999
      if (client.last_order_at) {
        const lastDate = new Date(String(client.last_order_at).replace(' ', 'T'))
        diasInativo = Math.floor((now.getTime() - lastDate.getTime()) / 86_400_000)
      }

      // 2c. Total pedidos historico
      const totalPedidos = client.total_orders ?? 0

      // 3. Calcular score
      const score = (valorMedioMensal * 0.4) + (diasInativo * 0.3) + (totalPedidos * 0.2) + (0 * 0.1)
      const roundedScore = Math.round(score * 100) / 100

      // 4. Update
      const { error: updateErr } = await supabase
        .from('clients')
        .update({ reativacao_score: roundedScore })
        .eq('id', client.id)

      if (updateErr) {
        console.error(`[calcular-score] Erro update cliente ${client.id}:`, updateErr.message)
      } else {
        processed++
      }
    }

    console.log(`[calcular-score] Concluido: ${processed}/${clients.length} | ${now.toISOString()}`)

    return new Response(
      JSON.stringify({ processed, total: clients.length, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[calcular-score] Erro fatal:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
