import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, Building2, Users, Target, Save, Upload, Trash2,
  ImageIcon, UserPlus, KeyRound, Shield, Check,
  AlertTriangle, Eye, EyeOff, Copy,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppConfig, upsertAppConfig, useSellersParaConfig, useMonthlyGoals } from '../hooks/useConfiguracoesData'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Progress } from '../components/ui/progress'

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CID = '00000000-0000-0000-0000-000000000001'
const SUPABASE_URL = 'https://hxrbytqmqvuyhsfoirao.supabase.co'

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner:     { label: 'Dono',        color: 'bg-[#EEF2FF] text-[#3B5BDB]' },
  admin:     { label: 'Admin',       color: 'bg-purple-50 text-purple-700' },
  manager:   { label: 'Gestor',      color: 'bg-amber-50 text-amber-700' },
  seller:    { label: 'Vendedor',    color: 'bg-emerald-50 text-emerald-700' },
  logistics: { label: 'Logística',   color: 'bg-slate-100 text-slate-600' },
}

const DEPT_LABELS: Record<string, string> = {
  admin: 'Financeiro', financeiro_gestora: 'Financeiro', logistics: 'Logística', entregas: 'Entregas',
}

const INPUT = 'w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#111827] placeholder-[#9CA3AF] outline-none focus:border-[#3B5BDB] focus:ring-2 focus:ring-[#3B5BDB]/20 transition bg-white'
const BTN_PRIMARY = 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#3B5BDB] text-white rounded-lg hover:bg-[#3451C7] disabled:opacity-50 transition-colors'
const BTN_OUTLINE = 'flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors'

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════════════════ */

function useToast() {
  const [t, setT] = useState<{ ok: boolean; msg: string } | null>(null)
  const show = useCallback((ok: boolean, msg: string) => { setT({ ok, msg }); setTimeout(() => setT(null), 3500) }, [])
  return { toast: t, notify: show }
}

function Toast({ toast }: { toast: { ok: boolean; msg: string } | null }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
      toast.ok ? 'bg-[#111827] text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
      {toast.msg}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ConfiguracoesPage() {
  const { role } = useAuth()
  const nav = useNavigate()
  const { toast, notify } = useToast()

  useEffect(() => { if (role && role !== 'owner') nav('/') }, [role, nav])

  if (!role || role !== 'owner') return null

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[960px] mx-auto px-6 py-5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-[#9CA3AF]" strokeWidth={1.75} />
            <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Configurações</h1>
          </div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-6 py-6">
        <Tabs defaultValue="geral">
          <TabsList className="bg-[#F3F4F6] p-0.5 rounded-lg mb-6">
            <TabsTrigger value="geral" className="text-xs gap-1.5"><Building2 size={13} /> Geral</TabsTrigger>
            <TabsTrigger value="usuarios" className="text-xs gap-1.5"><Users size={13} /> Usuários</TabsTrigger>
            <TabsTrigger value="metas" className="text-xs gap-1.5"><Target size={13} /> Metas</TabsTrigger>
          </TabsList>

          <TabsContent value="geral"><AbaGeral notify={notify} /></TabsContent>
          <TabsContent value="usuarios"><AbaUsuarios notify={notify} /></TabsContent>
          <TabsContent value="metas"><AbaMetas notify={notify} /></TabsContent>
        </Tabs>
      </div>

      <Toast toast={toast} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABA GERAL
   ═══════════════════════════════════════════════════════════════════════════ */

function AbaGeral({ notify }: { notify: (ok: boolean, msg: string) => void }) {
  const { data: cfg, loading } = useAppConfig()
  const [form, setForm] = useState({ empresa_nome: '', empresa_cnpj: '', empresa_telefone: '', empresa_endereco: '' })
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!cfg) return
    setForm({
      empresa_nome:     cfg.empresa_nome     ?? '',
      empresa_cnpj:     cfg.empresa_cnpj     ?? '',
      empresa_telefone: cfg.empresa_telefone ?? '',
      empresa_endereco: cfg.empresa_endereco ?? '',
    })
    setLogoUrl(cfg.logo_url ?? '')
  }, [cfg])

  async function handleSave() {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        const { error } = await upsertAppConfig(key, value)
        if (error) { notify(false, error.message); return }
      }
      notify(true, 'Informações salvas')
    } finally { setSaving(false) }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${CID}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) { notify(false, upErr.message); return }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData.publicUrl
      await upsertAppConfig('logo_url', url)
      setLogoUrl(url)
      notify(true, 'Logo atualizada')
    } finally { setUploading(false) }
  }

  async function handleRemoveLogo() {
    await upsertAppConfig('logo_url', '')
    setLogoUrl('')
    notify(true, 'Logo removida')
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-6">
      {/* Informações da empresa */}
      <Card title="Informações da Empresa" icon={Building2}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome da Empresa" value={form.empresa_nome} onChange={v => setForm(p => ({ ...p, empresa_nome: v }))} />
          <Field label="CNPJ" value={form.empresa_cnpj} onChange={v => setForm(p => ({ ...p, empresa_cnpj: v }))} placeholder="00.000.000/0001-00" />
          <Field label="Telefone" value={form.empresa_telefone} onChange={v => setForm(p => ({ ...p, empresa_telefone: v }))} placeholder="(00) 0000-0000" />
          <Field label="Endereço" value={form.empresa_endereco} onChange={v => setForm(p => ({ ...p, empresa_endereco: v }))} placeholder="Rua, número, cidade - UF" />
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={handleSave} disabled={saving} className={BTN_PRIMARY}>
            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Card>

      {/* Logo */}
      <Card title="Logo da Empresa" icon={ImageIcon}>
        <div className="flex items-start gap-6">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-24 h-24 rounded-xl object-contain border border-[#E5E7EB] bg-white" />
          ) : (
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-[#D1D5DB] flex flex-col items-center justify-center text-[#9CA3AF]">
              <ImageIcon size={20} />
              <span className="text-[10px] mt-1">Sem logo</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className={`${BTN_OUTLINE} cursor-pointer`}>
              <Upload size={14} /> {uploading ? 'Enviando...' : 'Enviar logo'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </label>
            {logoUrl && (
              <button onClick={handleRemoveLogo} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={14} /> Remover
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABA USUÁRIOS
   ═══════════════════════════════════════════════════════════════════════════ */

function AbaUsuarios({ notify }: { notify: (ok: boolean, msg: string) => void }) {
  const { data: sellers, loading, refetch } = useSellersParaConfig()
  const [showInactive, setShowInactive] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; authId: string | null } | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  const list = (sellers ?? []).filter(s => showInactive || s.active)

  async function handleInvite(data: { name: string; email: string; role: string; department: string; password: string }) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, company_id: CID }),
    })
    const json = await res.json()
    if (json.error) { notify(false, json.error); return null }
    notify(true, `Usuário ${data.name} criado`)
    refetch()
    return json.temp_password as string
  }

  async function handleResetPassword() {
    if (!resetTarget?.authId) { notify(false, 'Usuário sem auth_user_id'); return }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_user_id: resetTarget.authId }),
    })
    const json = await res.json()
    if (json.error) { notify(false, json.error); return }
    setNewPassword(json.temp_password)
    notify(true, `Senha de ${resetTarget.name} resetada`)
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from('sellers').update({ active: !current, status: !current ? 'ATIVO' : 'INATIVO' }).eq('id', id)
    if (error) notify(false, error.message)
    else { notify(true, !current ? 'Usuário reativado' : 'Usuário inativado'); refetch() }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-[#6B7280] cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(p => !p)}
            className="rounded border-[#D1D5DB] text-[#3B5BDB] focus:ring-[#3B5BDB]/20" />
          Exibir inativos
        </label>
        <button onClick={() => setInviteOpen(true)} className={BTN_PRIMARY}>
          <UserPlus size={14} /> Novo Usuário
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
        {list.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#9CA3AF]">Nenhum usuário</p>
        ) : list.map(s => {
          const initials = s.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
          const roleCfg = ROLE_LABELS[s.role] ?? { label: s.role, color: 'bg-[#F3F4F6] text-[#6B7280]' }
          const dept = s.department ? DEPT_LABELS[s.department] ?? s.department : null

          return (
            <div key={s.id} className="px-5 py-4 flex items-center gap-4">
              {/* Avatar */}
              {s.avatar_url ? (
                <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#EEF2FF] flex items-center justify-center text-xs font-semibold text-[#3B5BDB]">
                  {initials}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#111827] truncate">{s.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${roleCfg.color}`}>{roleCfg.label}</span>
                  {dept && <span className="text-[10px] text-[#9CA3AF] border border-[#E5E7EB] px-1.5 py-0.5 rounded">{dept}</span>}
                </div>
                <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">{s.email}</p>
              </div>

              {/* Status */}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                s.active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F3F4F6] text-[#9CA3AF]'
              }`}>
                {s.active ? 'Ativo' : 'Inativo'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button onClick={() => setResetTarget({ id: s.id, name: s.name, authId: s.auth_user_id })}
                  title="Resetar senha" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#3B5BDB] hover:bg-[#EEF2FF] transition-colors">
                  <KeyRound size={14} />
                </button>
                <button onClick={() => toggleActive(s.id, s.active)}
                  title={s.active ? 'Inativar' : 'Reativar'}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    s.active ? 'text-[#9CA3AF] hover:text-red-500 hover:bg-red-50' : 'text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50'
                  }`}>
                  <Shield size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite Modal */}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvite={handleInvite} />}

      {/* Reset Password Modal */}
      {resetTarget && (
        <Dialog open onOpenChange={() => { setResetTarget(null); setNewPassword(null) }}>
          <DialogContent className="max-w-sm p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-[#F3F4F6]">
              <DialogTitle className="text-sm font-semibold">Resetar Senha</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5">
              {newPassword ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">Nova senha de <span className="font-semibold text-[#111827]">{resetTarget.name}</span>:</p>
                  <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
                    <code className="text-sm font-mono text-[#111827] flex-1">{newPassword}</code>
                    <button onClick={() => { navigator.clipboard.writeText(newPassword); notify(true, 'Copiada') }}
                      className="p-1 text-[#9CA3AF] hover:text-[#3B5BDB] transition-colors"><Copy size={14} /></button>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">Salve esta senha — ela não será exibida novamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[#6B7280]">Resetar senha de <span className="font-semibold text-[#111827]">{resetTarget.name}</span>?</p>
                  <p className="text-xs text-[#9CA3AF]">Uma nova senha temporária será gerada.</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button onClick={() => { setResetTarget(null); setNewPassword(null) }} className={BTN_OUTLINE}>
                {newPassword ? 'Fechar' : 'Cancelar'}
              </button>
              {!newPassword && (
                <button onClick={handleResetPassword} className={BTN_PRIMARY}>
                  <KeyRound size={14} /> Resetar
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ── Invite Modal ──────────────────────────────────────────────────────────── */

function InviteModal({ onClose, onInvite }: {
  onClose: () => void
  onInvite: (d: { name: string; email: string; role: string; department: string; password: string }) => Promise<string | null>
}) {
  const [form, setForm] = useState({ name: '', email: '', role: 'seller', department: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [tempPw, setTempPw] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit() {
    if (!form.name || !form.email) return
    setSaving(true)
    const pw = await onInvite(form)
    setSaving(false)
    if (pw) setTempPw(pw)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[#F3F4F6]">
          <DialogTitle className="text-sm font-semibold">Novo Usuário</DialogTitle>
        </DialogHeader>

        {tempPw ? (
          <>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-[#6B7280]">Usuário <span className="font-semibold text-[#111827]">{form.name}</span> criado.</p>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Senha temporária</label>
                <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
                  <code className="text-sm font-mono text-[#111827] flex-1">{tempPw}</code>
                  <button onClick={() => navigator.clipboard.writeText(tempPw)}
                    className="p-1 text-[#9CA3AF] hover:text-[#3B5BDB] transition-colors"><Copy size={14} /></button>
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">Compartilhe esta senha com o usuário. Ela não será exibida novamente.</p>
            </div>
            <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end">
              <button onClick={onClose} className={BTN_PRIMARY}>Concluir</button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <Field label="Nome *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Nome completo" />
              <Field label="Email *" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="email@empresa.com" />

              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Perfil</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className={INPUT}>
                  <option value="seller">Vendedor</option>
                  <option value="admin">Admin / Financeiro</option>
                  <option value="logistics">Logística</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Departamento</label>
                <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                  className={INPUT}>
                  <option value="">Nenhum</option>
                  <option value="admin">Financeiro</option>
                  <option value="logistics">Logística</option>
                  <option value="entregas">Entregas</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1">Senha (opcional — gerada automaticamente se vazio)</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Senha temporária" className={INPUT} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button onClick={onClose} className={BTN_OUTLINE}>Cancelar</button>
              <button onClick={handleSubmit} disabled={saving || !form.name || !form.email} className={BTN_PRIMARY}>
                <UserPlus size={14} /> {saving ? 'Criando...' : 'Criar Usuário'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABA METAS
   ═══════════════════════════════════════════════════════════════════════════ */

function AbaMetas({ notify }: { notify: (ok: boolean, msg: string) => void }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const { data: goals, loading, refetch } = useMonthlyGoals(month, year)
  const { data: sellers } = useSellersParaConfig()
  const activeSellers = (sellers ?? []).filter(s => s.active && (s.is_sales_active || s.role === 'seller'))

  const [editGoal, setEditGoal] = useState<{ seller_id: string; seller_name: string; sales_target: string; calls_target: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  function getGoal(sellerId: string) {
    return (goals ?? []).find(g => g.seller_id === sellerId)
  }

  async function handleSaveGoal() {
    if (!editGoal) return
    setSaving(true)
    try {
      const { error } = await supabase.from('monthly_goals').upsert({
        company_id: CID,
        seller_id: editGoal.seller_id,
        month,
        year,
        sales_target: parseFloat(editGoal.sales_target) || 0,
        calls_target: parseInt(editGoal.calls_target) || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,seller_id,month,year' })
      if (error) { notify(false, error.message); return }
      notify(true, `Meta de ${editGoal.seller_name} salva`)
      setEditGoal(null)
      refetch()
    } finally { setSaving(false) }
  }

  async function handleReplicate() {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    let count = 0
    for (const g of goals ?? []) {
      const { error } = await supabase.from('monthly_goals').upsert({
        company_id: CID, seller_id: g.seller_id, month: nextMonth, year: nextYear,
        sales_target: g.sales_target, calls_target: g.calls_target,
        call_attempts_target: g.call_attempts_target,
        whatsapp_response_target: g.whatsapp_response_target,
        whatsapp_no_response_target: g.whatsapp_no_response_target,
        scope: g.scope, updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,seller_id,month,year' })
      if (!error) count++
    }
    notify(true, `${count} metas replicadas para ${MONTHS[nextMonth - 1]}/${nextYear}`)
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="space-y-4">
      {/* Period picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-[#3B5BDB]">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white outline-none focus:border-[#3B5BDB]">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={handleReplicate} disabled={!goals || goals.length === 0} className={BTN_OUTLINE}>
          Replicar para próximo mês
        </button>
      </div>

      {/* Sellers goals */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className="text-left px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Vendedor</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Meta Vendas (R$)</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Ligações/mês</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">Realizado</th>
              <th className="px-5 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {activeSellers.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-16 text-center text-[#9CA3AF]">Nenhum vendedor ativo</td></tr>
            ) : activeSellers.map(s => {
              const g = getGoal(s.id)
              const pct = g && g.sales_target > 0 ? Math.min(100, (g.sales_achieved / g.sales_target) * 100) : 0
              return (
                <tr key={s.id} className="hover:bg-[#FAFAF9] transition-colors">
                  <td className="px-5 py-3 font-medium text-[#111827]">{s.name}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{g ? `R$ ${g.sales_target.toLocaleString('pt-BR')}` : '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{g?.calls_target ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Progress value={pct} className="w-20 h-1.5 [&>div]:bg-[#3B5BDB]" />
                      <span className="text-xs text-[#6B7280] tabular-nums w-9 text-right">{Math.round(pct)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setEditGoal({
                      seller_id: s.id, seller_name: s.name,
                      sales_target: String(g?.sales_target ?? ''),
                      calls_target: String(g?.calls_target ?? ''),
                    })} className="text-[#9CA3AF] hover:text-[#3B5BDB] transition-colors">
                      <Settings size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Goal Modal */}
      {editGoal && (
        <Dialog open onOpenChange={() => setEditGoal(null)}>
          <DialogContent className="max-w-sm p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-3 border-b border-[#F3F4F6]">
              <DialogTitle className="text-sm font-semibold">Meta — {editGoal.seller_name}</DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 space-y-4">
              <Field label="Meta de Vendas (R$)" value={editGoal.sales_target}
                onChange={v => setEditGoal(p => p ? { ...p, sales_target: v } : null)} placeholder="35000" />
              <Field label="Meta de Ligações/mês" value={editGoal.calls_target}
                onChange={v => setEditGoal(p => p ? { ...p, calls_target: v } : null)} placeholder="210" />
            </div>
            <div className="px-6 py-4 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button onClick={() => setEditGoal(null)} className={BTN_OUTLINE}>Cancelar</button>
              <button onClick={handleSaveGoal} disabled={saving} className={BTN_PRIMARY}>
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <div className="flex items-center gap-1.5 mb-4">
        <Icon size={14} className="text-[#9CA3AF]" />
        <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT} />
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-24 flex flex-col items-center gap-3">
      <div className="w-5 h-5 border-2 border-[#3B5BDB] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-[#9CA3AF]">Carregando...</span>
    </div>
  )
}
