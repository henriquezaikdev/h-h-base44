# H&H CONTROL 2.0 — ESTRUTURA DO BANCO

## PADRÃO DE NOMENCLATURA (CRÍTICO)
Sempre usar EXATAMENTE os nomes definidos aqui.
Nunca assumir nomes diferentes.
Nunca traduzir nomes automaticamente.

## REGRAS GERAIS
- Toda tabela tem company_id (uuid)
- RLS via auth_company_id()
- Timestamps: created_at, updated_at (timestamptz)
- PKs sempre uuid com gen_random_uuid()
- Quantidade: sempre qty (nunca quantity)

---

## CRM

### clients
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| name | text |
| trade_name | text |
| cnpj | text |
| email | text |
| phone | text |
| address | text (texto livre) |
| street | text |
| street_number | text |
| complement | text |
| neighborhood | text |
| city | text |
| state | text |
| zip_code | text |
| ie | text |
| status | USER-DEFINED |
| seller_id | uuid |
| avg_ticket | numeric |
| avg_reorder_days | numeric |
| total_orders | integer |
| total_revenue | numeric |
| priority_score | numeric |
| last_order_at | timestamptz |
| notes | text |
| origem | text |
| unit_type | text |
| payment_method | text |
| payment_term | text |
| birthday_day | integer |
| birthday_month | integer |
| codigo_ibge | text |
| created_at | timestamptz |
| updated_at | timestamptz |
| reativado_em | timestamptz |
| janela_longa | boolean default false |
| intervalo_medio_dias | integer |
| proxima_compra_estimada | date |
| reativacao_score | numeric default 0 |
| reativacao_iniciada | boolean default false |
| reativacao_iniciada_em | timestamptz |
| reativacao_status | varchar(20) default null |
| reativacao_concluida | boolean default false |
| reativacao_concluida_em | timestamptz |
| reativacao_motivo_perda | text |
| reativacao_sugestao_ia | text |
| ticket_medio_mensal | numeric default 0 |
| ultimo_pedido_em | timestamptz |

### buyers
| Coluna | Tipo |
|---|---|
| id | uuid |
| client_id | uuid (fk → clients) |
| name | text |
| email | text |
| phone | text |
| role | text |
| created_at | timestamptz |

### sellers
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| auth_user_id | uuid |
| name | text |
| email | text |
| role | text (owner, admin, manager, seller, logistics) |
| department | text |
| avatar_url | text |
| status | text (ATIVO, INATIVO) |
| active | boolean |
| is_sales_active | boolean |
| created_at | timestamptz |
| ui_mode | varchar(20) default 'normal' |

**RLS sellers:** nunca subquery direto na policy — usar get_my_company_id() SECURITY DEFINER.

---

## PEDIDOS E ORÇAMENTOS

### orders
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid (fk → clients) |
| seller_id | uuid (fk → sellers) |
| status | USER-DEFINED |
| subtotal | numeric |
| discount | numeric |
| total | numeric |
| notes | text |
| payment_method | text |
| payment_term | text |
| due_dates | jsonb |
| rejection_reason | text |
| nfe_status | text |
| nfe_key | text |
| nfe_url | text |
| nfe_ref | text |
| nfe_issued_at | timestamptz |
| approved_at | timestamptz |
| picked_at | timestamptz |
| picked_by | uuid (fk → sellers) |
| delivered_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

**Regra:** Pedido aprovado baixa estoque automaticamente. Fluxo: created → approved → picked → delivered.
**JOIN:** orders tem duas FKs para sellers (seller_id e picked_by) — join direto é ambíguo, usar query separada.

### order_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| order_id | uuid (fk → orders) |
| product_id | uuid (fk → products) |
| qty | numeric |
| unit_price | numeric |
| discount | numeric |
| total | numeric |
| cost_at_sale | numeric |
| commission_pct | numeric |
| picked | boolean |
| created_at | timestamptz |

### quotes
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid (fk → clients) |
| seller_id | uuid (fk → sellers) |
| status | text (pending, approved, rejected, converted) |
| subtotal | numeric |
| discount | numeric |
| total | numeric |
| notes | text |
| rejection_reason | text |
| rejection_competitor_price | numeric |
| rejection_competitor_name | text |
| created_at | timestamptz |
| updated_at | timestamptz |

### quote_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| quote_id | uuid (fk → quotes) |
| product_id | uuid (fk → products) |
| qty | numeric |
| unit_price | numeric |
| discount | numeric |
| total | numeric |
| created_at | timestamptz |

**Relação:** quote convertido → status = converted + itens copiados para order_items.

---

## PRODUTOS E ESTOQUE

### products
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| category_id | uuid (fk → product_categories) |
| sku | text |
| name | text |
| description | text |
| unit | text |
| cost | numeric (CMV = custo x 1.15) |
| price | numeric |
| ncm | text |
| stock_qty | integer |
| stock_min | integer |
| stock_max | integer |
| is_active | boolean |
| source_system | text |
| created_at | timestamptz |
| updated_at | timestamptz |

### product_categories
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| name | text |
| keywords | jsonb (array de strings) |
| commission_pct | numeric |
| lead_time_days | integer |
| created_at | timestamptz |

### stock_movements
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| product_id | uuid (fk → products) |
| type | text (ENTRADA, SAIDA, AJUSTE, xml_import) |
| quantity | numeric |
| reason | text |
| created_by | uuid (fk → sellers) |
| created_at | timestamptz |

### stock_entries
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| supplier_name | text |
| reference | text |
| nf_number | text |
| nf_date | date |
| entry_date | date |
| total_value | numeric |
| status | text (LANCADA, RASCUNHO) |
| created_by | uuid (fk → sellers) |
| created_at | timestamptz |

### stock_entry_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| entry_id | uuid (fk → stock_entries, cascade) |
| product_id | uuid (fk → products) |
| qty | numeric |
| unit_cost | numeric |
| created_at | timestamptz |

---

## COMPRAS E FORNECEDORES

### purchase_requests
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| title | text |
| status | text (NOVA_SOLICITACAO, AGUARDANDO_COMPRADOR, EM_COTACAO, AGUARDANDO_APROVACAO_SOLICITANTE, APROVADA_PARA_COMPRAR, EM_COMPRA_FORNECEDOR, AGUARDANDO_ENTREGA_FORNECEDOR, ENTREGUE, CANCELADO) |
| priority | text (NORMAL, URGENTE, CRITICO) |
| client_id | uuid (fk → clients) |
| requester_id | uuid (fk → sellers) |
| buyer_id | uuid (fk → sellers) |
| deadline | date |
| origin | text |
| product_id | uuid (fk → products) |
| created_at | timestamptz |
| updated_at | timestamptz |

### purchase_request_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| request_id | uuid (fk → purchase_requests) |
| name | text |
| qty | numeric |
| unit | text |
| created_at | timestamptz |

### suppliers
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| name | text |
| cnpj | text |
| whatsapp | text |
| city | text |
| status | text (active, inactive) |
| created_at | timestamptz |
| updated_at | timestamptz |

### quote_sessions
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| title | text |
| status | text (aberta, em_comparacao, fechada) |
| origin | text |
| created_at | timestamptz |
| updated_at | timestamptz |

### supplier_quotes
| Coluna | Tipo |
|---|---|
| id | uuid |
| session_id | uuid (fk → quote_sessions) |
| supplier_name | text |
| created_at | timestamptz |

### quote_lines
| Coluna | Tipo |
|---|---|
| id | uuid |
| supplier_quote_id | uuid (fk → supplier_quotes) |
| item_name | text |
| unit_price | numeric |
| quantity | numeric |
| winner | boolean |
| created_at | timestamptz |

---

## TAREFAS

### tasks
**Schema dual:** colunas originais 2.0 + colunas CRM adicionadas para compatibilidade com Meu Dia.
Os hooks usam as colunas CRM (status_crm, priority_crm, task_date, etc.)

| Coluna | Tipo | Obs |
|---|---|---|
| id | uuid | |
| company_id | uuid | |
| title | text | título (2.0) |
| description | text | notas/observações (2.0) |
| client_id | uuid (fk → clients) | |
| assigned_to | uuid (fk → sellers) | coluna original 2.0 |
| priority | enum (low, medium, high, urgent) | enum original 2.0 |
| due_date | date | data original 2.0 |
| done_at | timestamptz | |
| status | enum task_status (open, done, cancelled) | enum original 2.0 |
| is_recurring | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| **Colunas CRM (adicionadas 26/03/2026)** | | |
| status_crm | text (pendente, concluida, cancelada) | usado pelos hooks |
| priority_crm | text (baixa, media, alta, urgente) | usado pelos hooks |
| task_date | date | data da tarefa (usado pelos hooks) |
| contact_type | text (ligacao, whatsapp) | tipo de contato |
| contact_reason | text (RETORNO, ACOMPANHAMENTO, VENDA, POS_VENDA) | |
| created_by_seller_id | uuid (fk → sellers) | quem criou |
| assigned_to_seller_id | uuid (fk → sellers) | atribuído a |
| completed_at | timestamptz | quando concluiu |
| manager_confirmed_at | timestamptz | confirmação do gestor |
| planning_notes | text | notas de planejamento |
| planning_products | jsonb | produtos planejados |
| task_category | text | categoria da tarefa |
| task_steps | jsonb | passos/checklist |
| is_deleted | boolean (default false) | soft delete |
| tem_orcamento_aberto | boolean | |
| orcamento_ca_codigo | text | |
| orcamento_valor | numeric | |
| orcamento_aberto_em | timestamptz | |
| operational_error | boolean | erro operacional |
| error_note | text | descrição do erro |
| source_module | text | módulo de origem |
| related_type | text | tipo relacionado |
| related_id | uuid | id relacionado |
| created_by_trigger | boolean | criado por trigger |
| unique_key | text | chave única |

**Regra hooks:** sempre usar status_crm/priority_crm/task_date em vez dos enums originais.

---

## FINANCEIRO

### fin_payables
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| description | text |
| amount | numeric |
| due_date | date |
| status | text (default: pendente) |
| origin | text |
| origin_id | uuid |
| created_at | timestamptz |

---

## FISCAL

### fiscal_config
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| focusnfe_token_homologacao | text |
| focusnfe_token_producao | text |
| ambiente | text (homologacao, producao) |
| serie | text |
| natureza_operacao | text |
| created_at | timestamptz |
| updated_at | timestamptz |

**Segurança:** tokens nunca expostos no frontend — uso exclusivo em Edge Functions.

---

## CONFIGURAÇÕES

### app_config
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| key | text |
| value | text |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (company_id, key) |

Keys em uso: empresa_nome, empresa_cnpj, empresa_telefone, empresa_endereco, logo_url, reativacao_meta_mensal

### monthly_goals
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| month | integer |
| year | integer |
| sales_target | numeric default 0 |
| sales_achieved | numeric default 0 |
| calls_target | integer default 0 |
| call_attempts_target | integer default 0 |
| whatsapp_response_target | integer default 0 |
| whatsapp_no_response_target | integer default 0 |
| scope | text default 'individual' |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (company_id, seller_id, month, year) |

---

## GAMIFICAÇÃO E EVOLUÇÃO

### seller_levels
**Status: SQL gerado, aguardando execução no Supabase**
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers, UNIQUE) |
| current_level | text (ovo, pena, aguia) default 'ovo' |
| monthly_sales_target | numeric default 30000 |
| daily_calls_target | integer default 18 |
| base_daily_calls | integer default 18 |
| base_daily_whatsapp | integer default 15 |
| consecutive_months_met | integer default 0 |
| consecutive_months_missed | integer default 0 |
| commission_bonus | numeric default 0 |
| errors_this_month | integer default 0 |
| last_evaluated_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

### seller_errors
**Status: SQL gerado, aguardando execução no Supabase**
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| month | integer |
| year | integer |
| error_date | date |
| description | text |
| registered_by | uuid (fk → sellers) |
| created_at | timestamptz |

### seller_stars
**Status: SQL gerado, aguardando execução no Supabase**
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers, UNIQUE) |
| bronze | integer default 0 |
| prata | integer default 0 |
| ouro | integer default 0 |
| total_stars | integer default 0 |
| updated_at | timestamptz |

### work_month_config
**Status: SQL gerado, aguardando execução no Supabase**
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| year_month | text (formato: '2026-03') |
| working_days | integer default 22 |
| operational_start_date | date |
| created_at | timestamptz |
| updated_at | timestamptz |

### interactions
**Status: SQL gerado, aguardando execução no Supabase**
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| responsible_seller_id | uuid (fk → sellers) |
| client_id | uuid (fk → clients) |
| interaction_type | text (ligacao, whatsapp, email, visita, outro) |
| interaction_date | date |
| notes | text |
| duration_seconds | integer |
| created_at | timestamptz |

**SQL de criação:** supabase/migrations/20260326_gamificacao.sql

---

## EDGE FUNCTIONS DEPLOYADAS
- emitir-nfe: recebe order_id + company_id, monta payload Focus NFe, emite NF-e
- consultar-nfe: recebe order_id + company_id + ref, consulta status no Focus NFe
- get-danfe-url: gera URL do DANFE
- assistente-cliente: IA comercial na ficha do cliente

## HOOKS DISPONÍVEIS
- useSupabaseQuery — padrão para todas as queries
- useNFe — emissão e consulta de NF-e (src/hooks/useNFe.ts)
- useTasksData — tarefas com schema CRM (status_crm, task_date, etc.)
- useSellersData — sellers ativos (filtro status ATIVO)
- useEvolutionData — vendas + tarefas por mês, dailyActivities
- useProfileData — dados do seller + KPIs de tarefas
- useWorkingDaysTargets — métricas de vendas e tarefas do mês
- useActionCenterData — alertas (tarefas atrasadas, clientes sem pedido)
- useDailyFocus — foco diário (localStorage, tabela daily_focus futura)
- useTaskLimits — limites de tarefas por departamento
- useCriticalBlocker — bloqueio de tarefas críticas

## COMPONENTES DISPONÍVEIS
- EmitirNFeButton — botão + modal de emissão NF-e (src/components/EmitirNFeButton.tsx)
- 20 componentes shadcn/ui em src/components/ui/



### routines
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| title | text |
| department | text |
| recurrence | text (daily, weekly, monthly) |
| active | boolean default true |
| last_generated_date | date |
| created_at | timestamptz |
| updated_at | timestamptz |

### process_pendencies
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| owner_user_id | uuid (fk → sellers) |
| title | text |
| description | text |
| type | text (COMPRAS, FINANCEIRO) |
| status | text (ABERTA, RESOLVIDA) |
| source | text (solicitacoes, cotacoes) |
| related_id | uuid |
| due_date | date |
| created_at | timestamptz |
| updated_at | timestamptz |

### daily_goals
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| goal_date | date |
| calls_target | integer default 18 |
| whatsapp_target | integer default 15 |
| calls_done | integer default 0 |
| whatsapp_done | integer default 0 |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (seller_id, goal_date) |

### medals
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| code | text (UNIQUE por company) |
| name | text |
| description | text |
| tier | text (BRONZE, PRATA, OURO) |
| created_at | timestamptz |

### user_medals
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| user_id | uuid (fk → sellers) |
| medal_id | uuid (fk → medals) |
| earned_at | timestamptz |
| period_key | text (ex: '2026-03') |
| context_json | jsonb |
| created_at | timestamptz |

### xp_log
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| amount | integer |
| reason | text |
| source | text (tarefa, pedido, elogio) |
| source_id | uuid |
| created_at | timestamptz |

### daily_focus
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| focus_date | date |
| items | jsonb default '[]' |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (seller_id, focus_date) |

---

## ENTREGAS E VEÍCULOS

### entregas_eo
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| cod_entrega | text |
| os_id | text |
| destinatario | text |
| endereco | text |
| controle_pedido | text |
| pedido_id | uuid (fk → orders, nullable) |
| status | text (PENDENTE, ENTREGUE) |
| data_baixa | date |
| hora_baixa | text |
| entregador | text |
| link | text |
| observa_de_baixa | text |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (company_id, cod_entrega) |

**XP:** cada entrega com status=ENTREGUE vale 5 XP para o entregador.

### vehicle_fuel_logs
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| fuel_date | date |
| km | numeric |
| liters | numeric |
| amount | numeric |
| fuel_type | text (default: Gasolina) |
| station | text |
| created_at | timestamptz |

### vehicle_maintenance_logs
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| title | text |
| maintenance_type | text (default: Revisão) |
| maintenance_date | date |
| km | numeric |
| cost | numeric |
| supplier | text |
| notes | text |
| created_at | timestamptz |

---

## GAMIFICAÇÃO — METAS E CONQUISTAS POR CATEGORIA

### category_goals
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| category_key | text |
| competencia | text (formato: '2026-03') |
| meta_valor | numeric |
| created_at | timestamptz |
| updated_at | timestamptz |
| UNIQUE | (seller_id, category_key, competencia) |

### category_achievements
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| seller_id | uuid (fk → sellers) |
| category_key | text |
| competencia | text (formato: '2026-03') |
| stars_earned | integer |
| xp_earned | integer |
| bonus_pct | numeric |
| created_at | timestamptz |
| UNIQUE | (seller_id, category_key, competencia) |

---

### client_reativacoes
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid (fk → clients) |
| seller_id | uuid (fk → sellers) |
| data_reativacao | timestamptz |
| valor_primeiro_pedido | numeric |
| dias_inativo | integer |
| xp_gerado | integer |
| streak_dia | integer |
| multiplicador | numeric default 1.0 |

---

### reativacao_contatos
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid (fk → clients) |
| seller_id | uuid (fk → sellers) |
| tipo | varchar(30) NOT NULL |
| resultado | varchar(50) |
| observacao | text |
| created_at | timestamptz |
