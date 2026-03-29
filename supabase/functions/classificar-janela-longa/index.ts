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
    const eighteenMonthsAgo = new Date(now.getTime() - 548 * DAY_MS).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS).toISOString()

    // 1. Buscar todos os clientes da empresa
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id')
      .eq('company_id', COMPANY_ID)

    if (clientsErr) {
      console.error('[janela-longa] Erro ao buscar clients:', clientsErr)
      throw new Error(clientsErr.message)
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ classificados_janela_longa: 0, total_processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[janela-longa] Processando ${clients.length} clientes`)

    let classificados = 0
    let totalProcessados = 0

    for (const client of clients) {

      // 2. Buscar orders aprovados/invoiced ordenados por data
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('company_id', COMPANY_ID)
        .eq('client_id', client.id)
        .in('status', ['approved', 'invoiced'])
        .order('created_at', { ascending: true })

      if (ordersErr) {
        console.error(`[janela-longa] Erro orders cliente ${client.id}:`, ordersErr.message)
        continue
      }

      const orderList = orders ?? []

      // Menos de 2 pedidos: sem dados para intervalo
      if (orderList.length < 2) {
        await supabase
          .from('clients')
          .update({ janela_longa: false, intervalo_medio_dias: null, proxima_compra_estimada: null })
          .eq('id', client.id)
        totalProcessados++
        continue
      }

      // 3. Calcular intervalos entre pedidos consecutivos
      const intervals: number[] = []
      for (let i = 1; i < orderList.length; i++) {
        const prev = new Date(String(orderList[i - 1].created_at).replace(' ', 'T'))
        const curr = new Date(String(orderList[i].created_at).replace(' ', 'T'))
        const diffDays = Math.floor((curr.getTime() - prev.getTime()) / DAY_MS)
        if (diffDays > 0) intervals.push(diffDays)
      }

      if (intervals.length === 0) {
        await supabase
          .from('clients')
          .update({ janela_longa: false, intervalo_medio_dias: null, proxima_compra_estimada: null })
          .eq('id', client.id)
        totalProcessados++
        continue
      }

      const intervaloMedio = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)

      // 4. Contar pedidos nos últimos 18 meses
      const totalRecente = orderList.filter(o => {
        const d = new Date(String(o.created_at).replace(' ', 'T'))
        return d.getTime() >= new Date(eighteenMonthsAgo).getTime()
      }).length

      // 5. Pedido recente (últimos 90 dias)?
      const temPedidoRecente = orderList.some(o => {
        const d = new Date(String(o.created_at).replace(' ', 'T'))
        return d.getTime() >= new Date(ninetyDaysAgo).getTime()
      })

      // 6. Regra janela_longa
      const isJanelaLonga = intervaloMedio > 60 && totalRecente >= 3 && !temPedidoRecente

      // 7. proxima_compra_estimada
      let proximaCompra: string | null = null
      const lastOrderDate = new Date(String(orderList[orderList.length - 1].created_at).replace(' ', 'T'))
      const estimated = new Date(lastOrderDate.getTime() + intervaloMedio * DAY_MS)
      proximaCompra = estimated.toISOString().slice(0, 10)

      // 8. Update
      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          janela_longa: isJanelaLonga,
          intervalo_medio_dias: intervaloMedio,
          proxima_compra_estimada: proximaCompra,
        })
        .eq('id', client.id)

      if (!updateErr) {
        totalProcessados++
        if (isJanelaLonga) classificados++
      } else {
        console.error(`[janela-longa] Erro update cliente ${client.id}:`, updateErr.message)
      }
    }

    console.log(`[janela-longa] Janela longa: ${classificados} | Total: ${totalProcessados} | ${now.toISOString()}`)

    return new Response(
      JSON.stringify({ classificados_janela_longa: classificados, total_processados: totalProcessados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[janela-longa] Erro fatal:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
