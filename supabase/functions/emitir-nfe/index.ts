import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dados fixos do emitente — H&H
const EMITENTE = {
  cnpj: '33116012000135',
  nome: 'H & H COMERCIO E SOLUÇÕES EMPRESARIAIS LTDA',
  nome_fantasia: 'H&H TONERS E PAPELARIA',
  logradouro: 'AVENIDA DELVEAUX VIEIRA PRUDENTE',
  numero: 'S/N',
  complemento: 'LOJA 3 LOTE 2 QUADRA 6',
  bairro: 'JARDIM MONT SERRAT',
  municipio: 'Aparecida de Goiânia',
  uf: 'GO',
  cep: '74917470',
  inscricao_estadual: '107591472',
  regime_tributario: '1', // Simples Nacional
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { order_id, company_id } = await req.json()

    if (!order_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'order_id e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Buscar configuração fiscal
    const { data: fiscalConfig, error: fiscalError } = await supabase
      .from('fiscal_config')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (fiscalError || !fiscalConfig) {
      return new Response(
        JSON.stringify({ error: 'Configuração fiscal não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = fiscalConfig.ambiente === 'producao'
      ? fiscalConfig.focusnfe_token_producao
      : fiscalConfig.focusnfe_token_homologacao

    const baseUrl = fiscalConfig.ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br'

    // 2. Buscar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('company_id', company_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.nfe_status === 'autorizado') {
      return new Response(
        JSON.stringify({ error: 'NF-e já emitida para este pedido', nfe_key: order.nfe_key }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Buscar cliente
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', order.client_id)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!client.cnpj) {
      return new Response(
        JSON.stringify({ error: 'Cliente sem CNPJ cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Buscar itens do pedido com produtos
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(`
        *,
        products (id, sku, name, unit, ncm)
      `)
      .eq('order_id', order_id)

    if (itemsError || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Itens do pedido não encontrados' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Validar NCM de todos os itens antes de montar payload
    for (const item of items as any[]) {
      if (!item.products?.ncm) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Produto "${item.products?.name || item.product_id}" não tem NCM cadastrado. Cadastre o NCM antes de emitir NF-e.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 6. Montar itens da NF-e
    const cfop = (client.state === 'GO' || client.uf === 'GO') ? '5102' : '6102'

    const nfeItems = items.map((item: any, index: number) => {
      const unitPrice = Number(item.unit_price) || 0
      const qty = Number(item.qty) || 1
      const discount = Number(item.discount) || 0
      const total = Number(item.total) || (unitPrice * qty - discount)

      return {
        numero_item: String(index + 1),
        codigo_produto: item.products?.sku || item.product_id,
        descricao: item.products?.name || 'PRODUTO',
        codigo_ncm: String(item.products?.ncm || '0').padStart(8, '0'),
        cfop, // 5102 dentro de GO, 6102 interestadual
        unidade_comercial: item.products?.unit || 'UN',
        quantidade_comercial: qty,
        valor_unitario_comercial: unitPrice,
        valor_bruto: total,
        unidade_tributavel: item.products?.unit || 'UN',
        quantidade_tributavel: qty,
        valor_unitario_tributavel: unitPrice,
        icms_situacao_tributaria: '400', // Simples Nacional — não tributado pelo SN
        icms_origem: '0', // Nacional
        pis_situacao_tributaria: '07', // Operação isenta
        cofins_situacao_tributaria: '07', // Operação isenta
      }
    })

    // 7. Montar payload Focus NFe
    const ref = `hh-${order_id.replace(/-/g, '').substring(0, 20)}`
    const cnpjLimpo = client.cnpj.replace(/\D/g, '')
    const now = new Date()
    const offset = -3 * 60
    const localTime = new Date(now.getTime() + (offset * 60 * 1000))
    const dataEmissao = localTime.toISOString().replace('Z', '-03:00')

    // Parsear endereço do cliente — campo address é texto livre
    // Estrutura mínima obrigatória para B2B
    const numeroNfe = String(fiscalConfig.numero_inicial || 1)

    const payload: any = {
      natureza_operacao: fiscalConfig.natureza_operacao,
      serie: fiscalConfig.serie,
      numero: numeroNfe,
      data_emissao: dataEmissao,
      data_entrada_saida: dataEmissao,
      tipo_documento: '1', // Saída
      finalidade_emissao: '1', // Normal
      consumidor_final: (client.ie && client.ie.trim()) ? '0' : '1',
      presenca_comprador: '9', // Operação não presencial (internet/outro)

      // Emitente
      cnpj_emitente: EMITENTE.cnpj,
      nome_emitente: EMITENTE.nome,
      nome_fantasia_emitente: EMITENTE.nome_fantasia,
      logradouro_emitente: EMITENTE.logradouro,
      numero_emitente: EMITENTE.numero,
      complemento_emitente: EMITENTE.complemento,
      bairro_emitente: EMITENTE.bairro,
      municipio_emitente: EMITENTE.municipio,
      uf_emitente: EMITENTE.uf,
      cep_emitente: EMITENTE.cep,
      inscricao_estadual_emitente: EMITENTE.inscricao_estadual,
      regime_tributario: EMITENTE.regime_tributario,

      // Destinatário
      cnpj_destinatario: cnpjLimpo,
      nome_destinatario: fiscalConfig.ambiente === 'homologacao'
        ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : client.name,
      email_destinatario: client.email || '',
      telefone_destinatario: client.phone?.replace(/\D/g, '') || '',
      // Endereço do destinatário
      logradouro_destinatario: client.street || client.address || '',
      numero_destinatario: client.street_number || 'SN',
      complemento_destinatario: client.complement || '',
      bairro_destinatario: client.neighborhood || 'Centro',
      municipio_destinatario: client.city || '',
      codigo_municipio_destinatario: client.codigo_ibge || undefined,
      uf_destinatario: client.state || 'GO',
      pais_destinatario: 'Brasil',
      cep_destinatario: (client.zip_code || client.postal_code || '').replace(/\D/g, '') || '00000000',
      indicador_inscricao_estadual_destinatario: (client.ie && client.ie.trim()) ? '1' : '9',
      inscricao_estadual_destinatario: client.ie || '',

      modalidade_frete: '9', // Sem frete / modalidade não informada

      // Itens
      items: nfeItems,

      // Pagamento — a prazo (padrão B2B)
      forma_pagamento: [
        {
          forma_pagamento: '15', // Boleto / a prazo
          valor_pagamento: Number(order.total),
        }
      ],
    }

    // 8. Enviar para Focus NFe
    const focusUrl = `${baseUrl}/v2/nfe?ref=${ref}`

    await supabase
      .from('orders')
      .update({ nfe_status: 'processando', nfe_ref: ref, updated_at: new Date().toISOString() })
      .eq('id', order_id)

    const focusResponse = await fetch(focusUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(token + ':')}`,
      },
      body: JSON.stringify(payload),
    })

    const focusData = await focusResponse.json()

    // 9. Processar resposta
    if (focusResponse.status === 202 || focusResponse.status === 200) {
      // Verificar se já veio autorizada imediatamente
      const jaAutorizada = focusData.status === 'autorizado'

      const updateData: any = {
        nfe_status: jaAutorizada ? 'autorizada' : 'processando',
        nfe_ref: ref,
        updated_at: new Date().toISOString(),
      }

      if (jaAutorizada) {
        updateData.status = 'invoiced'
        updateData.nfe_key = focusData.chave_nfe || null
        updateData.nfe_url = focusData.caminho_danfe || null
        updateData.nfe_issued_at = new Date().toISOString()
      }

      await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order_id)

      // Incrementar número da NF-e para próxima emissão
      await supabase
        .from('fiscal_config')
        .update({ numero_inicial: (fiscalConfig.numero_inicial || 1) + 1 })
        .eq('company_id', company_id)

      return new Response(
        JSON.stringify({
          success: true,
          status: jaAutorizada ? 'autorizada' : 'processando',
          ref,
          message: jaAutorizada ? 'NF-e autorizada com sucesso.' : 'NF-e enviada para processamento. Aguarde autorização.',
          focus_response: focusData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Erro no envio
    await supabase
      .from('orders')
      .update({
        nfe_status: 'erro',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    const erros: { codigo?: string; mensagem: string; campo?: string }[] =
      focusData?.erros || []
    const errorMsg = focusData?.mensagem
      || (erros.length > 0 ? erros.map(e => e.mensagem).join(' | ') : 'Erro ao emitir NF-e')

    return new Response(
      JSON.stringify({
        success: false,
        status: 'erro',
        error:  errorMsg,
        erros,
        focus_response: focusData,
      }),
      // Retorna 200 para que o Supabase SDK popule data corretamente —
      // status não-2xx faz o SDK retornar data: null no cliente
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Erro na Edge Function emitir-nfe:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
