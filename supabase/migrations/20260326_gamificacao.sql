-- =============================================================================
-- GAMIFICAÇÃO — Tabelas para Evolução do Vendedor
-- H&H Control 2.0 — 26/03/2026
-- =============================================================================

-- 1. SELLER LEVELS — nível atual do vendedor (ovo/pena/aguia)
CREATE TABLE IF NOT EXISTS seller_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  current_level text NOT NULL DEFAULT 'ovo' CHECK (current_level IN ('ovo', 'pena', 'aguia')),
  monthly_sales_target numeric NOT NULL DEFAULT 30000,
  daily_calls_target integer NOT NULL DEFAULT 18,
  base_daily_calls integer DEFAULT 18,
  base_daily_whatsapp integer DEFAULT 15,
  consecutive_months_met integer NOT NULL DEFAULT 0,
  consecutive_months_missed integer NOT NULL DEFAULT 0,
  commission_bonus numeric NOT NULL DEFAULT 0,
  errors_this_month integer NOT NULL DEFAULT 0,
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

-- 2. SELLER ERRORS — erros operacionais do vendedor (máx 3/mês)
CREATE TABLE IF NOT EXISTS seller_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  month integer NOT NULL,
  year integer NOT NULL,
  error_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  registered_by uuid REFERENCES sellers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. SELLER STARS — estrelas acumuladas do vendedor
CREATE TABLE IF NOT EXISTS seller_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  bronze integer NOT NULL DEFAULT 0,
  prata integer NOT NULL DEFAULT 0,
  ouro integer NOT NULL DEFAULT 0,
  total_stars integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

-- 4. WORK MONTH CONFIG — configuração de dias úteis por mês
CREATE TABLE IF NOT EXISTS work_month_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  year_month text NOT NULL, -- formato: '2026-03'
  working_days integer NOT NULL DEFAULT 22,
  operational_start_date date, -- primeiro dia operacional do mês
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, year_month)
);

-- 5. INTERACTIONS — registro de ligações e whatsapp
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  responsible_seller_id uuid NOT NULL REFERENCES sellers(id),
  client_id uuid REFERENCES clients(id),
  interaction_type text NOT NULL CHECK (interaction_type IN ('ligacao', 'whatsapp', 'email', 'visita', 'outro')),
  interaction_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- RLS — Row Level Security
-- =============================================================================

ALTER TABLE seller_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_stars ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_month_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Policies usando auth_company_id()
CREATE POLICY "seller_levels_company" ON seller_levels
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "seller_errors_company" ON seller_errors
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "seller_stars_company" ON seller_stars
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "work_month_config_company" ON work_month_config
  FOR ALL USING (company_id = auth_company_id());

CREATE POLICY "interactions_company" ON interactions
  FOR ALL USING (company_id = auth_company_id());

-- =============================================================================
-- DADOS INICIAIS — vendedores da H&H (company_id = 00000000-0000-0000-0000-000000000001)
-- =============================================================================

-- Inserir níveis iniciais para todos os vendedores ativos
-- Joésio, Murilo, Nayara, Cláudio começam como 'ovo'
-- IDs dos sellers serão inseridos manualmente após verificar no banco

-- INSERT INTO seller_levels (company_id, seller_id, current_level, monthly_sales_target)
-- SELECT
--   '00000000-0000-0000-0000-000000000001',
--   id,
--   'ovo',
--   30000
-- FROM sellers
-- WHERE company_id = '00000000-0000-0000-0000-000000000001'
-- AND role = 'seller'
-- AND (status = 'ATIVO' OR status IS NULL)
-- ON CONFLICT (seller_id) DO NOTHING;

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_seller_levels_seller ON seller_levels(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_errors_seller_month ON seller_errors(seller_id, year, month);
CREATE INDEX IF NOT EXISTS idx_seller_stars_seller ON seller_stars(seller_id);
CREATE INDEX IF NOT EXISTS idx_work_month_config_ym ON work_month_config(company_id, year_month);
CREATE INDEX IF NOT EXISTS idx_interactions_seller_date ON interactions(responsible_seller_id, interaction_date);
CREATE INDEX IF NOT EXISTS idx_interactions_client ON interactions(client_id);
