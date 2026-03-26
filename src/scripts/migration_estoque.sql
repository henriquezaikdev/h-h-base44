-- ─── Estoque: migration ────────────────────────────────────────────────────────
-- Run in Supabase SQL editor

-- 1. stock_movements
create table if not exists stock_movements (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  product_id  uuid not null references products(id),
  type        text not null check (type in ('ENTRADA', 'SAIDA', 'AJUSTE', 'xml_import')),
  quantity    numeric not null,
  reason      text not null,
  created_by  uuid references sellers(id),
  created_at  timestamptz not null default now()
);
alter table stock_movements enable row level security;
create policy "authenticated_all" on stock_movements
  for all to authenticated using (true) with check (true);

-- 2. stock_entries
create table if not exists stock_entries (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  supplier_name text,
  reference     text,
  entry_date    date,
  total_value   numeric not null default 0,
  status        text not null default 'RASCUNHO' check (status in ('LANCADA', 'RASCUNHO')),
  created_by    uuid references sellers(id),
  created_at    timestamptz not null default now()
);
alter table stock_entries enable row level security;
create policy "authenticated_all" on stock_entries
  for all to authenticated using (true) with check (true);

-- 3. stock_entry_items
create table if not exists stock_entry_items (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references stock_entries(id) on delete cascade,
  product_id uuid references products(id),
  quantity   numeric not null,
  unit_cost  numeric
);
alter table stock_entry_items enable row level security;
create policy "authenticated_all" on stock_entry_items
  for all to authenticated using (true) with check (true);

-- 4. fin_payables
create table if not exists fin_payables (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  description text,
  amount      numeric,
  due_date    date,
  status      text not null default 'pendente',
  origin      text,
  origin_id   uuid,
  created_at  timestamptz not null default now()
);
alter table fin_payables enable row level security;
create policy "authenticated_all" on fin_payables
  for all to authenticated using (true) with check (true);

-- 5. Add columns to purchase_requests (if not already present)
alter table purchase_requests add column if not exists origin     text;
alter table purchase_requests add column if not exists product_id uuid references products(id);
