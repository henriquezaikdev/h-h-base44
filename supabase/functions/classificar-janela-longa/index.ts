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
    const eighteenMonthsAgo = new Date(now.getTime() - 548 * 86_400_000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString()

    // 1. Buscar todos os clientes da empresa
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id')
      .eq('company_id', companyId)

    if (clientsErr) throw clientsErr
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ classificados_janela_longa: 0, total_processados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const clientIds = clients.map((c: { id: string }) => c.id)

    // 2. Buscar todos os pedidos aprovados/invoiced desses clientes
    const { data: allOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, client_id, created_at, status')
      .eq('company_id', companyId)
      .in('client_id', clientIds)
      .in('status', ['approved', 'invoiced'])
      .order('created_at', { ascending: true })

    if (ordersErr) throw ordersErr

    // 3. Agrupar pedidos por cliente
    const ordersByClient = new Map<string, { created_at: string }[]>()
    for (const o of (allOrders ?? [])) {
      const list = ordersByClient.get(o.client_id) ?? []
      list.push({ created_at: o.created_at })
      ordersByClient.set(o.client_id, list)
    }

    // 4. Processar cada cliente
    let classificadosJanelaLonga = 0
    let totalProcessados = 0

    for (const client of clients) {
      const orders = ordersByClient.get(client.id) ?? []

      // Precisa de pelo menos 2 pedidos para calcular intervalos
      if (orders.length < 2) {
        // Sem histórico suficiente — marcar como não-janela-longa
        await supabase
          .from('clients')
          .update({ janela_longa: false, intervalo_medio_dias: null, proxima_compra_estimada: null })
          .eq('id', client.id)
        totalProcessados++
        continue
      }

      // Calcular intervalos entre pedidos consecutivos
      const intervals: number[] = []
      for (let i = 1; i < orders.length; i++) {
        const prev = new Date(String(orders[i - 1].created_at).replace(' ', 'T'))
        const curr = new Date(String(orders[i].created_at).replace(' ', 'T'))
        const diffDays = Math.floor((curr.getTime() - prev.getTime()) / 86_400_000)
        if (diffDays > 0) intervals.push(diffDays)
      }

      const intervaloMedio = intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : 0

      // Contar pedidos nos últimos 18 meses
      const totalRecente = orders.filter(o => {
        const d = new Date(String(o.created_at).replace(' ', 'T'))
        return d.getTime() >= new Date(eighteenMonthsAgo).getTime()
      }).length

      // Verificar se tem pedido nos últimos 90 dias
      const temPedidoRecente = orders.some(o => {
        const d = new Date(String(o.created_at).replace(' ', 'T'))
        return d.getTime() >= new Date(ninetyDaysAgo).getTime()
      })

      // Regra janela_longa
      const isJanelaLonga = intervaloMedio > 60 && totalRecente >= 3 && !temPedidoRecente

      // proxima_compra_estimada = data do último pedido + intervalo_medio_dias
      let proximaCompra: string | null = null
      if (intervaloMedio > 0 && orders.length > 0) {
        const lastOrderDate = new Date(String(orders[orders.length - 1].created_at).replace(' ', 'T'))
        const estimated = new Date(lastOrderDate.getTime() + intervaloMedio * 86_400_000)
        proximaCompra = estimated.toISOString().slice(0, 10) // DATE format YYYY-MM-DD
      }

      const { error: updateErr } = await supabase
        .from('clients')
        .update({
          janela_longa: isJanelaLonga,
          intervalo_medio_dias: intervaloMedio > 0 ? intervaloMedio : null,
          proxima_compra_estimada: proximaCompra,
        })
        .eq('id', client.id)

      if (!updateErr) {
        totalProcessados++
        if (isJanelaLonga) classificadosJanelaLonga++
      }
    }

    console.log(`[classificar-janela-longa] Janela longa: ${classificadosJanelaLonga} | Total: ${totalProcessados} | ${now.toISOString()}`)

    return new Response(
      JSON.stringify({ classificados_janela_longa: classificadosJanelaLonga, total_processados: totalProcessados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[classificar-janela-longa] Erro:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
