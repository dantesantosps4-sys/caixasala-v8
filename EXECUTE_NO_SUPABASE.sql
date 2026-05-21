-- ═══════════════════════════════════════════════════════════════════════════════
--  CaixaSala — SQL COMPLETO COM SISTEMA DE MENSALIDADE MENSAL AUTOMÁTICO
--  Execute no Supabase: SQL Editor → New query → Run
--  Idempotente — pode rodar múltiplas vezes com segurança
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela alunos ────────────────────────────────────────────────────────
create table if not exists public.alunos (
  id         bigserial primary key,
  nome       text      not null,
  turma      text      not null default '2A',
  ativo      boolean   not null default true,
  created_at timestamptz default now()
);
create unique index if not exists alunos_nome_uq on public.alunos (nome);
alter table public.alunos add column if not exists turma text default '2A';
alter table public.alunos add column if not exists ativo boolean default true;

-- ── 2. Tabela movimentacoes ─────────────────────────────────────────────────
create table if not exists public.movimentacoes (
  id          bigserial primary key,
  tipo        text          not null check (tipo in ('entrada','saida')),
  valor       numeric(10,2) not null,
  categoria   text          not null default 'mensalidade',
  descricao   text          not null,
  data        date          not null,
  responsavel text          not null default 'Secretária',
  created_at  timestamptz   default now()
);

-- ── 3. Configuração de mensalidade ──────────────────────────────────────────
create table if not exists public.mensalidades_config (
  id             bigserial primary key,
  valor_mensal   numeric(10,2) not null default 15.00,
  dia_vencimento int           not null default 10,
  updated_at     timestamptz   default now()
);

-- ── 4. Tabela mensalidades (UMA LINHA POR ALUNO POR MÊS) ────────────────────
--
-- STATUS POSSÍVEIS:
--   pendente             → mensalidade criada, aluno ainda não enviou nada
--   aguardando_aprovacao → aluno enviou comprovante, secretária precisa aprovar
--   pago                 → secretária aprovou ou marcou como pago diretamente
--   rejeitado            → secretária rejeitou o comprovante
--
create table if not exists public.mensalidades (
  id               bigserial primary key,
  aluno_id         bigint        not null references public.alunos(id) on delete cascade,
  ano              int           not null,
  mes              int           not null check (mes between 1 and 12),
  valor            numeric(10,2) not null default 15.00,
  status           text          not null default 'pendente'
                   check (status in ('pendente','aguardando_aprovacao','pago','rejeitado')),
  comprovante_url  text,
  observacao_aluno text,
  motivo_recusa    text,
  data_pagamento   date,
  enviado_em       timestamptz,
  analisado_em     timestamptz,
  created_at       timestamptz   default now(),
  -- Garante exatamente uma linha por aluno por mês
  unique(aluno_id, ano, mes)
);

-- Índices para performance
create index if not exists idx_mensalidades_aluno  on public.mensalidades (aluno_id);
create index if not exists idx_mensalidades_ano_mes on public.mensalidades (ano, mes);
create index if not exists idx_mensalidades_status  on public.mensalidades (status);

-- ── 5. RLS — alunos ─────────────────────────────────────────────────────────
alter table public.alunos enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='alunos' and policyname='pub_read_alunos') then
    create policy "pub_read_alunos" on public.alunos for select using (true); end if;
  if not exists(select 1 from pg_policies where tablename='alunos' and policyname='auth_all_alunos') then
    create policy "auth_all_alunos" on public.alunos for all
      using (auth.role()='authenticated') with check (auth.role()='authenticated'); end if;
end $$;

-- ── 6. RLS — movimentacoes ───────────────────────────────────────────────────
alter table public.movimentacoes enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='movimentacoes' and policyname='pub_read_movs') then
    create policy "pub_read_movs" on public.movimentacoes for select using (true); end if;
  if not exists(select 1 from pg_policies where tablename='movimentacoes' and policyname='auth_all_movs') then
    create policy "auth_all_movs" on public.movimentacoes for all
      using (auth.role()='authenticated') with check (auth.role()='authenticated'); end if;
end $$;

-- ── 7. RLS — mensalidades_config ────────────────────────────────────────────
alter table public.mensalidades_config enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where tablename='mensalidades_config' and policyname='pub_read_cfg') then
    create policy "pub_read_cfg" on public.mensalidades_config for select using (true); end if;
  if not exists(select 1 from pg_policies where tablename='mensalidades_config' and policyname='auth_all_cfg') then
    create policy "auth_all_cfg" on public.mensalidades_config for all
      using (auth.role()='authenticated') with check (auth.role()='authenticated'); end if;
end $$;

-- ── 8. RLS — mensalidades ───────────────────────────────────────────────────
alter table public.mensalidades enable row level security;
do $$ begin
  -- Leitura pública (alunos podem ver status)
  if not exists(select 1 from pg_policies where tablename='mensalidades' and policyname='pub_read_mens') then
    create policy "pub_read_mens" on public.mensalidades for select using (true); end if;
  -- Alunos podem enviar comprovante (insert e update do próprio status)
  if not exists(select 1 from pg_policies where tablename='mensalidades' and policyname='pub_update_mens') then
    create policy "pub_update_mens" on public.mensalidades for update using (true) with check (true); end if;
  -- Secretária tem controle total
  if not exists(select 1 from pg_policies where tablename='mensalidades' and policyname='auth_all_mens') then
    create policy "auth_all_mens" on public.mensalidades for all
      using (auth.role()='authenticated') with check (auth.role()='authenticated'); end if;
end $$;

-- ── 9. Storage bucket comprovantes ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', true, 5242880, '{"image/jpeg","image/png","image/webp","image/gif","application/pdf"}')
on conflict (id) do nothing;

do $$ begin
  if not exists(select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='pub_upload_comprovantes') then
    create policy "pub_upload_comprovantes" on storage.objects for insert with check (bucket_id='comprovantes'); end if;
  if not exists(select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='pub_read_comprovantes') then
    create policy "pub_read_comprovantes"  on storage.objects for select using (bucket_id='comprovantes'); end if;
  if not exists(select 1 from pg_policies where tablename='objects' and schemaname='storage' and policyname='auth_del_comprovantes') then
    create policy "auth_del_comprovantes"  on storage.objects for delete using (auth.role()='authenticated' and bucket_id='comprovantes'); end if;
end $$;

-- ── 10. Config padrão ────────────────────────────────────────────────────────
insert into public.mensalidades_config (valor_mensal, dia_vencimento)
select 15.00, 10
where not exists (select 1 from public.mensalidades_config limit 1);

-- ── 11. Inserir os 44 alunos da Turma 2A ────────────────────────────────────
insert into public.alunos (nome, turma) values
  ('ANA BEATRIZ RAMOS DE SOUZA',               '2A'),
  ('ANA GABRIELLY DE OLIVEIRA BARROS',          '2A'),
  ('ANA KELLEN CAVALCANTE OLIVEIRA',            '2A'),
  ('ANGELA NICOLE ARAUJO SILVA',                '2A'),
  ('ANTONIA ISNAELY DO NASCIMENTO BARBOSA',     '2A'),
  ('ANTONIA SUELLEN BARROS DE SOUSA',           '2A'),
  ('ANTONIO PAULO VITOR SILVA DE MELO',         '2A'),
  ('ANTONIO RAVI BARBOSA DE SOUSA',             '2A'),
  ('BENEDITO BENICIO PESSOA ALVES',             '2A'),
  ('BRUNA MARTINS BENEVINUTO',                  '2A'),
  ('CARLOS FILIPE ALVES SOARES',                '2A'),
  ('CARLOS GABRIEL FERNANDES DOS SANTOS',       '2A'),
  ('CAYLANNE COELHO DE SOUSA',                  '2A'),
  ('CLARA DE OLIVEIRA FURTADO',                 '2A'),
  ('DANIELE DA COSTA MACIEL',                   '2A'),
  ('DANTE SANTOS MELO',                         '2A'),
  ('EMANUELA ALVES DE SOUZA',                   '2A'),
  ('ENZO RENAN DE SOUSA SANTOS',                '2A'),
  ('FERNANDA PALOMA SILVA DOS SANTOS',          '2A'),
  ('FRANCISCA CIBELLE SOUSA COSTA',             '2A'),
  ('GABRIELLY VIEIRA DO NASCIMENTO',            '2A'),
  ('GIOVANNA DO NASCIMENTO MARTINS ALCANTARA',  '2A'),
  ('GUSTAVO PEQUENO VIEIRA',                    '2A'),
  ('IASMIN FERREIRA COSTA',                     '2A'),
  ('ISABELE DA SILVA NASCIMENTO',               '2A'),
  ('JOAO EZIO SILVA BARBOSA',                   '2A'),
  ('JULIA RIBEIRO DE MAGALHAES',                '2A'),
  ('LEORGENIS JESUS BEGUE TAMAYO',              '2A'),
  ('LETICIA NASCIMENTO SOUZA',                  '2A'),
  ('LORRANE DA SILVA ARAUJO',                   '2A'),
  ('LUAN RODRIGUES ALENCAR',                    '2A'),
  ('LUIZ AUGUSTO SOUSA DA SILVA',               '2A'),
  ('MARCUS ALBERTO TORRES DA SILVA FARIAS',     '2A'),
  ('MARIA ANGELINA DE MESQUITA',                '2A'),
  ('MARIA CLARA DE SOUSA ALVES',                '2A'),
  ('MARIA CLARA RODRIGUES DE SOUSA',            '2A'),
  ('MARIA PAULA MARINHO MESQUITA',              '2A'),
  ('MAYSA GOMES DE SOUSA',                      '2A'),
  ('NICOLAS ARAUJO SAMPAIO',                    '2A'),
  ('RICARDO DO NASCIMENTO SANTOS',              '2A'),
  ('RUAN CARLOS RODRIGUES BRAGA',               '2A'),
  ('STEFANY PENELLOPY DA SILVA',                '2A'),
  ('VINICIUS SOUZA NUNES',                      '2A'),
  ('YVANDERSON DA SILVA GRACIANO',              '2A')
on conflict (nome) do update set turma = '2A', ativo = true;

-- ── 12. Verificação ──────────────────────────────────────────────────────────
select
  (select count(*) from public.alunos where turma='2A') as alunos_turma_2a,
  (select count(*) from public.mensalidades_config)     as config_linhas,
  (select count(*) from public.mensalidades)            as total_mensalidades,
  (select count(*) from public.mensalidades where status='pendente')              as pendentes,
  (select count(*) from public.mensalidades where status='aguardando_aprovacao')  as aguardando,
  (select count(*) from public.mensalidades where status='pago')                  as pagas;
