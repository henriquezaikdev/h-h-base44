# H&H CONTROL 2.0 — PLANEJAMENTO GERAL
Gerado em: 27/03/2026
Prazo final MVP: 14/05/2026

---

## 1. MAPA DE STATUS DOS MÓDULOS

### CONCLUÍDOS E FUNCIONANDO

| Módulo | Arquivo principal | Observação |
|---|---|---|
| Login + Auth | LoginPage.tsx, AuthProvider.tsx | Roteamento por perfil funcionando |
| Sidebar por perfil | AppLayout.tsx | Itens diferentes por role/department |
| Clientes | ClientesPage.tsx, ClientePage.tsx | CNPJ BrasilAPI + CEP ViaCEP |
| Produtos | ProdutosPage.tsx | Com campo NCM |
| Compras | ComprasPage.tsx | Kanban + cotação + fornecedores |
| Estoque | EstoquePage.tsx | Posição + entradas XML + alertas |
| Financeiro | FinanceiroPage.tsx | Fluxo mensal + DRE + projeção |
| Dashboard | DashboardPage.tsx | Por perfil |
| Tarefas | TarefasPage.tsx | Schema dual (CRM + original) |
| NF-e | EmitirNFeButton.tsx + Edge Functions | Focus NFe produção ativa |
| Pedidos | PedidosPage.tsx + modal | Orçamentos + Pedidos, parcelamento |
| OwnerMeuDia | OwnerMeuDia.tsx | 5 abas: Vendas, Tarefas, Equipe, Perfil, Evolução |
| AdminMeuDia | AdminMeuDia.tsx | Anna — 3 abas: Tarefas, Compras, Financeiro |
| LogisticaMeuDia | LogisticaMeuDia.tsx | Adriana — 3 abas: Tarefas, Estoque, Entregas |
| EntregadorDashboard | EntregadorDashboard.tsx | Cláudio — mobile-first, 5 abas |
| VendedorMeuDia | VendedorMeuDia.tsx | 4 abas: Meu Dia, Tarefas, Perfil, Evolução |
| EvolutionEmbed | EvolutionEmbed.tsx + sub-tabs | Performance, Comissão & Nível, Campanhas (placeholder), Regras |

### EM ANDAMENTO / PARCIAL

| Módulo | Status | Bloqueio |
|---|---|---|
| EvolutionEmbed — Campanhas | Placeholder | Tabelas campaigns, campaign_participants não criadas |
| Contatos do vendedor | UI pronta (PerformanceTab) | interactions vazia — sem registro via sistema ainda |
| Comissão base | Cálculo pronto | margem_real preenchida em apenas 34% dos pedidos (2.482/7.272) |
| EntregadorDashboard — histórico | UI pronta | entregas_eo vazia — importação do Cláudio pendente |

### PENDENTES — FASE 1 (prazo 14/05/2026)

| Módulo | Prioridade | Depende de |
|---|---|---|
| Fila inteligente de prioridades | ALTA | priority_score em clients (coluna existe) |
| Radar da Carteira | ALTA | orders + clients (dados existem) |
| Assistente IA comercial (ficha do cliente) | ALTA | Edge Function assistente-cliente (criada) |
| Deploy Vercel + GitHub | ALTA | build limpo (já ok) |
| Mural social | MÉDIA | mural_posts (tabela existe no banco) |
| Kanban de clientes inativos | MÉDIA | clients (dados existem) |
| Bipagem QR Code | MÉDIA | pedidos aprovados (dados existem) |
| Entrada NF-e XML → contas a pagar | BAIXA | fin_payables (tabela existe) |

---

## 2. MAPA DE DEPENDÊNCIAS — EVOLUÇÃO DO VENDEDOR

```
seller_levels ──────────────────► metaMensal, metaLigacoes, metaWhatsapp, TBM
     │                            nível atual (ovo/pena/águia), bônus de nível
     └── monthly_sales_target ──► aceleracaoAtiva (vendas >= 130% da meta)

orders ──────────────────────────► currentMonthSales, currentMonthOrderCount
     │                             dailyActivities (gráfico)
     └── margem_real ─────────────► comissaoBase (por faixa de margem)
                                   ⚠️ apenas 34% dos pedidos têm margem_real preenchida

order_items + products ──────────► comissaoCategorias (bônus por categoria)
     └── product_categories ──────► matchCategory (TONERS, PAPELARIA, MERCADO, CARTUCHOS, INFORMATICA)

seller_errors ───────────────────► bonusBlocked (erros >= 4 → bônus = 0)

interactions ────────────────────► ligacoesMes, whatsappMes
     └── interaction_type ────────► ligacao (Ligação, phone_call, Ligação (Tentativa))
                                    whatsapp (WhatsApp, message, WhatsApp (Tentativa))
     ⚠️ tabela vazia — contatos reais dependem de registro via sistema

tasks ───────────────────────────► currentMonthTasksCompleted, currentMonthTasksOpen
     └── status_crm, task_date ──► dailyActivities (tarefas por dia)
```

### Campos calculados e suas fontes

| Campo | Fonte | Fallback |
|---|---|---|
| metaMensal | seller_levels.monthly_sales_target | 30.000 |
| comissaoBase | orders.margem_real × faixa | 0 (sem margem_real) |
| aceleracaoAtiva | currentMonthSales >= 1.3 × metaMensal | false |
| ligacoesMes | interactions WHERE type IN (ligacao...) | 0 |
| whatsappMes | interactions WHERE type IN (whatsapp...) | 0 |
| metaLigacoes | ovo: 18×dias_úteis / pena+águia: 210 | 18×dias_úteis |
| metaWhatsapp | ovo: 15×dias_úteis / pena+águia: 336 | 15×dias_úteis |
| tbm | (metaMensal - vendas) / dias_úteis_restantes | 0 |

---

## 3. SEQUÊNCIA DE CONSTRUÇÃO — FASES

### Regra geral: banco primeiro, tela depois.
Nunca construir componente que depende de tabela inexistente.

---

### FASE 1 — MVP Operacional (até 14/05/2026)

#### Etapa A — Infraestrutura (CONCLUÍDA)
- [x] 12 tabelas de gamificação criadas (seller_levels, seller_errors, seller_stars, interactions, etc.)
- [x] seller_levels populado para os 3 vendedores
- [x] work_month_config populado (mar/abr/mai 2026)
- [x] category_goals e category_achievements criadas com RLS

#### Etapa B — Cockpits (CONCLUÍDA)
- [x] OwnerMeuDia completo
- [x] AdminMeuDia completo
- [x] LogisticaMeuDia completo
- [x] EntregadorDashboard v2 completo
- [x] VendedorMeuDia completo
- [x] EvolutionEmbed com dados reais (Performance + Comissão & Nível)

#### Etapa C — Inteligência Comercial (EM ANDAMENTO)
- [ ] Fila inteligente de prioridades (priority_score calculado)
- [ ] Radar da Carteira (anéis: ativo/recompra/atraso/risco)
- [ ] Assistente IA na ficha do cliente (Edge Function já criada)

#### Etapa D — Operações (PENDENTE)
- [ ] Mural social (tabela mural_posts existe)
- [ ] Kanban de clientes inativos
- [ ] Bipagem QR Code na saída do pedido
- [ ] Entrada NF-e XML → contas a pagar automático

#### Etapa E — Deploy (PENDENTE)
- [ ] Configurar projeto Vercel
- [ ] Apontar domínio hhcontrol.com.br
- [ ] Variáveis de ambiente no Vercel
- [ ] Teste completo em produção com todos os perfis

---

### FASE 2 — Expansão (maio–julho 2026)
- IA Central (multi-modelo: Claude/GPT/Gemini por custo)
- RH (registro de funcionários, férias, ponto)
- Portal do cliente (histórico, status, NFs para download)
- Gamificação completa (XP, HCoins, níveis, loja)
- WhatsApp opt-in

### FASE 3 — SaaS (agosto 2026+)
- Onboarding automatizado para novos clientes
- Billing Stripe (planos, cobrança recorrente, trial)
- Primeiros clientes externos distribuidoras B2B

---

## 4. CRONOGRAMA SEMANAL ATÉ 14/05/2026

| Semana | Período | Foco | Entregáveis |
|---|---|---|---|
| S1 | 27/03 – 04/04 | Cockpits + EvolutionEmbed | VendedorMeuDia ✅, EvolutionEmbed real ✅, commit ✅ |
| S2 | 07/04 – 11/04 | Inteligência comercial A | Fila inteligente de prioridades (priority_score + PriorityQueueSection) |
| S3 | 14/04 – 18/04 | Inteligência comercial B | Radar da Carteira (4 anéis na ficha do cliente) |
| S4 | 21/04 – 25/04 | IA + Mural | Assistente IA na ficha do cliente, Mural social v1 |
| S5 | 28/04 – 02/05 | Operações | Kanban inativos, Bipagem QR Code |
| S6 | 05/05 – 09/05 | Fiscal + Deploy | Entrada NF-e XML, configurar Vercel |
| S7 | 12/05 – 14/05 | Testes + Go-live | Teste completo todos os perfis, go-live |

### Reserva de risco
- S2–S3 têm folga de 1 dia cada para imprevistos
- S7 é somente testes — nenhum módulo novo entra nesta semana
- Se atrasar S4, cortar Mural social (não é crítico para o MVP)

---

## 5. REGRAS DE EXECUÇÃO POR SESSÃO

### Abertura obrigatória
1. Ler CONTEXT/CORE.md (status atual + próximo passo)
2. Ler CONTEXT/BANCO.md (verificar tabelas antes de construir)
3. Ler CONTEXT/DECISOES.md (regras de negócio ativas)
4. Se envolver pessoas: ler CONTEXT/PESSOAS.md

### Durante a sessão
- Banco primeiro, tela depois — nunca construir sem tabela existir
- Um arquivo por vez — confirmar build limpo antes de passar para o próximo
- Zero framer-motion, zero tokens shadcn, zero emojis
- Não recriar hooks existentes (useSupabaseQuery, useEvolutionData, useTasksData, etc.)
- Multi-tenant obrigatório: company_id em todos os inserts
- Usar exatamente os nomes de colunas do BANCO.md — nunca assumir

### Encerramento obrigatório
1. Rodar `npm run build` — confirmar zero erros TypeScript
2. Commit das alterações com mensagem descritiva
3. Atualizar CONTEXT/CORE.md — seção STATUS ATUAL (data, último concluído, próximo passo)
4. Atualizar CONTEXT/BANCO.md se tabelas foram criadas/alteradas
5. Atualizar CONTEXT/DECISOES.md se regras de negócio foram definidas

### Padrão de commit
```
feat: descrição curta do que foi feito

- item 1
- item 2
- item 3

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## 6. QUERIES DE DIAGNÓSTICO RÁPIDO

Rodar no Supabase → SQL Editor para verificar estado do banco antes de construir.

### Verificar vendedores ativos e seus níveis
```sql
SELECT
  s.name,
  s.role,
  s.department,
  sl.current_level,
  sl.monthly_sales_target,
  sl.errors_this_month
FROM sellers s
LEFT JOIN seller_levels sl ON sl.seller_id = s.id
WHERE s.active = true
  AND s.company_id = '00000000-0000-0000-0000-000000000001'
ORDER BY s.name;
```

### Verificar cobertura de margem_real nos pedidos
```sql
SELECT
  COUNT(*) AS total_pedidos,
  COUNT(margem_real) AS com_margem,
  ROUND(COUNT(margem_real)::numeric / COUNT(*) * 100, 1) AS pct_cobertura,
  ROUND(AVG(margem_real) * 100, 2) AS margem_media_pct
FROM orders
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND status NOT IN ('cancelled', 'rejected');
```

### Verificar interações registradas por tipo
```sql
SELECT
  interaction_type,
  COUNT(*) AS total,
  COUNT(DISTINCT responsible_seller_id) AS vendedores
FROM interactions
WHERE company_id = '00000000-0000-0000-0000-000000000001'
GROUP BY interaction_type
ORDER BY total DESC;
```

### Verificar vendas do mês por vendedor
```sql
SELECT
  s.name,
  COUNT(o.id) AS pedidos,
  ROUND(SUM(o.total), 2) AS total_vendas,
  sl.monthly_sales_target AS meta,
  ROUND(SUM(o.total) / sl.monthly_sales_target * 100, 1) AS pct_meta
FROM orders o
JOIN sellers s ON s.id = o.seller_id
LEFT JOIN seller_levels sl ON sl.seller_id = o.seller_id
WHERE o.company_id = '00000000-0000-0000-0000-000000000001'
  AND o.created_at >= date_trunc('month', now())
  AND o.created_at <  date_trunc('month', now()) + interval '1 month'
  AND o.status NOT IN ('cancelled', 'rejected')
GROUP BY s.name, sl.monthly_sales_target
ORDER BY total_vendas DESC;
```

### Verificar tarefas atrasadas por vendedor
```sql
SELECT
  s.name,
  COUNT(*) AS tarefas_atrasadas
FROM tasks t
JOIN sellers s ON s.id = t.assigned_to_seller_id
WHERE t.company_id = '00000000-0000-0000-0000-000000000001'
  AND t.status_crm = 'pendente'
  AND t.is_deleted = false
  AND t.task_date < CURRENT_DATE
GROUP BY s.name
ORDER BY tarefas_atrasadas DESC;
```

### Verificar tabelas de gamificação existentes e populadas
```sql
SELECT
  t.table_name,
  (SELECT COUNT(*) FROM information_schema.tables it
   WHERE it.table_name = t.table_name
     AND it.table_schema = 'public') AS existe,
  CASE t.table_name
    WHEN 'seller_levels'         THEN (SELECT COUNT(*)::text FROM seller_levels)
    WHEN 'seller_errors'         THEN (SELECT COUNT(*)::text FROM seller_errors)
    WHEN 'seller_stars'          THEN (SELECT COUNT(*)::text FROM seller_stars)
    WHEN 'interactions'          THEN (SELECT COUNT(*)::text FROM interactions)
    WHEN 'work_month_config'     THEN (SELECT COUNT(*)::text FROM work_month_config)
    WHEN 'category_goals'        THEN (SELECT COUNT(*)::text FROM category_goals)
    WHEN 'category_achievements' THEN (SELECT COUNT(*)::text FROM category_achievements)
    WHEN 'xp_log'                THEN (SELECT COUNT(*)::text FROM xp_log)
    WHEN 'user_medals'           THEN (SELECT COUNT(*)::text FROM user_medals)
    ELSE '?'
  END AS registros
FROM (VALUES
  ('seller_levels'), ('seller_errors'), ('seller_stars'),
  ('interactions'), ('work_month_config'), ('category_goals'),
  ('category_achievements'), ('xp_log'), ('user_medals')
) AS t(table_name);
```

### Verificar entregas do mês por entregador (Cláudio)
```sql
SELECT
  status,
  COUNT(*) AS total
FROM entregas_eo
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND entregador ILIKE '%Cláudio%'
  AND data_baixa >= date_trunc('month', now())
GROUP BY status;
```

### Verificar priority_score dos clientes (para fila inteligente)
```sql
SELECT
  COUNT(*) AS total_clientes,
  COUNT(priority_score) AS com_score,
  COUNT(*) - COUNT(priority_score) AS sem_score,
  ROUND(AVG(priority_score), 2) AS score_medio,
  MAX(priority_score) AS score_maximo
FROM clients
WHERE company_id = '00000000-0000-0000-0000-000000000001'
  AND status != 'inativo';
```

---

## 7. ARQUITETURA DE ROTEAMENTO

```
/ (RootRedirect)
├── department = 'entregas'   → /entregador  (EntregadorDashboard — sem sidebar)
├── department = 'logistics'  → /logistica   (LogisticaMeuDia)
├── department = 'admin'      → /admin       (AdminMeuDia)
├── role = 'owner'            → /owner       (OwnerMeuDia)
└── role = 'seller'           → /vendedor    (VendedorMeuDia)
```

### Cockpits e suas abas

| Cockpit | Usuário | Abas |
|---|---|---|
| OwnerMeuDia | Henrique | Vendas, Tarefas, Equipe, Perfil, Evolução |
| AdminMeuDia | Anna | Tarefas, Compras, Financeiro |
| LogisticaMeuDia | Adriana | Tarefas, Estoque, Entregas |
| EntregadorDashboard | Cláudio | Entregas, Tarefas, Perfil, Abastecimentos, Manutenção |
| VendedorMeuDia | Joésio, Murilo, Nayara | Meu Dia, Tarefas, Perfil, Evolução |

---

## 8. HOOKS DISPONÍVEIS — REFERÊNCIA RÁPIDA

| Hook | Arquivo | Retorna |
|---|---|---|
| useAuth | hooks/useAuth.ts | seller, role, isLoading |
| useSupabaseQuery | hooks/useSupabaseQuery.ts | data, loading, refetch |
| useEvolutionData | hooks/useEvolutionData.ts | vendas, tarefas, comissão, TBM, contatos, nível |
| useTasksData | hooks/useTasksData.ts | tasks com JOIN clients |
| useSellersData | hooks/useSellersData.ts | sellers ativos |
| useProfileData | hooks/useProfileData.ts | seller + KPIs de tarefas |
| useWorkingDaysTargets | hooks/useWorkingDaysTargets.ts | métricas de vendas e tarefas do mês |
| useActionCenterData | hooks/useActionCenterData.ts | alertas (tarefas atrasadas, clientes sem pedido) |
| useDailyFocus | hooks/useDailyFocus.ts | foco diário (localStorage) |
| useTaskLimits | hooks/useTaskLimits.ts | limites de tarefas por departamento |
| useCriticalBlocker | hooks/useCriticalBlocker.ts | bloqueio de tarefas críticas |
