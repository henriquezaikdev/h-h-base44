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

    if (clientsErr) throw new Error(`clients: ${clientsErr.message}`)
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, timestamp: now.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[score] ${clients.length} inativos encontrados`)

    // 2. Buscar TODOS os pedidos aprovados/invoiced dos últimos 12 meses em uma query
    //    Paginar em batches de 1000 para não estourar limite
    const allOrders: { client_id: string; total: number }[] = []
    let page = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: batch, error: batchErr } = await supabase
        .from('orders')
        .select('client_id, total')
        .eq('company_id', COMPANY_ID)
        .in('status', ['approved', 'invoiced'])
        .gte('created_at', twelveMonthsAgo)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (batchErr) throw new Error(`orders page ${page}: ${batchErr.message}`)
      if (!batch || batch.length === 0) break
      allOrders.push(...batch)
      if (batch.length < PAGE_SIZE) break
      page++
    }

    console.log(`[score] ${allOrders.length} pedidos carregados`)

    // 3. Agrupar por client_id em memória
    const revenueByClient = new Map<string, number>()
    for (const o of allOrders) {
      revenueByClient.set(o.client_id, (revenueByClient.get(o.client_id) ?? 0) + (o.total ?? 0))
    }

    // 4. Calcular e fazer updates em batch (até 50 por vez usando Promise.all)
    let processed = 0
    const BATCH_SIZE = 50
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)
      const updates = batch.map(client => {
        const receita = revenueByClient.get(client.id) ?? 0
        const valorMedioMensal = receita / 12

        let diasInativo = 999
        if (client.last_order_at) {
          const lastDate = new Date(String(client.last_order_at).replace(' ', 'T'))
          diasInativo = Math.floor((now.getTime() - lastDate.getTime()) / 86_400_000)
        }

        const totalPedidos = client.total_orders ?? 0
        const score = Math.round(((valorMedioMensal * 0.4) + (diasInativo * 0.3) + (totalPedidos * 0.2)) * 100) / 100

        return supabase
          .from('clients')
          .update({ reativacao_score: score })
          .eq('id', client.id)
          .then(({ error }) => !error)
      })

      const results = await Promise.all(updates)
      processed += results.filter(Boolean).length
    }

    console.log(`[score] Concluido: ${processed}/${clients.length}`)

    return new Response(
      JSON.stringify({ processed, total: clients.length, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[score] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
