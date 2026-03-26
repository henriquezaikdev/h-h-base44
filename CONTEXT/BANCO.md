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

## TABELAS

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

### orders
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid |
| seller_id | uuid |
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
| nfe_issued_at | timestamptz |
| approved_at | timestamptz |
| picked_at | timestamptz |
| picked_by | uuid |
| delivered_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

## REGRA DE NEGÓCIO — ORDERS
- Pedido aprovado impacta estoque (stock_qty deve ser baixado)
- Fluxo: created → approved → picked → delivered
- Estoque é baixado automaticamente na aprovação

### order_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| order_id | uuid |
| product_id | uuid |
| qty | numeric |
| unit_price | numeric |
| discount | numeric |
| total | numeric |
| cost_at_sale | numeric |
| commission_pct | numeric |
| picked | boolean |
| created_at | timestamptz |

### products
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| category_id | uuid |
| sku | text |
| name | text |
| description | text |
| unit | text |
| cost | numeric |
| price | numeric |
| ncm | text |
| stock_qty | integer |
| stock_min | integer |
| stock_max | integer |
| is_active | boolean |
| source_system | text |
| created_at | timestamptz |
| updated_at | timestamptz |

### quotes
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| client_id | uuid |
| seller_id | uuid |
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

## RELAÇÃO QUOTES → ORDERS
- Um quote pode ser convertido em order
- Quando convertido: status = converted + gera novo order_id
- quote_items são copiados para order_items na conversão

### quote_items
| Coluna | Tipo |
|---|---|
| id | uuid |
| quote_id | uuid |
| product_id | uuid |
| qty | numeric |
| unit_price | numeric |
| discount | numeric |
| total | numeric |
| created_at | timestamptz |

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

## SEGURANÇA FISCAL_CONFIG
- Tokens nunca expostos no frontend
- Uso exclusivo dentro de Edge Functions

## EDGE FUNCTIONS DEPLOYADAS
- emitir-nfe: recebe order_id + company_id, monta payload Focus NFe, emite NF-e
- consultar-nfe: recebe order_id + company_id + ref, consulta status no Focus NFe

## HOOKS DISPONÍVEIS
- useSupabaseQuery — padrão para todas as queries
- useNFe — emissão e consulta de NF-e (src/hooks/useNFe.ts)

## COMPONENTES DISPONÍVEIS
- EmitirNFeButton — botão + modal de emissão NF-e (src/components/EmitirNFeButton.tsx)

## DECISÕES IMPORTANTES
- NF-e via Focus NFe
- orders e quotes são tabelas separadas
- Conversão de orçamento para pedido: quote.status = converted + copia itens para order_items
- Nome padrão de quantidade: qty (nunca quantity)
- Sistema é a fonte da verdade
- IA nunca executa ações automaticamente
- Estoque é baixado automaticamente na aprovação do pedido
- Pedido pode ser criado direto sem passar por orçamento
- Orçamento recusado registra motivo, preço e nome do concorrente (todos opcionais)
- CFOP 5102 para clientes em GO, 6102 para outros estados
- CMV = custo de compra + 15% — products.cost armazena CMV calculado
- consumidor_final derivado de client.ie: com IE = 0 (contribuinte), sem IE = 1 (não contribuinte)
- Data de emissão NF-e sempre em UTC-3 (horário Brasília)
- nome_destinatario em homologação = NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL
- modalidade_frete = 9 (sem frete) como padrão
- codigo_ncm obrigatório com 8 caracteres
