import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { client_id, company_id, messages } = await req.json()

    if (!client_id || !company_id) {
      return new Response(JSON.stringify({ error: 'client_id e company_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const [clientRes, ordersRes, tasksRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, trade_name, cnpj, status, avg_ticket, avg_reorder_days, total_orders, total_revenue, last_order_at, notes, payment_term, priority_score')
        .eq('id', client_id)
        .eq('company_id', company_id)
        .single(),

      supabase
        .from('orders')
        .select('id, status, total, created_at, approved_at, order_items(qty, unit_price, total, products(id, name, sku))')
        .eq('client_id', client_id)
        .eq('company_id', company_id)
        .in('status', ['approved', 'picked', 'delivered', 'invoiced'])
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50),

      supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('client_id', client_id)
        .eq('company_id', company_id)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(10),
    ])

    const client = clientRes.data
    if (!client) {
      return new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const orders = ordersRes.data || []
    const tasks = tasksRes.data || []

    const daysSinceLastOrder = client.last_order_at
      ? Math.floor((Date.now() - new Date(client.last_order_at).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const productMap: Record<string, { name: string; count: number; lastDate: string; totalQty: number }> = {}
    for (const order of orders) {
      for (const item of (order.order_items || [])) {
        if (!item.products) continue
        const pid = item.products.id
        if (!productMap[pid]) productMap[pid] = { name: item.products.name, count: 0, lastDate: order.created_at, totalQty: 0 }
        productMap[pid].count++
        productMap[pid].totalQty += item.qty
        if (order.created_at > productMap[pid].lastDate) productMap[pid].lastDate = order.created_at
      }
    }

    const cutoff60 = Date.now() - 60 * 24 * 60 * 60 * 1000
    const produtosParados = Object.values(productMap)
      .filter(p => new Date(p.lastDate).getTime() < cutoff60)
      .sort((a, b) => new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime())
      .slice(0, 10)
      .map(p => ({ nome: p.name, diasParado: Math.floor((Date.now() - new Date(p.lastDate).getTime()) / (1000 * 60 * 60 * 24)), pedidos: p.count }))

    const topProdutos = Object.values(productMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(p => ({ nome: p.name, pedidos: p.count }))

    const contexto = {
      cliente: {
        nome: client.name,
        nomeFant: client.trade_name,
        status: client.status,
        ticketMedio: client.avg_ticket,
        intervaloMedioRecompra: client.avg_reorder_days,
        totalPedidos: client.total_orders,
        faturamentoTotal: client.total_revenue,
        ultimoPedidoHa: daysSinceLastOrder !== null ? `${daysSinceLastOrder} dias` : 'sem pedidos',
        condicaoPagamento: client.payment_term,
        observacoes: client.notes,
      },
      historico: { pedidosUltimos12Meses: orders.length, topProdutos, produtosParados },
      tarefasAbertas: tasks.map(t => ({ titulo: t.title, prioridade: t.priority, vencimento: t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : null })),
    }

    const systemPrompt = `Você é o Assistente Comercial da H&H Suprimentos Corporativos. Copiloto do vendedor — direto, prático, orientado a resultado. Nunca invente dados. Trabalhe apenas com o contexto fornecido. Não use emojis. Linguagem profissional e direta.\n\nCONTEXTO DO CLIENTE:\n${JSON.stringify(contexto, null, 2)}`

    const apiMessages = (messages || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))

    if (apiMessages.length === 0) {
      apiMessages.push({ role: 'user', content: 'Faça uma análise completa deste cliente. Estruture em: Diagnóstico, Itens de Atenção, Leitura Comercial, Sugestão de Abordagem e Próxima Ação.' })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY não configurada')

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: systemPrompt, messages: apiMessages }),
    })

    if (!aiRes.ok) throw new Error(`Anthropic API error: ${await aiRes.text()}`)

    const aiData = await aiRes.json()
    const resposta = aiData.content?.[0]?.text || ''

    return new Response(JSON.stringify({ resposta, contexto }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro assistente-cliente:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
