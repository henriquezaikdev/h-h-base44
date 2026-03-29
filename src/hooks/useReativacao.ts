import { supabase } from '../lib/supabase'

/* ── XP Calculator ─────────────────────────────────────────────────────── */

export function calcularXP(valorPedido: number, diasInativo: number, streakAtual: number) {
  let xpBase = 0
  if (valorPedido < 500) xpBase = 50
  else if (valorPedido < 2000) xpBase = 150
  else xpBase = 300

  const bonusInativo = diasInativo > 180 ? 100 : 0

  let multiplicador = 1.0
  if (streakAtual >= 5) multiplicador = 2.0
  else if (streakAtual >= 3) multiplicador = 1.5

  return { xp: Math.round((xpBase + bonusInativo) * multiplicador), multiplicador }
}

/* ── Actions ───────────────────────────────────────────────────────────── */

interface IniciarParams {
  companyId: string
  sellerId: string
  clientId: string
  clientName: string
}

export async function iniciarReativacao({ companyId, sellerId, clientId, clientName }: IniciarParams) {
  // 1. Update client status
  const { error: e1 } = await supabase.from('clients').update({
    reativacao_iniciada: true,
    reativacao_status: 'em_reativacao',
    reativacao_iniciada_em: new Date().toISOString(),
  }).eq('id', clientId)
  if (e1) throw new Error(e1.message)

  // 2. Create task
  const due = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
  const { error: e2 } = await supabase.from('tasks').insert({
    company_id: companyId,
    title: `Reativar: ${clientName}`,
    status: 'open',
    status_crm: 'pendente',
    priority: 'high',
    priority_crm: 'alta',
    client_id: clientId,
    assigned_to_seller_id: sellerId,
    assigned_to: sellerId,
    created_by_seller_id: sellerId,
    due_date: due,
    task_date: due,
    task_category: 'reativacao',
    source_module: 'inativos',
  })
  if (e2) throw new Error(e2.message)
}

interface ConfirmarParams {
  companyId: string
  sellerId: string
  clientId: string
  valorPrimeiroPedido: number
  diasInativo: number
  streakDia: number
}

export async function confirmarReativacao({ companyId, sellerId, clientId, valorPrimeiroPedido, diasInativo, streakDia }: ConfirmarParams) {
  const { xp, multiplicador } = calcularXP(valorPrimeiroPedido, diasInativo, streakDia)

  // 1. Update client
  const { error: e1 } = await supabase.from('clients').update({
    status: 'active',
    reativacao_status: 'resgatado',
    reativacao_concluida: true,
    reativacao_concluida_em: new Date().toISOString(),
    reativado_em: new Date().toISOString(),
  }).eq('id', clientId)
  if (e1) throw new Error(e1.message)

  // 2. Register reativacao
  const { error: e2 } = await supabase.from('client_reativacoes').insert({
    company_id: companyId,
    client_id: clientId,
    seller_id: sellerId,
    valor_primeiro_pedido: valorPrimeiroPedido,
    dias_inativo: diasInativo,
    xp_gerado: xp,
    streak_dia: streakDia,
    multiplicador,
  })
  if (e2) throw new Error(e2.message)

  // 3. Complete task
  await supabase.from('tasks').update({
    status: 'done',
    status_crm: 'concluida',
  }).eq('client_id', clientId).eq('task_category', 'reativacao').eq('status', 'open')

  return { xp, multiplicador }
}

interface PerderParams {
  clientId: string
  motivo: string
}

export async function marcarPerdido({ clientId, motivo }: PerderParams) {
  const { error: e1 } = await supabase.from('clients').update({
    reativacao_status: 'perdido',
    reativacao_concluida: true,
    reativacao_concluida_em: new Date().toISOString(),
    reativacao_motivo_perda: motivo,
  }).eq('id', clientId)
  if (e1) throw new Error(e1.message)

  await supabase.from('tasks').update({
    status: 'cancelled',
  }).eq('client_id', clientId).eq('task_category', 'reativacao').eq('status', 'open')
}

interface ContatoParams {
  companyId: string
  sellerId: string
  clientId: string
  tipo: string
  resultado: string
  observacao: string
}

export async function registrarContato({ companyId, sellerId, clientId, tipo, resultado, observacao }: ContatoParams) {
  const { error } = await supabase.from('reativacao_contatos').insert({
    company_id: companyId,
    client_id: clientId,
    seller_id: sellerId,
    tipo,
    resultado,
    observacao: observacao || null,
  })
  if (error) throw new Error(error.message)
}
