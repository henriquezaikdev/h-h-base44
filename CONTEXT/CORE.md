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
- NF-e: Focus NFe (homologação ativa, token na tabela fiscal_config)

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
- RLS via função auth_company_id() SECURITY DEFINER
- Multi-tenant obrigatório: company_id em todas as tabelas e inserts
- Nomes de colunas: sempre usar EXATAMENTE os nomes definidos no BANCO.md
- Zero paginação complexa
- Não recriar hooks existentes
- Não quebrar módulos já funcionando
- IA sugere e preenche — nunca executa ação invisível

## PERFIS DE USUÁRIO
- owner (Henrique): OwnerMeuDia — visão geral, equipe, vendas
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
  - sellers: 12 registros
  - product_categories: 15 registros
  - clients: 1.107 registros
  - products: 3.115 registros
  - orders: 7.276 registros
  - order_items: 9.128 registros
  - FKs products e orders recriadas
  - FKs order_items sem recriar (dados órfãos — não impacta operação)
- Pedidos (duas abas: Orçamentos e Pedidos, modal completo com 5 seções)
- Parcelamento no modal de pedidos (PaymentSection.tsx compartilhado, due_dates jsonb)

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

## STATUS ATUAL
Data: 26/03/2026
Último concluído:
- CLAUDE.md reescrito com identidade completa, regras, módulos, fases, design system
- CONTEXT/DECISOES.md criado (decisões organizadas por categoria)
- CONTEXT/PESSOAS.md criado (6 perfis de usuário)
- CONTEXT/CORE.md e CONTEXT/BANCO.md atualizados com status da sessão
- Checklist de Qualidade Visual adicionado ao CLAUDE.md (11 categorias)
- Checklist expandido com: formulários, tabelas/dados, feedback, acessibilidade
Em andamento: Correções na ficha do cliente (ClientePage.tsx)
Próximo passo:
- Continuar correções na ficha do cliente
- Módulos da Fase 1 pendentes (prazo 14/05/2026)
Observações:
- order_number é tipo text — sempre comparar com aspas simples
- UPDATE em massa: usar SET session_replication_role = replica para bypassar RLS
- JOIN orders → sellers é ambíguo (duas FKs) — usar query separada
- RLS sellers: nunca subquery direto na policy — usar get_my_company_id()
