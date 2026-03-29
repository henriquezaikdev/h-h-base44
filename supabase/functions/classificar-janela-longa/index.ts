import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COMPANY_ID = '00000000-0000-0000-0000-000000000001'
const DAY_MS = 86_400_000

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const eighteenMonthsAgo = new Date(now.getTime() - 548 * DAY_MS)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS)

    // 1. Buscar todos os clientes (apenas ids)
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id')
      .eq('company_id', COMPANY_ID)

    if (clientsErr) throw new Error(`clients: ${clientsErr.message}`)
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ classificados_janela_longa: 0, total_processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[janela] ${clients.length} clientes encontrados`)

    // 2. Buscar TODOS os pedidos aprovados/invoiced em batches paginados
    const allOrders: { client_id: string; created_at: string }[] = []
    let page = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: batch, error: batchErr } = await supabase
        .from('orders')
        .select('client_id, created_at')
        .eq('company_id', COMPANY_ID)
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (batchErr) throw new Error(`orders page ${page}: ${batchErr.message}`)
      if (!batch || batch.length === 0) break
      allOrders.push(...batch)
      if (batch.length < PAGE_SIZE) break
      page++
    }

    console.log(`[janela] ${allOrders.length} pedidos carregados`)

    // 3. Agrupar pedidos por client_id (já ordenados por created_at)
    const ordersByClient = new Map<string, string[]>()
    for (const o of allOrders) {
      const list = ordersByClient.get(o.client_id) ?? []
      list.push(o.created_at)
      ordersByClient.set(o.client_id, list)
    }

    // 4. Processar em memória
    let classificados = 0
    let totalProcessados = 0
    const BATCH_SIZE = 50

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)

      const updates = batch.map(client => {
        const dates = ordersByClient.get(client.id) ?? []

        // Sem pedidos suficientes
        if (dates.length < 2) {
          return supabase.from('clients')
            .update({ janela_longa: false, intervalo_medio_dias: null, proxima_compra_estimada: null })
            .eq('id', client.id)
            .then(({ error }) => ({ ok: !error, janela: false }))
        }

        // Calcular intervalos
        const timestamps = dates.map(d => new Date(String(d).replace(' ', 'T')).getTime())
        const intervals: number[] = []
        for (let j = 1; j < timestamps.length; j++) {
          const diff = Math.floor((timestamps[j] - timestamps[j - 1]) / DAY_MS)
          if (diff > 0) intervals.push(diff)
        }

        if (intervals.length === 0) {
          return supabase.from('clients')
            .update({ janela_longa: false, intervalo_medio_dias: null, proxima_compra_estimada: null })
            .eq('id', client.id)
            .then(({ error }) => ({ ok: !error, janela: false }))
        }

        const intervaloMedio = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)

        // Pedidos últimos 18 meses
        const totalRecente = timestamps.filter(t => t >= eighteenMonthsAgo.getTime()).length

        // Pedido recente (90 dias)
        const temRecente = timestamps.some(t => t >= ninetyDaysAgo.getTime())

        // Regra
        const isJanela = intervaloMedio > 60 && totalRecente >= 3 && !temRecente

        // Próxima compra estimada
        const lastTimestamp = timestamps[timestamps.length - 1]
        const proximaCompra = new Date(lastTimestamp + intervaloMedio * DAY_MS).toISOString().slice(0, 10)

        return supabase.from('clients')
          .update({
            janela_longa: isJanela,
            intervalo_medio_dias: intervaloMedio,
            proxima_compra_estimada: proximaCompra,
          })
          .eq('id', client.id)
          .then(({ error }) => ({ ok: !error, janela: isJanela }))
      })

      const results = await Promise.all(updates)
      for (const r of results) {
        if (r.ok) totalProcessados++
        if (r.ok && r.janela) classificados++
      }
    }

    console.log(`[janela] Janela longa: ${classificados} | Total: ${totalProcessados}`)

    return new Response(
      JSON.stringify({ classificados_janela_longa: classificados, total_processados: totalProcessados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[janela] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
