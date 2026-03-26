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

## DADOS E INTEGRAÇÕES

### Sistema é a fonte da verdade
- Não depende do Conta Azul
- IA nunca executa ações automaticamente — apenas sugere e preenche

### APIs externas
- Busca CNPJ via BrasilAPI: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
- Busca CEP via ViaCEP: https://viacep.com.br/ws/{cep}/json/

## BANCO E SEGURANÇA

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
