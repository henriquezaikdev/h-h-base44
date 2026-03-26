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
