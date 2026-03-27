# H&H CONTROL 2.0 — CORE CONTEXT

## PERFIL DO DONO
- Nome: Henrique
- Empresa: H&H Suprimentos Corporativos
- Está aprendendo desenvolvimento há 4 meses
- Veio do Lovable, agora usa Claude Code
- Não tem background técnico
- Quer instruções com explicações curtas quando for algo novo
- Prioridade é concluir o projeto, não fazer aula

## IDENTIFICAÇÃO DO PROJETO
- Nome: H&H Control 2.0
- Empresa: H&H Suprimentos Corporativos (distribuidora B2B)
- Repositório: ~/hh-control-2 (Mac M4)
- Supabase projeto: hh-controle-2
- Supabase URL: https://hxrbytqmqvuyhsfoirao.supabase.co
- company_id da H&H: 00000000-0000-0000-0000-000000000001
- Seller Henrique: email henrique@hhcomercio.com, role owner, auth_user_id 8e92899c-b939-4e2b-8ad4-972612902cb8

## STACK
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: Supabase (PostgreSQL + Edge Functions + Auth)
- IA: Anthropic API (claude-sonnet-4-20250514)
- Deploy: Vercel
- NF-e: Focus NFe (produção ativa, token na tabela fiscal_config)
- Dev: Claude Code (terminal Mac)
- Versionamento: GitHub (repositório privado)
- Domínio futuro: hhcontrol.com.br

## DESIGN SYSTEM — CLINICAL PREMIUM
- Fonte: DM Sans
- Fundo: #FAFAF9
- Painéis: branco puro
- Cor destaque: Índigo #3B5BDB
- Ícones: lucide-react linha fina
- Zero emojis, zero gradientes, zero sombras pesadas
- Referência visual: Linear, Stripe, Vercel

## PADRÕES DE ENGENHARIA
- Hook padrão de queries: useSupabaseQuery em src/hooks/useSupabaseQuery.ts
- Hooks Meu Dia: useTasksData, useSellersData, useEvolutionData, useProfileData, useWorkingDaysTargets, useActionCenterData, useDailyFocus, useTaskLimits, useCriticalBlocker
- RLS via função auth_company_id() SECURITY DEFINER
- Multi-tenant obrigatório: company_id em todas as tabelas e inserts
- Nomes de colunas: sempre usar EXATAMENTE os nomes definidos no BANCO.md
- Enum task_status: valores válidos são open, done, cancelled (NÃO completed, NÃO concluida, NÃO pendente)
- Timezone: created_at/done_at vêm em UTC do Supabase — converter para BRT (UTC-3) antes de extrair datas
- Formato Supabase: timestamps podem vir com espaço em vez de T (ex: "2026-03-03 15:43:49+00") — usar .replace(' ', 'T') antes de new Date()
- Zero paginação complexa
- Não recriar hooks existentes
- Não quebrar módulos já funcionando
- IA sugere e preenche — nunca executa ação invisível

## PERFIS DE USUÁRIO
- owner (Henrique): OwnerMeuDia — 5 abas: Vendas, Tarefas, Equipe, Perfil, Evolução
- vendedor: ActionCenter — CRM, metas, fila de clientes
- financeiro (Anna): AdminMeuDia — tarefas, compras, financeiro
- logistica (Adriana): LogisticaMeuDia — tarefas, estoque, entregas

## MÓDULOS CONCLUÍDOS E FUNCIONANDO
- Login + Auth + Sidebar por perfil
- Clientes (listagem + ficha + busca CNPJ via BrasilAPI + busca CEP via ViaCEP)
- Produtos (com campo NCM)
- Compras (kanban + cotação + fornecedores)
- Estoque (posição + entradas XML + alertas)
- Financeiro (fluxo mensal + contas + DRE + projeção)
- Dashboard por perfil
- Tarefas
- NF-e (Focus NFe) — produção ativa
  - Emissão em 2 cliques
  - Autorização SEFAZ em produção
  - Download DANFE funcionando
  - Status do pedido muda para 'invoiced' automaticamente após autorização
  - Badge e botão DANFE visíveis em pedidos 'approved' e 'invoiced'
  - Controle de numeração sequencial (numero_inicial no fiscal_config)
  - CFOP automático 5102/6102 por UF
  - verify_jwt = false nas Edge Functions (emitir-nfe, consultar-nfe, download-danfe)
- Migração de dados (Lovable → hh-controle-2)
  - sellers: 12 registros (sellers duplicados desativados com active=false)
  - product_categories: 15 registros
  - clients: 1.107 registros
  - products: 3.115 registros
  - orders: 7.276 registros
  - order_items: 9.128 registros
  - FKs products e orders recriadas
  - FKs order_items sem recriar (dados órfãos — não impacta operação)
- Pedidos (duas abas: Orçamentos e Pedidos, modal completo com 5 seções)
- Parcelamento no modal de pedidos (PaymentSection.tsx compartilhado, due_dates jsonb)
- OwnerMeuDia completo com 5 abas (Vendas, Tarefas, Equipe, Perfil, Evolução)
  - Aba Vendas: ClickableScoreboard, DailyFocusBlock, TaskPrioritySection, OpenQuotesCard, PriorityQueueSection
  - Aba Tarefas: OwnerTarefasTab (minhas tarefas + delegadas, agrupadas por prioridade)
  - Aba Equipe: OwnerEquipeTab (cards por colaborador, tarefas atrasadas, delegação)
  - Aba Perfil: ProfileHubContent (avatar, KPIs, tabs visão geral/métricas)
  - Aba Evolução: EvolutionEmbed (performance, comissão/nível, campanhas, regras)
- Componentes UI (20 componentes shadcn/ui: Button, Card, Badge, Tabs, Dialog, Avatar, Progress, etc.)
- QueryClientProvider configurado no App.tsx (TanStack React Query)

## CONTA AZUL
- Renovação expira em 14/05/2026 — sistema novo precisa estar operacional antes
- Única função crítica: emissão de NF-e (já substituída pelo Focus NFe)
- Após expiração: H&H Control é a fonte da verdade para tudo
- Sync de dados do Conta Azul: produtos, estoque, pedidos (módulo futuro se necessário)

## REGRAS DE USO DA IA
1. Todo chat novo começa com CORE.md + BANCO.md
2. Nunca depender de memória entre chats
3. Se faltar informação, perguntar antes de assumir
4. Não sugerir soluções genéricas fora do padrão do projeto
5. Não alterar arquitetura existente sem necessidade explícita
6. Respostas práticas e executáveis

## FORMATO PADRÃO DE PROMPT
Você está trabalhando no projeto H&H Control 2.0.

REGRAS:
- Respeitar totalmente a arquitetura existente
- Não sugerir soluções genéricas
- Não reinventar fluxo já definido
- Não mudar estrutura sem necessidade
- Sempre responder de forma prática e executável

CONTEXTO:
@CONTEXT/CORE.md
@CONTEXT/BANCO.md

TAREFA:
[descrição direta do que precisa ser feito]

## FERRAMENTA DE DESENVOLVIMENTO
- Claude Code via app do Mac (não terminal, não VS Code)
- Prompts para o Claude Code devem ser sempre em bloco único para copiar e colar
- Nunca sugerir comandos como "code arquivo.tsx" — não funciona sem VS Code no PATH
- Para editar arquivos: sempre passar instrução em linguagem natural para o Claude Code executar
- Para rodar comandos de terminal: o usuário usa o terminal do Mac separadamente

## FASE 1 — MVP (prazo 14/05/2026)
Módulos pendentes:
- Assistente IA comercial na ficha do cliente (Edge Function assistente-cliente)
- Fila inteligente de prioridades (score calculado no backend)
- Radar da carteira (anéis: ativo, recompra, atraso, risco)
- Bipagem QR Code na saída do pedido
- Entrada de NF por XML com geração de contas a pagar
- Mural social + Stories (tabelas hh_mural_posts, hh_status_posts a criar)
- Kanban de clientes inativos

## FASE 2 (maio-julho 2026)
- IA Central (multi-modelo: Claude/GPT/Gemini por custo)
- RH (registro de funcionários, férias, ponto)
- Portal do cliente (histórico, status, NFs para download)
- Gamificação completa (XP, HCoins, níveis, loja)
- WhatsApp opt-in

## FASE 3 (agosto 2026+)
- SaaS multi-tenant (company_id + RLS já prontos)
- Onboarding automatizado para novos clientes
- Billing Stripe (planos, cobrança recorrente, trial)
- Primeiros clientes externos distribuidoras B2B

## STATUS ATUAL
Data: 27/03/2026

Último concluído:
- Etapa C completa: Fila de Prioridades, Radar da Carteira, Assistente IA
- Etapa E completa: GitHub (henriquezaikdev/hh-control-2) + Vercel (hh-control-2.vercel.app)
- Mural Social completo (771 linhas, commit 0e49dd0):
  - MuralPage.tsx: feed, stories, reações, comentários, modal de publicação
  - MuralWidget.tsx: widget compacto nos cockpits Owner e Vendedor
  - Rota /mural + sidebar para todos os perfis

Em andamento:
- Aba Campanhas no EvolutionEmbed — placeholder (tabelas não criadas)
- margem_real em orders — 34% de cobertura
- interactions vazia — depende de registro via sistema

Próximo passo:
1. Criar logins da equipe no Supabase Auth
2. Kanban de clientes inativos (Etapa D)
3. Bipagem QR Code na saída do pedido (Etapa D)

Observações:
- commission_pct em order_items: 100% zerado — irrelevante, comissão usa margem_real
- Comissão base: faixas por margem_real (0.45→2%, 0.35→1.3%, 0.20→1%, 0.005→0.5%)
- Regra de aceleração: vendas >= 130% da meta → faixas mais agressivas
- Bônus categoria: meta batida + margem >= 40% → +0.5% | >= 60% → +1.0%
- Bloqueio bônus: seller_errors >= 4 no mês → bônus zerado para todas as categorias
- seller_levels.monthly_sales_target: Joésio e Murilo R$35k, Nayara R$30k
- xp_log é a tabela padrão — ignorar xp_logs
