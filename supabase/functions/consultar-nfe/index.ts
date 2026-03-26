import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { order_id, company_id, ref } = await req.json()

    if (!ref || !company_id) {
      return new Response(
        JSON.stringify({ error: 'ref e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar config fiscal
    const { data: fiscalConfig } = await supabase
      .from('fiscal_config')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (!fiscalConfig) {
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

    // Consultar status no Focus NFe
    const focusUrl = `${baseUrl}/v2/nfe/${ref}`
    const focusResponse = await fetch(focusUrl, {
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
      },
    })

    const focusData = await focusResponse.json()
    console.log('[consultar-nfe] focusData completo:', JSON.stringify(focusData))

    // Mapear status do Focus NFe para o sistema
    const statusMap: Record<string, string> = {
      'autorizado': 'autorizada',
      'cancelado': 'cancelada',
      'erro_autorizacao': 'erro',
      'denegado': 'erro',
      'processando_autorizacao': 'processando',
      'processando': 'processando',
    }

    const novoStatus = statusMap[focusData.status] || 'processando'

    // Atualizar orders se status mudou
    if (order_id && (novoStatus === 'autorizada' || novoStatus === 'cancelada' || novoStatus === 'erro')) {
      const updateData: any = {
        nfe_status: novoStatus,
        updated_at: new Date().toISOString(),
      }

      if (novoStatus === 'autorizada') {
        updateData.status = 'invoiced'
        updateData.nfe_key = focusData.chave_nfe || focusData.chave || focusData.chave_acesso || null
        const rawUrl = focusData.caminho_danfe || focusData.url_danfe || null
        updateData.nfe_url = rawUrl
          ? rawUrl.startsWith('http')
            ? rawUrl
            : `https://focusnfe.com.br${rawUrl}`
          : null
        updateData.nfe_issued_at = new Date().toISOString()
        console.log('[consultar-nfe] salvando:', { nfe_key: updateData.nfe_key, nfe_url: updateData.nfe_url })
      }

      await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order_id)
    }

    return new Response(
      JSON.stringify({
        status: novoStatus,
        chave_nfe: focusData.chave_nfe || null,
        danfe_url: focusData.caminho_danfe || null,
        xml_url: focusData.caminho_xml_nota_fiscal || null,
        numero: focusData.numero || null,
        serie: focusData.serie || null,
        mensagem: focusData.mensagem_sefaz || null,
        focus_raw: focusData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Erro na Edge Function consultar-nfe:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
