import { useState } from 'react'
import { FileText, X, CheckCircle, AlertCircle, Loader2, Download, ExternalLink } from 'lucide-react'
import { useNFe } from '../hooks/useNFe'
import { supabase } from '../lib/supabase'

interface Props {
  order: {
    id: string
    total: number
    company_id: string
    nfe_status?: string | null
    nfe_ref?: string | null
    nfe_key?: string | null
    nfe_url?: string | null
  }
  clientName: string
  onSuccess?: () => void
}

export function EmitirNFeButton({ order, clientName, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [checking,     setChecking]     = useState(false)
  const [checkMsg,     setCheckMsg]     = useState<string | null>(null)
  const { emitir, consultar, loading, result, error } = useNFe()

  const jaEmitida  = order.nfe_status === 'autorizada'
  const processando = order.nfe_status === 'processando'

  const nfeRef = order.nfe_ref || ('hh-' + order.id.replace(/-/g, '').substring(0, 20))

  async function handleEmitir() {
    const res = await emitir(order.id, order.company_id)
    if (res?.status === 'autorizada' && onSuccess) {
      onSuccess()
    }
  }

  async function handleVerificar() {
    setChecking(true)
    setCheckMsg(null)
    try {
      const res = await consultar(order.id, nfeRef, order.company_id)
      if (!res) { setCheckMsg('Não foi possível obter o status.'); return }
      if (res.status === 'autorizada') {
        if (onSuccess) onSuccess()
      } else if (res.status === 'erro' || res.status === 'cancelada') {
        setCheckMsg(res.mensagem || 'Erro na autorização da NF-e.')
      } else {
        setCheckMsg('Ainda em processamento. Tente novamente em instantes.')
      }
    } finally {
      setChecking(false)
    }
  }

  async function handleDownloadDanfe() {
    try {
      const { data: config } = await supabase
        .from('fiscal_config')
        .select('focusnfe_token_producao, focusnfe_token_homologacao, ambiente')
        .eq('company_id', order.company_id)
        .single()

      const token = config?.ambiente === 'producao'
        ? config.focusnfe_token_producao
        : config?.focusnfe_token_homologacao

      const baseUrl = config?.ambiente === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br'

      const url = order.nfe_url?.startsWith('http')
        ? order.nfe_url.replace('https://focusnfe.com.br', baseUrl).replace('https://api.focusnfe.com.br', baseUrl)
        : `${baseUrl}${order.nfe_url}`

      const { data, error } = await supabase.functions.invoke('download-danfe', {
        body: { url, token },
      })
      if (error || !data?.pdf) throw new Error('Sem PDF')

      const blob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `danfe-${order.id.substring(0, 8)}.pdf`
      link.click()
    } catch (err) {
      console.error('[DANFE]', err)
      alert('Não foi possível baixar o DANFE. Tente novamente.')
    }
  }

  // Botão principal — estado varia conforme nfe_status do pedido
  if (jaEmitida) {
    const danfeUrl = order.nfe_url || (order.nfe_key ? `https://focusnfe.com.br/danfe/${order.nfe_key}` : null)
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
          <CheckCircle size={12} />
          NF-e Emitida
        </span>
        {danfeUrl && (
          <button
            onClick={handleDownloadDanfe}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Download DANFE <Download size={11} />
          </button>
        )}
      </div>
    )
  }

  if (processando) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            <Loader2 size={12} className="animate-spin" />
            Processando...
          </span>
          <button
            onClick={handleVerificar}
            disabled={checking}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#3B5BDB] border border-[#C7D2FE] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2 py-1 rounded-md transition-colors disabled:opacity-50"
          >
            {checking ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            {checking ? 'Verificando…' : 'Verificar Status'}
          </button>
        </div>
        {checkMsg && (
          <p className="text-[11px] text-[#6B7280] max-w-48 leading-tight">{checkMsg}</p>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md transition-colors"
      >
        <FileText size={14} />
        Emitir NF-e
      </button>

      {open && (
        <Modal
          order={order}
          clientName={clientName}
          loading={loading}
          result={result}
          error={error}
          onEmitir={handleEmitir}
          onClose={() => {
            setOpen(false)
            if (result?.status === 'autorizada' && onSuccess) onSuccess()
          }}
        />
      )}
    </>
  )
}

// Modal interno
function Modal({
  order,
  clientName,
  loading,
  result,
  error,
  onEmitir,
  onClose,
}: {
  order: Props['order']
  clientName: string
  loading: boolean
  result: any
  error: string | null
  onEmitir: () => void
  onClose: () => void
}) {
  const statusFinal = result?.status === 'autorizada' || result?.status === 'erro' || result?.status === 'cancelada'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-xl shadow-lg border border-neutral-200 w-full max-w-md mx-4">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-indigo-600" />
            <span className="font-semibold text-neutral-900 text-sm">Emissão de NF-e</span>
          </div>
          {!loading && (
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Resumo — estado inicial */}
          {!result && !loading && (
            <>
              <div className="bg-neutral-50 rounded-lg border border-neutral-100 p-4 space-y-2.5">
                <Row label="Cliente" value={clientName} />
                <Row label="Pedido" value={`#${order.id.substring(0, 8).toUpperCase()}`} />
                <Row
                  label="Valor total"
                  value={Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  highlight
                />
                <Row label="Ambiente" value="Homologação" badge="amber" />
              </div>

              <p className="text-xs text-neutral-500 leading-relaxed">
                A NF-e será enviada para a SEFAZ/GO. Após autorização, a chave de acesso e o DANFE ficarão disponíveis no pedido.
              </p>
            </>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm text-neutral-600 font-medium">Enviando para a SEFAZ...</p>
              <p className="text-xs text-neutral-400">Isso pode levar alguns segundos</p>
            </div>
          )}

          {/* Sucesso */}
          {result?.status === 'autorizada' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <CheckCircle size={20} />
                <span className="font-semibold text-sm">NF-e Autorizada</span>
              </div>
              <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-4 space-y-2">
                {result.numero && <Row label="Número" value={result.numero} />}
                {result.chave_nfe && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Chave de acesso</p>
                    <p className="text-xs font-mono text-neutral-700 break-all">{result.chave_nfe}</p>
                  </div>
                )}
              </div>
              {result.danfe_url && (
                <a
                  href={result.danfe_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Baixar DANFE <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {/* Processando (timeout) */}
          {result?.status === 'processando' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-amber-700">
                <Loader2 size={16} className="animate-spin" />
                <span className="font-medium text-sm">Ainda processando</span>
              </div>
              <p className="text-xs text-neutral-500">{result.mensagem}</p>
            </div>
          )}

          {/* Erro */}
          {(result?.status === 'erro' || error) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span className="font-medium text-sm">Erro na emissão</span>
              </div>
              <p className="text-xs text-neutral-600">{result?.mensagem || error}</p>
              {result?.erros && result.erros.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {result.erros.map((e: { codigo?: string; mensagem: string; campo?: string }, i: number) => (
                    <div key={i} className="text-xs text-red-700">
                      {e.codigo && (
                        <span className="font-mono font-semibold mr-1.5">[{e.codigo}]</span>
                      )}
                      {e.mensagem}
                      {e.campo && (
                        <span className="text-red-400 ml-1.5">— campo: {e.campo}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-2">
          {!statusFinal && !loading && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onEmitir}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
              >
                Confirmar e Emitir
              </button>
            </>
          )}
          {(statusFinal || result?.status === 'processando') && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight, badge }: {
  label: string
  value: string
  highlight?: boolean
  badge?: 'amber' | 'indigo'
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-500">{label}</span>
      {badge ? (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          badge === 'amber'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        }`}>
          {value}
        </span>
      ) : (
        <span className={`text-xs font-medium ${highlight ? 'text-neutral-900' : 'text-neutral-700'}`}>
          {value}
        </span>
      )}
    </div>
  )
}
