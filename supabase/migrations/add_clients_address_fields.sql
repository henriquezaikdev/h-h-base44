-- Garante que todos os campos de endereço existem na tabela clients
alter table clients add column if not exists zip_code      text;
alter table clients add column if not exists street        text;
alter table clients add column if not exists street_number text;
alter table clients add column if not exists complement    text;
alter table clients add column if not exists neighborhood  text;

-- Outros campos do formulário de cliente
alter table clients add column if not exists ie             text;
alter table clients add column if not exists birthday_day   integer;
alter table clients add column if not exists birthday_month integer;
alter table clients add column if not exists unit_type      text;
alter table clients add column if not exists payment_term   text;
