# H&H CONTROL 2.0 — DECISÕES IMPORTANTES

## NF-e e FISCAL

### Focus NFe como provedor de NF-e
- NFe.io descartado por custo elevado
- Token Focus NFe salvo em fiscal_config (produção ativa)
- verify_jwt desabilitado nas Edge Functions emitir-nfe, consultar-nfe e download-danfe (segurança mantida pelo RLS do banco)
- nfe_ref salvo no banco durante emissão para garantir consulta correta de status

### Regras de emissão NF-e
- CFOP 5102 para clientes em GO, 6102 para outros estados
- consumidor_final derivado de client.ie: com IE = 0 (contribuinte), sem IE = 1 (não contribuinte)
- Data de emissão NF-e sempre em UTC-3 (horário Brasília)
- nome_destinatario em homologação = NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL
- modalidade_frete = 9 (sem frete) como padrão
- codigo_ncm obrigatório com 8 caracteres (padStart)
- Controle de numeração sequencial (numero_inicial no fiscal_config)

## PEDIDOS E ORÇAMENTOS

### Estrutura separada
- orders e quotes são tabelas separadas
- Conversão de orçamento para pedido: quote.status = converted + copia itens para order_items
- Pedido pode ser criado direto sem passar por orçamento
- Orçamento recusado registra motivo, preço e nome do concorrente (todos opcionais)

### Parcelamento (25/03/2026)
- PaymentSection.tsx compartilhado entre criação e edição de pedidos
- due_dates armazenado como jsonb em orders
- Parcelas calculadas automaticamente a partir do total e condição de pagamento

### Fluxo do pedido
- Estoque é baixado automaticamente na aprovação do pedido
- Fluxo: created → approved → picked → delivered

## PRODUTOS E ESTOQUE

### CMV
- CMV = custo de compra + 15%
- products.cost armazena CMV calculado (custo x 1.15)

### Nomenclatura
- Nome padrão de quantidade: qty (nunca quantity)

### Equivalência de Produtos
- Produtos com mesma função comercial (ex: Report A4 e Chamex A4) são unificados
- Tabela futura: hh_produto_equivalencia (produto_id_a, produto_id_b)
- Sempre usar UUIDs reais do banco, nunca buscar por strings textuais

## DADOS E INTEGRAÇÕES

### Sistema é a fonte da verdade
- Não depende do Conta Azul (renovação expira 14/05/2026)
- IA nunca executa ações automaticamente — apenas sugere e preenche

### APIs externas
- Busca CNPJ via BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
- Busca CEP via ViaCEP: https://viacep.com.br/ws/{cep}/json/

## BANCO E SEGURANÇA

### Enum task_status (26/03/2026)
- Valores válidos: open, done, cancelled
- NÃO usar: completed, concluida, pendente, aberta, em_andamento
- Descoberto via teste direto no Supabase REST API

### Timezone UTC → BRT (26/03/2026)
- Timestamps do Supabase vêm em UTC
- Converter para BRT (UTC-3) antes de extrair datas para agrupar por dia
- Timestamps podem vir com espaço em vez de T (ex: "2026-03-03 15:43:49+00") — usar .replace(' ', 'T') antes de new Date()

### Sellers duplicados (26/03/2026)
- Coluna active (boolean, default true) adicionada à tabela sellers
- Sellers duplicados da migração marcados com active=false
- Todas as queries filtram .eq('active', true)

### Tabelas que NÃO existem (26/03/2026)
- work_month_config, daily_focus, app_config, seller_levels, interactions, user_medals, daily_goals
- Hooks usam fallbacks: localStorage (daily_focus), defaults hardcoded (task_limits), placeholders (gamificação)

### RLS sellers
- Nunca usar subquery direto em sellers dentro de policy — causa recursão infinita
- Solução: criar função get_my_company_id() SECURITY DEFINER e usar ela na policy
- Policies ativas: "acesso proprio seller" (ALL), "sellers_self_read" (SELECT) via auth_user_id = auth.uid(), e "sellers_mesma_empresa_select" via get_my_company_id()

### JOIN orders → sellers
- Tabela orders tem duas FKs para sellers (seller_id e picked_by) — join direto é ambíguo
- Solução: usar segunda query separada buscando sellers onde id = order.seller_id

### UPDATE em massa com RLS
- Sempre usar SET session_replication_role = replica antes e SET session_replication_role = DEFAULT depois

### Tipos de dados
- order_number é tipo text no banco — comparar sempre com aspas simples, nunca como integer

## IMPORTAÇÕES E MIGRAÇÕES

### Migração Lovable → hh-controle-2 (concluída)
- sellers: 12, product_categories: 15, clients: 1.107, products: 3.115, orders: 7.276, order_items: 9.128
- FKs products e orders recriadas
- FKs order_items sem recriar (dados órfãos — não impacta operação)
- Sellers duplicados da migração desativados com active=false

### Importação de endereços via CSV Conta Azul (25-26/03/2026)
- Encoding UTF-8 corrigido para caracteres acentuados
- Endereços importados com sucesso

### Importação de forma de pagamento (25-26/03/2026)
- payment_method importado via orders-export do Conta Azul

## FERRAMENTA DE DESENVOLVIMENTO

### Claude Code
- Claude Code via app do Mac (não terminal, não VS Code)
- Prompts para o Claude Code devem ser sempre em bloco único para copiar e colar
- Nunca sugerir comandos como "code arquivo.tsx" — não funciona sem VS Code no PATH
- Para editar arquivos: sempre passar instrução em linguagem natural para o Claude Code executar
- Nunca usar agentes paralelos neste projeto — sempre sequencial, um arquivo por vez

## OWNERMUDIA — DECISÕES DE IMPLEMENTAÇÃO (26/03/2026)

### Componentes criados
- ActionCenterVendedor.tsx: orquestrador principal da aba Vendas
- ClickableScoreboard.tsx: cards de métricas com campos opcionais e defaults
- DailyFocusBlock.tsx: foco obrigatório do dia (max 3 itens, localStorage)
- TaskPrioritySection.tsx: seções colapsáveis por prioridade
- OpenQuotesCard.tsx: orçamentos em aberto (tabela quotes, status=pending)
- PriorityQueueSection.tsx: fila de clientes por priority_score
- OwnerTarefasTab.tsx: tarefas do owner + delegadas, agrupadas por prioridade
- OwnerEquipeTab.tsx: cards por colaborador, tarefas atrasadas, delegação
- ProfileHubContent.tsx: perfil com KPIs de tarefas (sem gamificação por enquanto)
- EvolutionEmbed.tsx: performance, comissão/nível, campanhas, regras

### Hooks criados
- useTasksData: tasks com JOIN clients, filtro por role (owner vê tudo)
- useSellersData: sellers ativos (.eq('active', true))
- useEvolutionData: vendas + tarefas por mês, dailyActivities por dia
- useProfileData: dados do seller + KPIs de tarefas
- useWorkingDaysTargets: métricas de vendas e tarefas do mês
- useActionCenterData: alertas (tarefas atrasadas, clientes sem pedido)
- useDailyFocus: foco diário (localStorage, tabela daily_focus futura)
- useTaskLimits: limites de tarefas por departamento (defaults hardcoded)
- useCriticalBlocker: bloqueio de tarefas críticas (snooze 3h)
- useCoinsAndMedals: placeholder (tabelas de gamificação futuras)


## VISÃO REAL DO PROJETO — CONTEXTO COMPLETO (27/03/2026)

### O que é o H&H Control 2.0 de verdade

O H&H Control 2.0 não é um CRM simples. É um **Company OS** — um sistema operacional completo da empresa. Ele foi concebido pelo Henrique (dono da H&H Suprimentos Corporativos) e executado com auxílio de IA.

O sistema é totalmente interligado. Cada módulo consome dados de outros módulos:
- Pedidos alimentam o Meu Dia do vendedor (scoreboard de vendas)
- Pedidos alimentam o Meu Dia da Adriana (separação e entrega)
- Pedidos alimentam o Financeiro (contas a receber)
- Pedidos alimentam a Evolução do vendedor (comissão e nível)
- Clientes alimentam a fila de prioridades do vendedor
- Clientes alimentam o Radar da Carteira
- Clientes alimentam o Assistente IA
- Tarefas alimentam todos os Meu Dia (de todos os perfis)
- Interações (ligações/whatsapp) alimentam o scoreboard diário do vendedor
- Interações alimentam a aba Evolução (qualidade de contato)
- Compras alimentam o Meu Dia da Anna (pendências e cotações)
- Estoque alimenta o Meu Dia da Adriana (alertas de ruptura)
- Gamificação (XP, medalhas, estrelas, nível) alimenta o Perfil e a Evolução de todos

Isso significa que **não dá para construir o Meu Dia sem os outros módulos estarem prontos**. A ordem de construção importa.

---

### Por que o projeto estava desorganizado

O sistema foi construído de dentro para fora — funcionalidade por funcionalidade, sem arquitetura de fluxo definida previamente. A IA (Claude) conduzia o desenvolvimento sem entender como as telas se conectavam entre si.

Resultado:
- Módulos construídos sem as tabelas que eles precisam existirem no banco
- O Meu Dia estava sendo desenvolvido sem `interactions`, `routines`, `daily_goals`, `medals`, `user_medals`, `xp_log` e `daily_focus` no banco
- Decisões técnicas tomadas sem considerar as dependências entre módulos
- Contexto perdido entre sessões — cada chat começava sem saber o que havia sido feito ou quebrado antes

---

### A decisão de replanejamento

Em 27/03/2026 foi feito um replanejamento completo. O código do Lovable (sistema anterior) foi analisado não para copiar, mas para entender:
- Como as telas se comunicam
- Quais campos cada componente consome
- Quais tabelas cada módulo precisa
- A lógica de negócio real por trás de cada funcionalidade

A partir dessa análise foi gerado o documento **HH_CONTROL_PLANEJAMENTO.md** com o mapa completo de dependências e a sequência correta de construção.

---

### Por que o código do Lovable existe no repositório

O arquivo `business-flow-core-main.zip` contém o sistema anterior (construído no Lovable). Ele tem 51 páginas, 467 componentes e 74 hooks — um sistema maduro e completo.

**Ele NÃO deve ser copiado para o 2.0.**

Ele serve exclusivamente como:
1. Referência de lógica de negócio (o que cada tela faz, quais campos usa)
2. Referência de fluxo entre módulos (como tela A chama tela B)
3. Referência de regras de negócio (cálculos, validações, fluxos de aprovação)

As syncs do Conta Azul que existem no Lovable são ignoradas completamente. O 2.0 é a fonte da verdade — não depende do Conta Azul para nada.

---

### Por que o Conta Azul está sendo removido

O Conta Azul tem renovação expirando em 14/05/2026. A única função crítica que ele cumpria era a emissão de NF-e — que já foi substituída pelo Focus NFe (em produção, funcionando desde março/2026).

Todo o resto (estoque, financeiro, pedidos, CRM) já é melhor gerenciado pelo H&H Control 2.0. Após 14/05/2026 o Conta Azul é desativado e o H&H Control 2.0 passa a ser o único sistema da empresa.

---

### Por que a sequência banco → tela é obrigatória

Se uma tela é construída antes da tabela que ela consome existir no banco, o hook de dados retorna vazio ou erro. O desenvolvedor (Claude Code) tenta resolver criando fallbacks, mocks ou localStorage — o que gera dívida técnica e bugs difíceis de rastrear.

A regra é: **a tabela existe no banco primeiro. Depois a tela é construída.**

Qualquer exceção a essa regra precisa ser explicitamente aprovada e documentada aqui.

---

### Por que o Meu Dia é o módulo mais complexo

O Meu Dia é a tela de entrada de todos os usuários. Ele não tem dados próprios — ele consome dados de praticamente todos os outros módulos do sistema.

Para o OwnerMeuDia funcionar completamente precisa de:
`orders`, `tasks`, `clients`, `quotes`, `sellers`, `interactions`, `seller_levels`, `seller_errors`, `seller_stars`, `user_medals`, `medals`, `daily_focus`

Para o AdminMeuDia (Anna) funcionar precisa de:
`tasks`, `routines`, `process_pendencies`, `purchase_requests`, `fin_payables`

Para o LogisticaMeuDia (Adriana) funcionar precisa de:
`tasks`, `routines`, `orders`, `products`, `stock_movements`

Para o ActionCenterVendedor funcionar precisa de:
`tasks`, `clients`, `orders`, `interactions`, `daily_goals`, `quotes`, `seller_levels`

Por isso o Meu Dia é construído por último — depois que todas as dependências existem.

---

### Por que o Cláudio tem cockpit separado

O Cláudio é entregador, não vendedor. Ele usa o sistema exclusivamente pelo celular, em campo, durante as entregas. Mostrar para ele a mesma interface dos vendedores (com CRM, metas, fila de clientes) seria inútil e confuso.

O EntregadorDashboard (/entregador) é uma interface mobile-first com navegação própria (bottom navigation, não sidebar). Tem apenas 3 abas: Entregas, Tarefas e Perfil.

O roteamento é automático: quando `sellers.department = 'entregas'`, o sistema redireciona para `/entregador` imediatamente após o login.

**Cláudio NÃO deve aparecer na fila de vendedores, no ranking de vendas, nem em nenhuma métrica comercial.**

---

### Por que o campo sellers.department é crítico

O campo `department` na tabela `sellers` é o que controla qual cockpit cada pessoa vê ao entrar no sistema. Se esse campo estiver errado, a pessoa vê a tela de outro perfil.

Mapeamento obrigatório:
- `department = 'financeiro_gestora'` → AdminMeuDia (Anna Cristina)
- `department = 'logistica'` → LogisticaMeuDia (Adriana)
- `department = 'entregas'` → EntregadorDashboard (Cláudio)
- `role = 'owner'` → OwnerMeuDia (Henrique)
- `is_sales_active = true` → ActionCenterVendedor (Joésio, Murilo, Nayara)

Antes de construir qualquer tela de Meu Dia, verificar essa query:
```sql
SELECT name, email, role, department, is_sales_active, active 
FROM sellers 
WHERE active = true 
ORDER BY name;
```

---

### Por que existe o schema dual na tabela tasks

A tabela `tasks` tem duas camadas de colunas:
- **Colunas originais 2.0:** `status` (enum: open/done/cancelled), `priority` (enum: baixa/normal/alta/urgente), `due_date`, `assigned_to`
- **Colunas CRM (adicionadas 26/03/2026):** `status_crm` (pendente/concluida/cancelada), `priority_crm`, `task_date`, `created_by_seller_id`, `assigned_to_seller_id`

Os hooks SEMPRE usam as colunas CRM. Nunca os enums originais.

Motivo: as colunas CRM foram adicionadas para compatibilidade com a lógica do Lovable sem quebrar a estrutura original do 2.0.

---

### Visão de futuro — SaaS

O H&H Suprimentos Corporativos é o cliente zero. O sistema foi arquitetado desde o início como multi-tenant (`company_id` em todas as tabelas + RLS via `auth_company_id()`).

Após validação completa na H&H (agosto/2026), o sistema será oferecido como SaaS para outras distribuidoras B2B de pequeno porte no Brasil. Cada empresa terá seus dados completamente isolados.

Nome do produto: **H&H Control**
Domínio futuro: hhcontrol.com.br

Esse contexto é importante para entender por que certas decisões de arquitetura foram tomadas de forma mais robusta do que o necessário para uma empresa só — multi-tenancy, RLS rigoroso, company_id obrigatório em todo insert.

## EVOLUÇÃO DO VENDEDOR — REGRAS DE COMISSÃO (27/03/2026)

### Comissão base por pedido (margem_real de orders)
- margem_real >= 0.45 → 2.0%
- margem_real >= 0.35 → 1.3%
- margem_real >= 0.20 → 1.0%
- margem_real >= 0.005 → 0.5%
- margem_real < 0.005 → 0%

### Regra de aceleração (vendas >= 130% da meta mensal)
- margem_real >= 0.30 → 2.0%
- margem_real >= 0.15 → 1.0%
- margem_real >= 0.005 → 0.5%
- margem_real < 0.005 → 0%

### Bônus por categoria
- Condições obrigatórias (ambas): realizado >= meta da categoria E margem_media >= 0.40
- margem_media >= 0.60 → +1.0%
- margem_media >= 0.40 → +0.5%
- Bloqueio: seller_errors do mês >= 4 → bônus = 0 para todas as categorias

### Metas de contato por nível
- Ovo: 18 ligações/dia × dias úteis | 15 whatsapp/dia × dias úteis
- Pena/Águia: 210 ligações/mês | 336 whatsapp/mês

### Tabelas criadas em 27/03/2026
- category_goals: metas personalizadas por vendedor/categoria/competência (seller_id, category_key, competencia, meta_valor)
- category_achievements: registro de conquistas por categoria (seller_id, category_key, competencia, stars_earned, xp_earned, bonus_pct)

### Duplicatas resolvidas
- xp_log → tabela padrão (usar sempre esta)
- xp_logs → ignorar (vazia, não remover para não quebrar queries existentes)

## NOVOS MÓDULOS — DECISÕES DE ESCOPO (27/03/2026)

### Bloco 1 — Identificação de Clientes
- Badge de identificação: novo (≤30d) | inativo | reativado | indicação
- Campo `origem` em clients já existe — usar para 'indicacao'
- Kanban inativos: rota /clientes/inativos, 4 colunas (Sem contato >60d | Contatado | Proposta | Reativado)
- Ao reativar cliente: clients.status = 'active'

### Bloco 2 — Configurações (/configuracoes — somente owner)
- Referência: Settings.tsx do Lovable (lido em 27/03/2026)
- 5 abas: Empresa, Usuários, Metas, Fiscal, Equivalências
- Logo da empresa: Supabase Storage + app_config key='logo_url'
- Edge Functions obrigatórias ANTES de construir: invite-user, reset-user-password
- Tabelas a verificar/criar antes: app_config, monthly_goals, hh_produto_equivalencia
- Tokens Focus NFe: nunca exibir em texto claro — máscara tipo senha

### Bloco 3 — Tela do Gestor (/gestor — somente owner)
- Referência: Gestor.tsx do Lovable (lido em 27/03/2026)
- INCLUIR: dados comerciais, financeiro lançado manualmente, relatório IA
- EXCLUIR: CEE/custos da empresa, RH/Genyo, Conta Azul
- 4 abas: Visão Executiva, Comercial (5 sub-abas), Financeiro, Relatório IA
- Edge Function `gestor-ia-report` do Lovable: deployar no 2.0 antes de construir a aba

### Bloco 4 — Relatórios (/relatorios)
- Referência: Relatorios.tsx do Lovable (lido em 27/03/2026)
- 3 abas: Vendas & Clientes, Comissões, Novos & Reativados
- Filtro de período + filtro por vendedor (owner vê todos, seller vê carteira)
- Exportação CSV em todas as abas
- Sem backend dedicado — calcular direto dos orders

### Bloco 5 — Entregador Online Sync
- API: https://api.entregadoronline.com/api/Destinos/Buscar
- Token: 0c2d25e5e97e051ab56c67dc864e3dd3bf883b7d | clienteId: 5066
- Vinculação: entregas_eo.controle_pedido = orders.order_number
- Pré-requisitos: app_config + fin_sync_logs (verificar colunas) + colunas extras em entregas_eo
- Cron: a cada 2h via Supabase Database → Cron Jobs

### monthly_goals — esquema aprovado
- Tabela a criar se não existir
- Campos: seller_id, month, year, sales_target, sales_achieved, calls_target,
  call_attempts_target, whatsapp_response_target, whatsapp_no_response_target, scope
- scope: 'global' (toda a loja) ou 'individual' (por vendedor)
- Botão "Replicar" na UI: copia meta para o mês seguinte
