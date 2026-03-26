import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const FALLBACK_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

export type NFeStatus = 'idle' | 'processando' | 'autorizada' | 'cancelada' | 'erro'

interface NFeErro {
  codigo?: string
  mensagem: string
  campo?: string
}

interface NFeResult {
  status: NFeStatus
  chave_nfe?: string
  danfe_url?: string
  xml_url?: string
  numero?: string
  mensagem?: string
  erros?: NFeErro[]
}

export function useNFe() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NFeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emitir = useCallback(async (order_id: string, company_id?: string): Promise<NFeResult | null> => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnError } = await supabase.functions.invoke('emitir-nfe', {
        body: { order_id, company_id: company_id || FALLBACK_COMPANY_ID },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (fnError) {
        console.error('[useNFe] Edge Function error:', fnError, '| response body:', data)
        // data contém o corpo da resposta mesmo em erros não-2xx
        const msg = data?.error || data?.message || fnError.message
        throw new Error(msg)
      }

      if (!data.success) {
        const msg = data.error || data.message || 'Erro ao emitir NF-e'
        const erros: NFeErro[] = data.erros || []
        setError(msg)
        setResult({ status: 'erro', mensagem: msg, erros })
        return null
      }

      // Se foi aceito para processamento, fazer polling por até 30s
      if (data.status === 'processando') {
        const ref = data.ref
        const resultado = await pollStatus(order_id, ref, company_id || FALLBACK_COMPANY_ID, session?.access_token)
        setResult(resultado)
        return resultado
      }

      const res: NFeResult = { status: data.status }
      setResult(res)
      return res

    } catch (err: any) {
      console.error('[useNFe] emitir exception:', err)
      const msg = err.message || 'Erro inesperado'
      setError(msg)
      setResult({ status: 'erro', mensagem: msg })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const consultar = useCallback(async (order_id: string, ref: string, company_id?: string): Promise<NFeResult | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnError } = await supabase.functions.invoke('consultar-nfe', {
        body: { order_id, company_id: company_id || FALLBACK_COMPANY_ID, ref },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })

      if (fnError) {
        console.error('[useNFe] consultar error:', fnError.message, '| data:', data)
        throw new Error(fnError.message)
      }

      return {
        status: data.status,
        chave_nfe: data.chave_nfe,
        danfe_url: data.danfe_url,
        xml_url: data.xml_url,
        numero: data.numero,
        mensagem: data.mensagem,
      }
    } catch (err) {
      console.error('[useNFe] consultar exception:', err)
      return null
    }
  }, [])

  return { emitir, consultar, loading, result, error }
}

// Polling interno — wall-clock de 60s, cada requisição tem timeout de 10s
const POLL_TIMEOUT_MS    = 60_000
const REQUEST_TIMEOUT_MS = 10_000
const POLL_INTERVAL_MS   = 5_000

function invokeWithTimeout(fnName: string, body: object, token?: string) {
  const invoke  = supabase.functions.invoke(fnName, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('request timeout')), REQUEST_TIMEOUT_MS)
  )
  return Promise.race([invoke, timeout])
}

async function pollStatus(order_id: string, ref: string, company_id: string, token?: string): Promise<NFeResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

    if (Date.now() >= deadline) break

    try {
      const { data } = await invokeWithTimeout('consultar-nfe', {
        order_id, company_id, ref,
      }, token)

      if (data?.status === 'autorizada') {
        return {
          status: 'autorizada',
          chave_nfe: data.chave_nfe,
          danfe_url: data.danfe_url,
          xml_url:   data.xml_url,
          numero:    data.numero,
          mensagem:  'NF-e autorizada com sucesso',
        }
      }

      if (data?.status === 'erro' || data?.status === 'cancelada') {
        return {
          status:   data.status,
          mensagem: data.mensagem || 'Erro na autorização',
        }
      }
    } catch {
      // continua tentando até deadline
    }
  }

  return {
    status:   'processando',
    mensagem: 'A NF-e está sendo processada pela SEFAZ. Verifique o status em alguns minutos.',
  }
}
