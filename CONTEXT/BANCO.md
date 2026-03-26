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
| active | boolean |
| created_at | timestamptz |

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
| Coluna | Tipo |
|---|---|
| id | uuid |
| company_id | uuid |
| title | text |
| description | text |
| client_id | uuid (fk → clients) |
| assigned_to | uuid (fk → sellers) |
| priority | text (baixa, normal, alta, urgente) |
| due_date | date |
| done_at | timestamptz |
| status | text (open, completed, cancelled) |
| is_recurring | boolean |
| created_at | timestamptz |
| updated_at | timestamptz |

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

## EDGE FUNCTIONS DEPLOYADAS
- emitir-nfe: recebe order_id + company_id, monta payload Focus NFe, emite NF-e
- consultar-nfe: recebe order_id + company_id + ref, consulta status no Focus NFe
- get-danfe-url: gera URL do DANFE
- assistente-cliente: IA comercial na ficha do cliente

## HOOKS DISPONÍVEIS
- useSupabaseQuery — padrão para todas as queries
- useNFe — emissão e consulta de NF-e (src/hooks/useNFe.ts)

## COMPONENTES DISPONÍVEIS
- EmitirNFeButton — botão + modal de emissão NF-e (src/components/EmitirNFeButton.tsx)
