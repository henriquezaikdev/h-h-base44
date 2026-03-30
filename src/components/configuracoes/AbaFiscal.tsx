import { useState, useEffect } from 'react'
import { FileText, Save, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CID = '00000000-0000-0000-0000-000000000001'
const INPUT = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'
const BTN_PRIMARY = 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors'

interface FiscalConfig {
  id?: string
  ambiente: string
  focusnfe_token_producao: string
  focusnfe_token_homologacao: string
  serie: string
  natureza_operacao: string
  numero_inicial: number
}

const EMPTY: FiscalConfig = {
  ambiente: 'producao',
  focusnfe_token_producao: '',
  focusnfe_token_homologacao: '',
  serie: '1',
  natureza_operacao: 'VENDA DE MERCADORIA',
  numero_inicial: 1,
}

export default function AbaFiscal({ notify }: { notify: (ok: boolean, msg: string) => void }) {
  const [form, setForm] = useState<FiscalConfig>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTokenProd, setShowTokenProd] = useState(false)
  const [showTokenHom, setShowTokenHom] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('fiscal_config')
        .select('id, ambiente, focusnfe_token_producao, focusnfe_token_homologacao, serie, natureza_operacao, numero_inicial')
        .eq('company_id', CID)
        .single()
      if (data) {
        setForm({
          id: data.id,
          ambiente: data.ambiente ?? 'producao',
          focusnfe_token_producao: data.focusnfe_token_producao ?? '',
          focusnfe_token_homologacao: data.focusnfe_token_homologacao ?? '',
          serie: data.serie ?? '1',
          natureza_operacao: data.natureza_operacao ?? 'VENDA DE MERCADORIA',
          numero_inicial: data.numero_inicial ?? 1,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        company_id: CID,
        ambiente: form.ambiente,
        focusnfe_token_producao: form.focusnfe_token_producao,
        focusnfe_token_homologacao: form.focusnfe_token_homologacao,
        serie: form.serie,
        natureza_operacao: form.natureza_operacao,
        numero_inicial: form.numero_inicial,
        updated_at: new Date().toISOString(),
      }

      if (form.id) {
        const { error } = await supabase
          .from('fiscal_config')
          .update(payload)
          .eq('id', form.id)
        if (error) { notify(false, error.message); return }
      } else {
        const { data, error } = await supabase
          .from('fiscal_config')
          .insert(payload)
          .select('id')
          .single()
        if (error) { notify(false, error.message); return }
        if (data) setForm(prev => ({ ...prev, id: data.id }))
      }
      notify(true, 'Configuração fiscal salva')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#9CA3AF]">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Ambiente */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <FileText size={14} className="text-[#9CA3AF]" />
          <h3 className="text-sm font-semibold text-[#111827]">Ambiente de Emissão</h3>
        </div>
        <div className="flex gap-3">
          {(['producao', 'homologacao'] as const).map(env => (
            <button
              key={env}
              onClick={() => setForm(p => ({ ...p, ambiente: env }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                form.ambiente === env
                  ? 'bg-[#EEF2FF] border-[#3B5BDB] text-[#3B5BDB]'
                  : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
              }`}
            >
              {env === 'producao' ? 'Produção' : 'Homologação'}
            </button>
          ))}
        </div>
        {form.ambiente === 'homologacao' && (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
            Ambiente de testes — NF-e emitidas aqui não têm valor fiscal.
          </p>
        )}
      </div>

      {/* Tokens Focus NFe */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <FileText size={14} className="text-[#9CA3AF]" />
          <h3 className="text-sm font-semibold text-[#111827]">Tokens Focus NFe</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Token Produção *</label>
            <div className="relative">
              <input
                type={showTokenProd ? 'text' : 'password'}
                value={form.focusnfe_token_producao}
                onChange={e => setForm(p => ({ ...p, focusnfe_token_producao: e.target.value }))}
                placeholder="Token de produção Focus NFe"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowTokenProd(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
              >
                {showTokenProd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Token Homologação</label>
            <div className="relative">
              <input
                type={showTokenHom ? 'text' : 'password'}
                value={form.focusnfe_token_homologacao}
                onChange={e => setForm(p => ({ ...p, focusnfe_token_homologacao: e.target.value }))}
                placeholder="Token de homologação Focus NFe"
                className={INPUT}
              />
              <button
                type="button"
                onClick={() => setShowTokenHom(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
              >
                {showTokenHom ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Parâmetros de Emissão */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-1.5 mb-4">
          <FileText size={14} className="text-[#9CA3AF]" />
          <h3 className="text-sm font-semibold text-[#111827]">Parâmetros de Emissão</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Série *</label>
            <input
              type="text"
              value={form.serie}
              onChange={e => setForm(p => ({ ...p, serie: e.target.value }))}
              placeholder="1"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Próximo Número NF-e</label>
            <input
              type="number"
              value={form.numero_inicial}
              onChange={e => setForm(p => ({ ...p, numero_inicial: parseInt(e.target.value) || 1 }))}
              placeholder="1"
              className={INPUT}
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-[#6B7280] mb-1">Natureza da Operação *</label>
            <input
              type="text"
              value={form.natureza_operacao}
              onChange={e => setForm(p => ({ ...p, natureza_operacao: e.target.value }))}
              placeholder="VENDA DE MERCADORIA"
              className={INPUT}
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Configuração Fiscal'}
        </button>
      </div>
    </div>
  )
}
