# CLAUDE.md

## IDENTIDADE DO PROJETO
H&H Control 2.0 — sistema operacional da H&H Suprimentos Corporativos.
- Stack: React 18 + Vite + TypeScript + Tailwind CSS + Supabase + Anthropic API
- Repositório: ~/hh-control-2
- Supabase projeto: hh-controle-2
- URL: https://hxrbytqmqvuyhsfoirao.supabase.co
- company_id da H&H: 00000000-0000-0000-0000-000000000001
- Senha do banco: 15Qaf4Lrt58lEWDF
- Host: db.hxrbytqmqvuyhsfoirao.supabase.co
- Port: 5432
- Database: postgres
- User: postgres

## LEITURA OBRIGATÓRIA NO INÍCIO DE CADA SESSÃO
Ler CONTEXT/CORE.md, CONTEXT/BANCO.md, CONTEXT/DECISOES.md e CONTEXT/PESSOAS.md antes de qualquer ação. Nunca perguntar o que já está nesses arquivos.

## COMMANDS

```bash
npm run dev      # Start development server (Vite HMR)
npm run build    # Type-check (tsc -b) then bundle for production
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

No test framework is configured yet.

## ENVIRONMENT

The app requires a `.env.local` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

All Vite env vars must be prefixed with `VITE_` to be accessible in the browser.

## ARCHITECTURE

React 18 SPA using:
- **Vite** — build tool with `@vitejs/plugin-react` (Oxc-based)
- **React Router DOM** — client-side routing
- **TanStack React Query** — server state and data fetching
- **Supabase** — backend (auth, database, realtime) via `src/lib/supabase.ts`
- **Tailwind CSS 4** — utility-first styling
- **Anthropic API** — IA (claude-sonnet-4-20250514)
- **Focus NFe** — NF-e (homologação e produção)

Entry point: `index.html` → `src/main.tsx` → `src/App.tsx`

The Supabase client is initialized in `src/lib/supabase.ts` and should be imported from there throughout the app.

## TypeScript

Strict mode is fully enabled — `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedSideEffectImports` are all on. Fix all TypeScript errors before building; `tsc -b` runs as part of `npm run build`.

## REGRAS DE COMPORTAMENTO OBRIGATÓRIAS
- Nunca sugerir abrir terminal, VS Code ou fazer passos manuais — Claude Code faz tudo
- Prompts sempre em bloco único de código com botão de copiar
- Não quebrar módulos existentes
- Não inventar colunas ou tabelas fora do CONTEXT/BANCO.md
- Não recriar hooks existentes (useSupabaseQuery, useNFe, etc.)
- IA nunca executa ações automaticamente — apenas sugere e preenche
- Multi-tenant obrigatório: company_id em todos os inserts
- RLS via função auth_company_id() SECURITY DEFINER
- Nome padrão de quantidade: qty (nunca quantity)
- Quando receber arquivo de código, ler INTEIRO antes de sugerir solução
- Nunca perguntar credenciais do banco — estão neste arquivo

## DESIGN SYSTEM — CLINICAL PREMIUM
- Fonte: DM Sans
- Fundo: #FAFAF9
- Painéis: branco puro
- Cor destaque: Índigo #3B5BDB
- Ícones: lucide-react linha fina
- Zero emojis, zero gradientes, zero sombras pesadas
- Referência visual: Linear, Stripe, Vercel

## PERFIS DE USUÁRIO
- owner (Henrique): OwnerMeuDia
- vendedor: ActionCenter
- financeiro (Anna): AdminMeuDia
- logistica (Adriana): LogisticaMeuDia

## MÓDULOS E STATUS

### CONCLUÍDOS
- Login + Auth + Sidebar por perfil
- Clientes (listagem + ficha + busca CNPJ BrasilAPI + busca CEP ViaCEP)
- Produtos (com NCM)
- Compras (kanban + cotação + fornecedores)
- Estoque (posição + entradas XML + alertas)
- Financeiro (fluxo mensal + contas + DRE + projeção)
- Dashboard por perfil
- Tarefas
- NF-e Focus NFe (emissão 2 cliques + DANFE + status automático)
- Migração de dados Lovable → hh-controle-2 (sellers, clients, products, orders, order_items)
- Pedidos (duas abas: Orçamentos e Pedidos, modal completo 5 seções)
- Parcelamento no modal de pedidos (PaymentSection.tsx compartilhado, due_dates jsonb)

### EM ANDAMENTO
- Correções na ficha do cliente (ClientePage.tsx)

### FASE 1 PENDENTE (prazo 14/05/2026)
- Assistente IA comercial na ficha do cliente
- Fila inteligente de prioridades
- Radar da carteira
- Bipagem QR Code na saída do pedido
- Entrada de NF por XML com geração de contas a pagar
- Mural social + Stories
- Kanban de clientes inativos

### FASE 2 (maio-julho 2026)
- IA Central
- RH
- Portal do cliente
- Gamificação completa
- WhatsApp opt-in

### FASE 3 (agosto 2026+)
- SaaS multi-tenant
- Onboarding automatizado
- Billing Stripe

## FINALIZAÇÃO DE SESSÃO OBRIGATÓRIA
Ao receber comando "finalizar", atualizar CONTEXT/CORE.md com STATUS ATUAL (data, último concluído, em andamento, próximo passo) e CONTEXT/BANCO.md se houver mudanças estruturais.
