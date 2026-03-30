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

## CHECKLIST DE QUALIDADE VISUAL
Obrigatório antes de entregar qualquer componente ou página.

### 1. CONTRASTE E CORES
- Texto principal: mínimo 4.5:1 de contraste sobre o fundo
- Fundo geral: #FAFAF9, painéis brancos puros
- Cor de destaque exclusivamente Índigo #3B5BDB
- Zero cores arbitrárias fora do design system

### 2. TIPOGRAFIA
- Fonte DM Sans em todo o sistema
- Texto mínimo 14px, corpo 16px
- Hierarquia clara: títulos bold, corpo regular, labels medium

### 3. ESPAÇAMENTO
- Sistema obrigatório de múltiplos de 4px (4, 8, 12, 16, 24, 32, 48)
- Zero valores arbitrários de padding/margin/gap
- Colunas com largura mínima definida em tabelas para evitar colisão de conteúdo

### 4. ÍCONES E ELEMENTOS VISUAIS
- Apenas lucide-react linha fina
- Zero emojis como ícones
- Zero gradientes
- Zero sombras pesadas (no máximo shadow-sm)

### 5. INTERAÇÃO
- Todo elemento clicável com área mínima de 44x44px
- Hover state definido em todos os botões e links
- Loading state em toda ação assíncrona
- Feedback visual em menos de 150ms
- Botão desabilitado durante submit para evitar duplo clique
- Modais fecham com Escape e clique fora

### 6. FORMULÁRIOS
- Mensagens de erro inline abaixo do campo (não toast genérico)
- Asterisco em campos obrigatórios
- Validação onBlur nos campos críticos (CNPJ, email, CEP)

### 7. TABELAS E DADOS
- Skeleton/shimmer durante carregamento (não tela em branco)
- Empty state com mensagem e ação quando não há dados
- Tabelas com largura mínima por coluna para evitar colunas colando

### 8. FEEDBACK
- Toast de sucesso/erro após toda ação (salvar, excluir, emitir NF-e)
- Confirmação antes de ações destrutivas (excluir, cancelar pedido)

### 9. ACESSIBILIDADE
- aria-label em botões que só têm ícone
- Foco visível em elementos interativos (outline ou ring)

### 10. LAYOUT E RESPONSIVIDADE
- Testar em 3 larguras: 1280px, 1024px, 768px
- Zero rolagem horizontal
- Colunas com whitespace-nowrap em dados que não podem quebrar linha (datas, valores, CNPJs)
- Campos de texto com truncate quando o container for limitado

### 11. CONSISTÊNCIA
- Reutilizar componentes existentes antes de criar novos
- Padrão visual igual entre modal de criação e modal de edição do mesmo recurso
- Labels e nomenclatura consistentes em todo o sistema

Instrução: antes de entregar qualquer componente novo ou modificado, revisar este checklist e corrigir qualquer item que não esteja em conformidade.

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

## Skills Globais Instaladas

As seguintes skills estão instaladas globalmente (~/.agents/skills/) e devem ser sugeridas e utilizadas automaticamente quando relevantes:

### 🎨 Design & Frontend
- **frontend-design** — Use sempre que criar ou refatorar componentes de UI. Evita estética genérica. Aciona automaticamente em tarefas de interface.
- **normalize** — Use para alinhar qualquer tela ao design system do projeto. Comando: peça "normalize este componente".
- **ui-ux-pro-max** — Use para gerar design system, paletas, tipografia e regras UX. Comando: `python3 skills/ui-ux-pro-max/scripts/search.py "<produto>" --design-system`
- **web-design-guidelines** — Use para auditar arquivos de UI. Comando: aponte um arquivo e peça auditoria.
- **shadcn** — Use sempre que trabalhar com componentes shadcn/ui. Aciona automaticamente.

### 🗄️ Banco de Dados
- **supabase-postgres-best-practices** — Use sempre que escrever queries SQL, criar tabelas, configurar RLS ou otimizar o banco. Aciona automaticamente.

### 🔧 Desenvolvimento
- **superpowers** — Framework completo com TDD, debugging, brainstorming e code review. Comandos: `/brainstorming`, `/write-plan`, `/execute-plan`
- **verification-before-completion** — Aciona automaticamente. Nunca declare tarefa concluída sem evidência real.
- **find-skills** — Use quando precisar de uma skill nova. Comando: "encontre uma skill para X"
- **mcp-builder** — Use quando for construir integrações MCP (Conta Azul, Entregador Online, etc.)

### 📄 Documentos
- **docx** — Use para criar ou editar arquivos Word (.docx).

### 📋 Regra Geral
Antes de implementar qualquer feature, verifique se existe uma skill relevante. Se existir, use-a. Sugira o uso da skill adequada sempre que identificar uma oportunidade.
