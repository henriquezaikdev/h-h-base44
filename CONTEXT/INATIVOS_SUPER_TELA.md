# DOCUMENTO DE ESPECIFICAÇÃO
## Super Tela de Clientes Inativos + Game Layer + View Mode Toggle
**H&H Control 2.0 — Março 2026**

---

## 1. CONTEXTO E PROBLEMA A RESOLVER

O sistema já filtra clientes inativos. O que não existe ainda é:

1. Uma categoria de cliente que escapa da régua de inatividade padrão: o **Cliente de Janela Longa**
2. Uma tela de reativação que seja uma **ferramenta de batalha comercial real**, não só um Kanban
3. Um **sistema de game** que incentive o vendedor a resgatar clientes com base em resultado real (pedido gerado, não só ligação feita)
4. Um **modo de visualização interativo** alternativo ao modo padrão, com visual de alto impacto, animações e elementos de game visíveis

---

## 2. NOVA CATEGORIA: CLIENTE DE JANELA LONGA

### Definição
Cliente que compra com intervalo longo entre pedidos, mas que **sempre volta**. Não é inativo — é sazonal ou de baixa frequência estrutural.

### Critérios de classificação (calculado no banco)
- Intervalo médio de recompra **acima de 60 dias**
- Mínimo de **3 pedidos nos últimos 18 meses**
- Nenhum pedido nos últimos 90 dias (seria marcado como inativo sem essa flag)

### Comportamento no sistema
- Recebe flag `janela_longa = true` na tabela `clients`
- **Não entra** na fila de inativos
- **Não dispara** alertas de risco de perda
- **Não aparece** no Kanban de reativação
- Aparece em uma seção separada na Super Tela: **"Clientes em Silêncio Programado"**
- O vendedor vê o intervalo médio histórico daquele cliente e quando é esperada a próxima compra

### SQL necessário
```sql
-- Adicionar coluna na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS janela_longa boolean DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS intervalo_medio_dias integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proxima_compra_estimada date;

-- Lógica de cálculo (rodar via Edge Function ou cron)
-- Para cada cliente: calcular AVG(dias entre pedidos consecutivos)
-- Se AVG > 60 e COUNT(pedidos últimos 18 meses) >= 3 → janela_longa = true
-- proxima_compra_estimada = data_ultimo_pedido + intervalo_medio_dias
```

---

## 3. SUPER TELA DE CLIENTES INATIVOS — ARQUITETURA

### Rota
`/clientes/inativos`

### Estrutura da tela (layout de cima para baixo)

---

#### 3.1 CABEÇALHO — Painel de Guerra (sempre visível, fixo no topo)

Quatro métricas em tempo real:

| Métrica | Descrição |
|---|---|
| Total de Inativos | Clientes com status `inactive` sem flag `janela_longa` |
| Em Reativação | Clientes com tarefa de reativação aberta e status `at_risk` |
| Resgatados no Mês | Clientes que saíram do status `inactive` no mês corrente |
| Receita Recuperada | Soma dos pedidos aprovados de clientes reativados no mês (R$) |

**Regra:** Esses números atualizam em tempo real via Supabase Realtime subscription. Nenhum reload de página.

---

#### 3.2 BARRA DE PROGRESSO DA META MENSAL

- Meta configurável em `app_config` (ex: reativar 10 clientes por mês por vendedor)
- Barra horizontal com número atual / meta
- Texto dinâmico: "Faltam X clientes para bater a meta de reativação"
- No modo interativo: barra animada com gradiente de cor (vermelho → amarelo → verde conforme avança)

---

#### 3.3 FILA DE BATALHA — Lista ranqueada por score de reativação

**Não é Kanban.** É uma lista ordenada pelo backend com score calculado.

##### Score de Reativação (calculado no backend)
```
score = (valor_medio_mensal × 0.4) + (dias_inativo × 0.3) + (total_pedidos_historico × 0.2) + (sazonalidade_bonus × 0.1)
```

- `valor_medio_mensal`: quanto esse cliente valia por mês quando ativo
- `dias_inativo`: quanto tempo sem comprar (mais dias = mais urgente)
- `total_pedidos_historico`: clientes com mais histórico têm mais chance de retorno
- `sazonalidade_bonus`: se o cliente tinha padrão sazonal e estamos no período de pico dele

##### Cada card da fila contém:
- Nome do cliente + CNPJ
- Valor médio mensal histórico (ex: "Valia R$ 1.240/mês")
- Tempo inativo (ex: "87 dias sem comprar")
- Último produto comprado
- **Motivo de abordagem sugerido pela IA** (gerado via Edge Function `assistente-cliente`)
- Status atual do processo de reativação (Não iniciado / Tentativa feita / Negociando / Perdido)
- Botão de ação rápida: "Iniciar Reativação" → abre tarefa + registra primeiro contato

##### Hover no card (sem abrir nova página)
- Preview inline expande abaixo do card
- Mostra: últimos 5 pedidos, produtos recorrentes, memória comercial salva, campo para registrar observação rápida

---

#### 3.4 SEÇÃO SEPARADA — Clientes em Silêncio Programado

- Lista colapsável no final da tela
- Mostra clientes com `janela_longa = true`
- Para cada um: intervalo médio histórico + data estimada da próxima compra
- Se a data estimada já passou: alerta suave ("Janela de compra aberta — considere contato")

---

## 4. GAME LAYER — MECÂNICA DE RESGATE

### Regra fundamental
**O game só paga se o cliente gerar pedido aprovado.** Registrar ligação não conta. Isso alinha incentivo com resultado real.

### Elementos do game

#### 4.1 XP de Reativação
| Ação | XP |
|---|---|
| Cliente reativado com pedido até R$ 500 | 50 XP |
| Cliente reativado com pedido R$ 500–2.000 | 150 XP |
| Cliente reativado com pedido acima de R$ 2.000 | 300 XP |
| Reativar cliente que estava inativo há mais de 180 dias | Bônus +100 XP |

#### 4.2 Streak — Sequência Ativa
- Reativar clientes em dias úteis consecutivos multiplica o XP
- Streak de 3 dias: ×1.5 XP
- Streak de 5 dias: ×2.0 XP
- Streak quebrado: volta ao ×1.0 sem punição

#### 4.3 Badge "Resgatador"
- Desbloqueado ao reativar 5 clientes em um mês
- Badge "Resgatador Elite" ao reativar 10
- Aparece no perfil do vendedor e no mural da equipe

#### 4.4 Ranking de Reativação
- Visível na Super Tela (modo interativo: lateral animado)
- Filtrável por mês atual / últimos 3 meses
- Mostra: posição, nome, clientes reativados, receita recuperada

#### 4.5 Tabela de salvamento no banco
```sql
-- Registrar cada reativação
CREATE TABLE IF NOT EXISTS client_reativacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid REFERENCES clients(id),
  seller_id uuid REFERENCES sellers(id),
  data_reativacao timestamptz DEFAULT now(),
  valor_primeiro_pedido numeric,
  dias_inativo integer,
  xp_gerado integer,
  streak_dia integer,
  multiplicador numeric DEFAULT 1.0
);
```

---

## 5. VIEW MODE TOGGLE — MODO NORMAL vs MODO INTERATIVO

### Conceito
Dois modos coexistindo na mesma rota `/clientes/inativos`. O vendedor alterna com um botão. A preferência é salva por usuário no banco.

### Salvamento da preferência
```sql
-- Adicionar coluna na tabela sellers (ou app_config por usuário)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS ui_mode varchar(20) DEFAULT 'normal';
-- Valores: 'normal' | 'interativo'
```

---

### 5.1 MODO NORMAL

Design **Clinical Premium** padrão do sistema:
- Fundo `#FAFAF9`
- Painéis brancos com bordas leves
- Fonte DM Sans
- Cor de destaque Índigo `#3B5BDB`
- Sem animações pesadas
- Foco em densidade de informação e velocidade de leitura
- Idêntico ao restante do sistema

---

### 5.2 MODO INTERATIVO

**Direção visual:** Dark Command Center — sala de guerra comercial.

#### Paleta de cores (exclusiva deste modo)
```css
--bg-primary: #0A0A0F;        /* fundo quase preto, levemente azulado */
--bg-panel: #12121A;          /* painéis */
--bg-card: #1A1A26;           /* cards */
--border-subtle: #2A2A3E;     /* bordas */
--accent-indigo: #3B5BDB;     /* mantém o indigo da marca */
--accent-glow: #4C6EF5;       /* versão luminosa para glow */
--text-primary: #F0F0FF;      /* texto principal levemente azulado */
--text-secondary: #8888AA;    /* texto secundário */
--danger: #FF4444;            /* clientes críticos */
--warning: #FFB800;           /* clientes em atenção */
--success: #00D084;           /* clientes resgatados */
--streak-fire: #FF6B35;       /* cor do streak */
```

#### Efeitos visuais
- **Glow nos cards críticos:** `box-shadow: 0 0 20px rgba(255, 68, 68, 0.3)` pulsando suavemente via CSS keyframe
- **Borda animada nos cards de alta prioridade:** gradiente rotacionando na borda (conic-gradient animado)
- **Contador de receita em risco:** número grande no topo com fonte monospace, atualizando em tempo real
- **Partículas no resgate:** ao mover cliente para "Resgatado", micro-animação de partículas subindo (Canvas API, leve, pontual)
- **XP subindo na tela:** ao ganhar XP, número flutua para cima e some (CSS animation, 1.5s)
- **Streak counter com fogo:** ícone animado (Lottie ou CSS puro) quando streak está ativo

#### Interações
- **Drag & Drop:** arrastar card de "Não iniciado" → "Em Reativação" → "Resgatado"
  - Cada transição tem efeito visual distinto
  - "Resgatado" dispara animação + XP + som (opcional, ativável nas configurações)
- **Hover expansível:** hover no card expande inline com preview completo do cliente (sem modal, sem nova página)
- **Radar da Carteira animado:** versão animada do radar já existente, com anéis girando suavemente e pontos pulsando por risco

#### Componentes específicos do Modo Interativo

**Streak Counter (canto superior direito)**
```
🔥 Sequência Ativa: 3 dias
    Multiplicador: ×1.5 XP
```
Fogo animado quando ativo. Cinza quando sem streak.

**Progress Bar da Meta**
```
[████████░░░░░░░░] 8 / 15 clientes
Faltam 7 para bater a meta de março
```
Gradiente animado: vermelho → amarelo → verde conforme avança. Pulsa suavemente.

**Ranking Lateral (colapsável)**
Mini-tabela com posição, avatar, nome, número de reativações do mês.

---

## 6. CONEXÃO COM MEU DIA DO VENDEDOR

### Bloco fixo no MeuDia: "Carteira em Risco"

- Aparece sempre no Meu Dia do Vendedor, independente do modo
- Mostra os **3 clientes inativos de maior score** ainda não tocados
- Para cada um: nome, valor histórico, tempo inativo, botão "Iniciar"
- Clicar em "Iniciar" → navega para `/clientes/inativos` já filtrado naquele cliente com o card expandido

### Notificação inteligente no Meu Dia
- Se o vendedor tem meta de reativação configurada e está abaixo de 50% no meio do mês: banner de alerta no topo do Meu Dia
- "Você está a X clientes de bater a meta de reativação. Sua fila tem Y oportunidades."

---

## 7. EDGE FUNCTIONS NECESSÁRIAS

### 7.1 `calcular-score-reativacao`
- Calcula score para todos os clientes inativos
- Atualiza coluna `reativacao_score` na tabela `clients`
- Roda via cron diariamente (meia-noite)
- Também roda on-demand quando vendedor abre a Super Tela

### 7.2 `classificar-janela-longa`
- Calcula intervalo médio de recompra por cliente
- Seta `janela_longa = true/false` e `intervalo_medio_dias`
- Calcula `proxima_compra_estimada`
- Roda junto com o cron de score

### 7.3 `registrar-reativacao`
- Chamada quando pedido aprovado de cliente inativo é detectado
- Calcula XP com multiplicador de streak
- Insere em `client_reativacoes`
- Dispara post no mural se badge desbloqueado

---

## 8. COLUNAS NOVAS NECESSÁRIAS NO BANCO

```sql
-- Tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS janela_longa boolean DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS intervalo_medio_dias integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proxima_compra_estimada date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reativacao_score numeric DEFAULT 0;

-- Tabela sellers
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS ui_mode varchar(20) DEFAULT 'normal';

-- Nova tabela
CREATE TABLE IF NOT EXISTS client_reativacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid REFERENCES clients(id),
  seller_id uuid REFERENCES sellers(id),
  data_reativacao timestamptz DEFAULT now(),
  valor_primeiro_pedido numeric,
  dias_inativo integer,
  xp_gerado integer,
  streak_dia integer,
  multiplicador numeric DEFAULT 1.0
);
```

---

## 9. ORDEM DE EXECUÇÃO (SEQUÊNCIA CORRETA)

**Regra de ouro:** Dado correto antes de design. Modo Normal funcionando antes de Modo Interativo.

```
1. SQL — Adicionar colunas em clients e sellers
2. SQL — Criar tabela client_reativacoes
3. Edge Function — calcular-score-reativacao (lógica + cron)
4. Edge Function — classificar-janela-longa (lógica + cron)
5. Componente — Super Tela Modo Normal (100% funcional, sem animações)
6. Integração — Bloco "Carteira em Risco" no MeuDia do Vendedor
7. Teste — Validar dados, score, fila ranqueada com a equipe
8. Componente — View Mode Toggle (botão + salvar preferência no banco)
9. Componente — Super Tela Modo Interativo (dark theme + animações)
10. Edge Function — registrar-reativacao (XP + streak + badge)
11. Componente — Game Layer visível (streak, progress bar, ranking)
12. Teste final — Validar game, animações, conexão com MeuDia
```

---

## 10. DEPENDÊNCIAS TÉCNICAS

| Dependência | Uso | Já instalado? |
|---|---|---|
| `framer-motion` | Animações de cards, drag & drop, transições | Verificar |
| Supabase Realtime | Atualização em tempo real das métricas | Já configurado |
| Canvas API | Partículas no resgate (nativo do browser) | Nativo |
| CSS Keyframes | Glow pulsante, borda animada | Nativo |
| `@dnd-kit/core` | Drag & Drop acessível e performático | Verificar |

---

## 11. REGRAS DE NEGÓCIO CONSOLIDADAS

- Cliente `janela_longa = true` **nunca** aparece na fila de inativos
- Score de reativação é recalculado diariamente via cron
- XP de reativação **só é pago** quando pedido aprovado é detectado para cliente que estava `inactive`
- Streak conta apenas dias úteis (segunda a sexta)
- Toggle de modo salva preferência por `seller_id`, não por sessão
- Modo Interativo não substitui o Modo Normal — ambos mostram os mesmos dados
- A IA sugere abordagem, o vendedor executa — a IA não registra nada sozinha
- Virtualização de lista obrigatória: renderizar máximo 50 cards por vez mesmo com 500 inativos
- RLS: vendedor vê apenas clientes da sua carteira; owner vê todos

---

*Documento gerado em março de 2026 — H&H Control 2.0*
*Para uso no chat ativo do projeto. Colar como contexto antes de qualquer prompt de execução.*
