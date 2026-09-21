-- ============================================================
--  KNO — Construtora e Incorporadora
--  Schema do Supabase: empreendimentos, unidades e leads
--
--  Como aplicar: Supabase → SQL Editor → cole este arquivo inteiro → Run.
--  Pode rodar mais de uma vez: tudo é idempotente (if not exists / drop policy).
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
--  1. TABELAS
-- ============================================================

create table if not exists public.empreendimentos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  bairro      text,
  cidade      text,
  descricao   text,
  capa_url    text,
  status      text not null default 'lancamento'
              check (status in ('lancamento', 'em_obras', 'pronto')),
  criado_em   timestamptz not null default now()
);

comment on table public.empreendimentos is 'Empreendimentos da KNO (condomínios, prédios, loteamentos).';

create table if not exists public.unidades (
  id                uuid primary key default gen_random_uuid(),
  empreendimento_id uuid references public.empreendimentos(id) on delete set null,
  tipo              text not null default 'casa'
                    check (tipo in ('casa', 'apartamento')),
  titulo            text not null,
  preco             numeric(12,2),
  quartos           integer not null default 0,
  suites            integer not null default 0,
  banheiros         integer not null default 0,
  vagas             integer not null default 0,
  area_m2           numeric(10,2),
  descricao         text,
  fotos             text[] not null default '{}',
  status            text not null default 'disponivel'
                    check (status in ('disponivel', 'reservado', 'vendido')),
  destaque          boolean not null default false,
  criado_em         timestamptz not null default now()
);

comment on table public.unidades is 'Unidades à venda. A primeira posição de "fotos" é usada como capa.';

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null,
  whatsapp    text,
  mensagem    text,
  unidade_id  uuid references public.unidades(id) on delete set null,
  criado_em   timestamptz not null default now()
);

comment on table public.leads is 'Contatos recebidos pelo site. unidade_id preenchido quando vem da ficha de um imóvel.';

-- Índices para as consultas que o site realmente faz
create index if not exists unidades_empreendimento_idx on public.unidades (empreendimento_id);
create index if not exists unidades_destaque_idx       on public.unidades (destaque) where destaque;
create index if not exists unidades_status_idx         on public.unidades (status);
create index if not exists leads_criado_em_idx         on public.leads (criado_em desc);

-- ============================================================
--  2. ROW LEVEL SECURITY
--  Regra geral: catálogo é público para leitura; só quem estiver
--  autenticado escreve. Leads são o inverso: qualquer visitante
--  insere, mas só autenticado consegue ler.
-- ============================================================

alter table public.empreendimentos enable row level security;
alter table public.unidades        enable row level security;
alter table public.leads           enable row level security;

-- ---------- empreendimentos ----------
drop policy if exists "empreendimentos: leitura publica"     on public.empreendimentos;
drop policy if exists "empreendimentos: escrita autenticada" on public.empreendimentos;

create policy "empreendimentos: leitura publica"
  on public.empreendimentos for select
  to anon, authenticated
  using (true);

create policy "empreendimentos: escrita autenticada"
  on public.empreendimentos for all
  to authenticated
  using (true)
  with check (true);

-- ---------- unidades ----------
drop policy if exists "unidades: leitura publica"     on public.unidades;
drop policy if exists "unidades: escrita autenticada" on public.unidades;

create policy "unidades: leitura publica"
  on public.unidades for select
  to anon, authenticated
  using (true);

create policy "unidades: escrita autenticada"
  on public.unidades for all
  to authenticated
  using (true)
  with check (true);

-- ---------- leads ----------
drop policy if exists "leads: insert publico"      on public.leads;
drop policy if exists "leads: leitura autenticada" on public.leads;

create policy "leads: insert publico"
  on public.leads for insert
  to anon, authenticated
  with check (true);

create policy "leads: leitura autenticada"
  on public.leads for select
  to authenticated
  using (true);

-- Sem policy de update/delete em leads: ninguém altera ou apaga pelo site.

-- ============================================================
--  2b. PRIVILÉGIOS DE TABELA
--
--  O RLS decide QUAIS LINHAS cada um enxerga; os privilégios abaixo
--  decidem se o papel sequer pode tocar na tabela. As duas camadas
--  precisam liberar.
--
--  Isto aqui deixa o script independente da opção "Automatically expose
--  new tables" que aparece na criação do projeto: com ela ligada ou
--  desligada, o resultado final é exatamente o mesmo.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- zera e reconcede, para o resultado não depender do que veio por padrão
revoke all on public.empreendimentos from anon, authenticated;
revoke all on public.unidades        from anon, authenticated;
revoke all on public.leads           from anon, authenticated;

-- catálogo: visitante lê, equipe escreve
grant select                         on public.empreendimentos to anon, authenticated;
grant insert, update, delete         on public.empreendimentos to authenticated;

grant select                         on public.unidades        to anon, authenticated;
grant insert, update, delete         on public.unidades        to authenticated;

-- leads: visitante só envia, equipe só lê
grant insert                         on public.leads           to anon, authenticated;
grant select                         on public.leads           to authenticated;

-- ============================================================
--  3. STORAGE (fotos dos imóveis)
--  Bucket público: as fotos aparecem no site sem token.
--  O upload continua restrito a usuários autenticados.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('imoveis', 'imoveis', true)
on conflict (id) do update set public = true;

drop policy if exists "imoveis: leitura publica"  on storage.objects;
drop policy if exists "imoveis: upload auth"      on storage.objects;
drop policy if exists "imoveis: update auth"      on storage.objects;
drop policy if exists "imoveis: delete auth"      on storage.objects;

create policy "imoveis: leitura publica"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'imoveis');

create policy "imoveis: upload auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'imoveis');

create policy "imoveis: update auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'imoveis')
  with check (bucket_id = 'imoveis');

create policy "imoveis: delete auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'imoveis');

-- ============================================================
--  4. DADOS DE EXEMPLO (opcional)
--  Descomente para ver o site preenchido antes de cadastrar de verdade.
-- ============================================================

-- insert into public.empreendimentos (nome, bairro, cidade, descricao, status) values
--   ('Residencial Aurora', 'Jardim Europa', 'Sua Cidade', 'Condomínio fechado com 14 casas de alto padrão.', 'em_obras'),
--   ('Edifício Ventura',   'Centro',        'Sua Cidade', 'Apartamentos de 2 e 3 dormitórios com lazer completo.', 'lancamento');
--
-- insert into public.unidades (empreendimento_id, tipo, titulo, preco, quartos, suites, banheiros, vagas, area_m2, descricao, status, destaque)
-- select e.id, 'casa', 'Casa 03 — Residencial Aurora', 890000, 3, 1, 3, 2, 178,
--        'Casa térrea com suíte master, varanda gourmet e quintal.', 'disponivel', true
--   from public.empreendimentos e where e.nome = 'Residencial Aurora';
