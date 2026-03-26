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

    const { ref, company_id } = await req.json()

    if (!ref) {
      return new Response(
        JSON.stringify({ error: 'ref é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cid = company_id || '00000000-0000-0000-0000-000000000001'
    const { data: config } = await supabase
      .from('fiscal_config')
      .select('ambiente, focusnfe_token_producao, focusnfe_token_homologacao')
      .eq('company_id', cid)
      .single()

    const token = config?.ambiente === 'producao'
      ? config.focusnfe_token_producao
      : config?.focusnfe_token_homologacao

    const baseUrl = config?.ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br'

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token Focus NFe não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Consultar NF-e no Focus para obter caminho_danfe
    const focusRes = await fetch(`${baseUrl}/v2/nfe/${ref}?completo=1`, {
      headers: { 'Authorization': `Basic ${btoa(token + ':')}` },
    })

    if (!focusRes.ok) {
      return new Response(
        JSON.stringify({ error: `Focus NFe retornou ${focusRes.status}` }),
        { status: focusRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const focusData = await focusRes.json()
    const caminho = focusData.caminho_danfe || focusData.url_danfe || null

    if (!caminho) {
      return new Response(
        JSON.stringify({ error: 'DANFE não disponível para esta NF-e' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Monta URL com credenciais embutidas para download direto pelo browser
    const host = baseUrl.replace('https://', '')
    const url = `https://${token}:@${host}${caminho}`

    return new Response(
      JSON.stringify({ url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Erro na Edge Function get-danfe-url:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
