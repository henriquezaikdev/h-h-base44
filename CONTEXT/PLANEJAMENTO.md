# H&H CONTROL 2.0 — PLANEJAMENTO COMPLETO REVISADO
Gerado em: 27/03/2026 | Prazo MVP: 14/05/2026

---

## REGRAS DE EXECUÇÃO (NÃO NEGOCIÁVEIS)

1. Banco primeiro, tela depois — nunca construir componente sem tabela existir
2. Um arquivo por vez — confirmar build limpo antes de passar para o próximo
3. Nunca recriar hooks existentes
4. Nunca quebrar módulos funcionando
5. Multi-tenant obrigatório: company_id em todos os inserts
6. Zero framer-motion, zero tokens shadcn, zero emojis na UI
7. Sempre ler CORE.md + BANCO.md no início de cada sessão

---

## STATUS ATUAL DOS MÓDULOS (27/03/2026)

### CONCLUÍDOS E FUNCIONANDO

| Módulo | Arquivo principal | Observação |
|---|---|---|
| Login + Auth + Sidebar | LoginPage.tsx, AuthProvider.tsx, AppLayout.tsx | Roteamento por perfil |
| Clientes | ClientesPage.tsx, ClientePage.tsx | CNPJ + CEP, ficha completa |
| Produtos | ProdutosPage.tsx | Com NCM |
| Compras | ComprasPage.tsx | Kanban + cotação + fornecedores |
| Estoque | EstoquePage.tsx | Posição + XML + alertas |
| Financeiro | FinanceiroPage.tsx | Fluxo + DRE + projeção |
| Tarefas | TarefasPage.tsx | Schema dual CRM |
| NF-e | EmitirNFeButton.tsx + Edge Functions | Focus NFe produção ativa |
| Pedidos | PedidosPage.tsx + modal | Orçamentos + Pedidos + parcelamento |
| OwnerMeuDia | OwnerMeuDia.tsx | 5 abas completas |
| AdminMeuDia | AdminMeuDia.tsx | Anna — 3 abas |
| LogisticaMeuDia | LogisticaMeuDia.tsx | Adriana — 3 abas |
| EntregadorDashboard | EntregadorDashboard.tsx | Cláudio — mobile-first |
| VendedorMeuDia | VendedorMeuDia.tsx | 4 abas + PriorityQueue + Radar + IA |
| EvolutionEmbed | EvolutionEmbed.tsx | Performance + Comissão + Regras |
| Mural Social | MuralPage.tsx + MuralWidget.tsx | Feed + Stories + Reações |
| Deploy | Vercel + GitHub | hh-control-2.vercel.app |
| Logins da equipe | Supabase Auth | 7 usuários vinculados |

---

## SEQUÊNCIA DE CONSTRUÇÃO — MVP ATÉ 14/05/2026

### PRÉ-REQUISITO: SQL no banco antes de qualquer tela nova

Antes de construir Settings, Gestor ou Relatórios, verificar/criar:
- Tabela `app_config` (key/value — necessária para Entregador Online sync e configurações gerais)
- Tabela `monthly_goals` (metas mensais por vendedor — Goals.tsx do Lovable usa essa tabela)
- Tabela `fin_sync_logs` com colunas corretas (entregador-online-sync usa essa tabela)
- Edge Functions: `invite-user` e `reset-user-password` (necessárias para Settings > Usuários)
- Edge Function: `entregador-online-sync` (necessária para sync de entregas)

---

### BLOCO 1 — IDENTIFICAÇÃO DE CLIENTES
**Prioridade: ALTA | Depende de: clients (existe)**

Objetivo: mostrar visualmente se um cliente é novo, inativo, reativado ou indicação.

**1.1 — Badge de identificação na listagem (ClientesPage.tsx)**
- Campo `origem` já existe em `clients` mas não é exibido na UI
- Lógica de classificação:
  - `novo`: criado nos últimos 30 dias (created_at)
  - `inativo`: status = inactive
  - `reativado`: status voltou de inactive para active (campo `reativado_em` pode não existir — verificar)
  - `indicação`: origem = 'indicacao' no campo clients.origem
- Badge colorido ao lado do nome na listagem
- Filtro na barra de busca por tipo de identificação

**1.2 — Exibição na ficha do cliente (ClientePage.tsx)**
- Badge de identificação no cabeçalho da ficha
- Seção "Origem" com campo editável (dropdown: Indicação, Prospecção, Google, Mailing, Outro)
- Campo `origem` salvo em clients.origem

**1.3 — Kanban de clientes inativos**
- Rota: /clientes/inativos
- Colunas: Sem contato (>60d) | Contatado | Proposta enviada | Reativado
- Cada card: nome do cliente, dias sem pedido, último vendedor responsável, botão "Registrar contato"
- Dados: clients WHERE status = 'inactive', ordenado por last_order_at ASC
- Ao reativar: atualiza clients.status = 'active'

---

### BLOCO 2 — CONFIGURAÇÕES
**Prioridade: ALTA | Depende de: Edge Functions invite-user + reset-user-password**
**Rota: /configuracoes | Visível: somente role = owner**

Referência: Settings.tsx do Lovable (lido na íntegra)

**2.1 — Aba Empresa**
- Logo da empresa: upload para Supabase Storage, salvar URL em `app_config` key = 'logo_url'
- Nome da empresa, CNPJ, telefone, endereço: salvar em `app_config`
- Exibir logo no sidebar (AppLayout.tsx) quando configurada

**2.2 — Aba Usuários**
- Listagem de todos os sellers ativos com: avatar, nome, email, perfil (badge), clientes vinculados, pedidos, status vinculado
- Toggle "Incluir inativos"
- Ações por usuário: Editar nome/perfil | Inativar (com motivo) | Reativar | Transferir carteira | Reset de senha | Deletar
- Botão "Novo Usuário": chama Edge Function `invite-user` com nome, email, role, senha opcional
- Após criar: exibe senha temporária em modal para copiar
- Perfis disponíveis: owner, seller, financeiro, logistica, entregas
- Edge Functions necessárias: `invite-user`, `reset-user-password` (deployar no Supabase do 2.0)

**2.3 — Aba Metas**
- Referência: Goals.tsx + SellerGoalsPanel do Lovable
- Tabela necessária: `monthly_goals` (criar se não existir)
- Sub-seção Metas Mensais:
  - Criar/editar/deletar meta por vendedor + mês + ano
  - Campos: meta de vendas (R$), meta de ligações, tentativas, whatsapp c/ resposta, whatsapp s/ resposta
  - Escopo: global (toda a loja) ou por vendedor
  - Botão "Replicar" avança meta para o próximo mês
  - Vendas realizadas calculadas automaticamente dos orders
- Sub-seção Metas Diárias:
  - Meta de contatos por dia por vendedor (campo único: contacts_target)
  - Tabela: `daily_goals` (já existe no banco)
- Sub-seção Metas por Categoria:
  - Editar `category_goals` por vendedor + categoria + competência
  - Tabela: `category_goals` (já existe no banco)
- Sub-seção Configuração de Nível:
  - Editar `seller_levels` por vendedor: monthly_sales_target, daily_calls_target, current_level
  - Tabela: `seller_levels` (já existe no banco)

**2.4 — Aba Fiscal**
- Exibir/editar configurações do Focus NFe: token produção, ambiente, série, natureza da operação, CFOP padrão
- Tabela: `fiscal_config` (já existe)
- Tokens nunca exibidos em texto claro — máscara tipo senha

**2.5 — Aba Equivalências de Produtos**
- Listagem de equivalências cadastradas (hh_produto_equivalencia — verificar se existe no banco)
- Criar nova equivalência: buscar produto A + produto B por nome/SKU
- Deletar equivalência

---

### BLOCO 3 — TELA DO GESTOR
**Prioridade: ALTA | Depende de: orders, sellers, tasks, clients, fin_payables**
**Rota: /gestor | Visível: somente role = owner**

Referência: Gestor.tsx do Lovable (lido na íntegra) — adaptar sem CEE, sem RH/Genyo, sem Conta Azul

**3.1 — Aba Visão Executiva**
- KPIs do mês: faturamento total, margem bruta, pedidos aprovados, ticket médio, clientes ativos
- Filtro de período (mês atual por padrão)
- Filtro por vendedor (todos ou individual)
- Tabela de comissões: nome do vendedor | faturamento | margem real | comissão calculada
- Widget de estoque crítico (produtos abaixo do mínimo)

**3.2 — Aba Comercial**
- Sub-aba Vendedores: card por vendedor com faturamento, pedidos, % da meta, margem média, botão "Analisar"
- Sub-aba Clientes: ranking de clientes por faturamento no período, filtro top20/100/todos
- Sub-aba Radar: CarteiraRadar em modo visão da equipe (todos os vendedores)
- Sub-aba Metas: visão consolidada das metas (leitura — edição fica em Configurações)
- Sub-aba Fila Comercial: clientes prioritários de toda a equipe ordenados por priority_score

**3.3 — Aba Financeiro**
- Dados lançados manualmente no módulo Financeiro (fin_payables, fin_receivables)
- Resumo: a pagar no mês, a receber no mês, saldo projetado
- DRE simplificado: receita bruta, CMV, margem bruta, despesas operacionais, resultado

**3.4 — Aba Relatório IA**
- Chat com IA que analisa os dados do período selecionado
- Edge Function: `gestor-ia-report` (existe no Lovable — deployar no 2.0)
- Envia contexto: KPIs do período, performance por vendedor, alertas críticos
- Retorna análise estruturada: pontos de atenção, oportunidades, recomendações

---

### BLOCO 4 — RELATÓRIOS
**Prioridade: ALTA | Depende de: orders, clients, sellers**
**Rota: /relatorios | Visível: owner + seller (com filtro por carteira)**

Referência: Relatorios.tsx do Lovable (lido na íntegra)

**4.1 — Aba Vendas & Clientes**
- KPIs: faturamento total, clientes ativos, total de pedidos, ticket médio, comparativo período anterior
- Filtro de período (mês/trimestre/semestre/ano/personalizado)
- Filtro por vendedor (owner vê todos, vendedor vê só sua carteira)
- Concentração de faturamento: top 20/100/200/todos com % do total
- Breakdown por tier: top 20 = X% | top 21-100 = Y% | demais = Z%
- Ranking de clientes: lista ordenada por faturamento no período

**4.2 — Aba Comissões**
- Tabela: vendedor | faturamento | margem real | comissão base | bônus categoria | total
- Filtro por mês/ano
- Exportação CSV

**4.3 — Aba Novos & Reativados**
- Clientes adquiridos no período (created_at dentro do período)
- Clientes reativados no período (voltaram a comprar após inatividade)
- KPIs: novos no mês, reativados no mês, taxa de retenção

**4.4 — Exportação**
- Botão "Exportar CSV" em cada aba
- Gerar arquivo com os dados filtrados da aba ativa

---

### BLOCO 5 — ENTREGADOR ONLINE (SYNC)
**Prioridade: MÉDIA | Depende de: entregas_eo (existe), app_config (criar), fin_sync_logs**

**5.1 — Pré-requisito SQL**
- Criar tabela `app_config` (key text UNIQUE, value text, updated_at timestamptz)
- Verificar se `fin_sync_logs` tem colunas: id, status, mode, started_at, finished_at, duration_ms, receber_synced, pagar_synced, error_message
- Verificar/adicionar colunas em `entregas_eo`: campo_livre1, campo_livre2, data_hora_em_rota, data_hora_ultimo_status, entregador_id

**5.2 — Deploy da Edge Function**
- Copiar `entregador-online-sync/index.ts` do Lovable para o projeto 2.0
- Token e clienteId já estão hardcoded na função (token: 0c2d25e5e97e051ab56c67dc864e3dd3bf883b7d, clienteId: 5066)
- Deploy via Claude Code: `supabase functions deploy entregador-online-sync`

**5.3 — UI na tela de Configurações (Aba Entregas)**
- Botão "Sincronizar agora" que chama a Edge Function manualmente
- Exibir: última sincronização (app_config key = entregador_online_last_sync), total de entregas, status do último sync
- Log de sincronizações (últimas 5 entradas de fin_sync_logs WHERE mode = 'entregador_online')

**5.4 — Cron automático**
- Configurar no Supabase: rodar `entregador-online-sync` a cada 2 horas
- Via Supabase → Database → Cron Jobs

---

### BLOCO 6 — OPERAÇÕES RESTANTES (ETAPA D)
**Prioridade: BAIXA para o prazo | Pode ir para Fase 2 se necessário**

**6.1 — Entrada NF-e XML → contas a pagar**
- Upload de XML de NF-e de fornecedor
- Parser extrai: fornecedor, CNPJ, número NF, data, itens, valor total
- Gera automaticamente lançamento em `fin_payables`
- Atualiza estoque via `stock_entries` + `stock_entry_items`
- Já existe entrada XML no módulo de Estoque — aproveitar o parser

---

## CRONOGRAMA REVISADO ATÉ 14/05/2026

| Semana | Período | Bloco | Entregáveis |
|---|---|---|---|
| S1 | 27/03–04/04 | Cockpits + Deploy | ✅ Concluído |
| S2 | 07/04–11/04 | Bloco 1 | Identificação clientes (badge + kanban inativos) |
| S3 | 14/04–18/04 | Bloco 2 (parte 1) | Configurações: SQL + Edge Functions + Aba Empresa + Usuários |
| S4 | 21/04–25/04 | Bloco 2 (parte 2) | Configurações: Metas + Fiscal + Equivalências |
| S5 | 28/04–02/05 | Bloco 3 | Tela do Gestor completa |
| S6 | 05/05–09/05 | Bloco 4 | Relatórios completos |
| S7 | 12/05–14/05 | Bloco 5 + Testes | Entregador Online sync + teste completo todos os perfis |

**Reserva:** Bloco 6 (XML → contas a pagar) entra na Fase 2 se S7 ficar apertado.

---

## DEPENDÊNCIAS DE BANCO — VERIFICAR ANTES DE CADA BLOCO

### Bloco 1 — Identificação de clientes
```sql
-- Verificar se campo reativado_em existe em clients
SELECT column_name FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'reativado_em';

-- Verificar valores de clients.origem
SELECT DISTINCT origem, COUNT(*) FROM clients
WHERE company_id = '00000000-0000-0000-0000-000000000001'
GROUP BY origem ORDER BY count DESC;
```

### Bloco 2 — Configurações
```sql
-- Verificar se monthly_goals existe
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'monthly_goals' AND table_schema = 'public';

-- Verificar se app_config existe
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'app_config' AND table_schema = 'public';

-- Verificar se hh_produto_equivalencia existe
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'hh_produto_equivalencia' AND table_schema = 'public';
```

### Bloco 5 — Entregador Online
```sql
-- Verificar colunas de entregas_eo
SELECT column_name FROM information_schema.columns
WHERE table_name = 'entregas_eo' ORDER BY ordinal_position;

-- Verificar colunas de fin_sync_logs
SELECT column_name FROM information_schema.columns
WHERE table_name = 'fin_sync_logs' ORDER BY ordinal_position;
```

---

## FASE 2 — MAIO A JULHO 2026

| Item | Observação |
|---|---|
| Bipagem QR Code na saída do pedido | Conferência antes de embalar |
| IA Central (multi-modelo) | Claude/GPT/Gemini por custo |
| Portal do cliente | Histórico, status, NFs para download |
| Gamificação completa | XP, HCoins, níveis, loja de recompensas |
| Aba Campanhas no EvolutionEmbed | Tabelas campaigns + campaign_participants |
| WhatsApp opt-in | Módulo de mensagens |
| RH básico | Registro de funcionários |
| Registro de interações | Ligações e WhatsApp via sistema (preenche tabela interactions) |

---

## FASE 3 — AGOSTO 2026+

| Item |
|---|
| SaaS multi-tenant (onboarding automatizado) |
| Billing Stripe (planos, trial, cobrança recorrente) |
| Domínio hhcontrol.com.br configurado |
| Primeiros clientes externos |

---

## ARQUITETURA DE ROTEAMENTO (ATUALIZADA)

```
/ (RootRedirect)
├── department = 'entregas'   → /entregador
├── department = 'logistica'  → /logistica
├── department = 'financeiro' → /admin
├── role = 'owner'            → /owner
└── role = 'seller'           → /vendedor

Rotas globais (todos os perfis autenticados):
├── /clientes              → ClientesPage
├── /clientes/:id          → ClientePage
├── /clientes/inativos     → KanbanInativosPage (NOVO — Bloco 1)
├── /pedidos               → PedidosPage
├── /produtos              → ProdutosPage
├── /compras               → ComprasPage
├── /estoque               → EstoquePage
├── /financeiro            → FinanceiroPage
├── /tarefas               → TarefasPage
├── /mural                 → MuralPage
├── /relatorios            → RelatoriosPage (NOVO — Bloco 4)
└── /gestor                → GestorPage (NOVO — Bloco 3, somente owner)

Rotas owner only:
└── /configuracoes         → ConfiguracoesPage (NOVO — Bloco 2)
```

---

## ITENS EM ABERTO (NÃO BLOQUEADORES)

| Item | Situação | Impacto |
|---|---|---|
| margem_real em orders | 34% de cobertura | Comissão calculada parcialmente |
| interactions vazia | Depende de registro via sistema | Scoreboard de contatos zerado |
| Aba Campanhas EvolutionEmbed | Placeholder | Não visível para usuário |
| Domínio hhcontrol.com.br | Comprar em registro.br | Sistema funciona sem ele |
| Senha dos usuários convidados | Equipe precisa ativar via email | Logins criados mas não testados |
