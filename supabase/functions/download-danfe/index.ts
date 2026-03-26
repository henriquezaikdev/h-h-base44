import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('[download-danfe] iniciou')

  try {
    const body = await req.json()
    console.log('[download-danfe] body:', JSON.stringify(body))

    const { url, token } = body

    if (!url || !token) {
      return new Response(JSON.stringify({ error: 'url e token obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(url, {
      headers: { 'Authorization': 'Basic ' + btoa(token + ':') },
    })

    console.log('[download-danfe] fetch status:', res.status)

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Focus retornou ${res.status}` }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const pdf = btoa(binary)

    console.log('[download-danfe] pdf base64 length:', pdf.length)

    return new Response(JSON.stringify({ pdf }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[download-danfe] erro:', err)
    return new Response(JSON.stringify({ error: 'Erro interno', detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
