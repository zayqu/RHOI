-- RHOI baseline schema for Supabase PostgreSQL.
-- Money is stored as integer TZS to avoid floating-point errors.
create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'staff', 'auditor');
create type public.client_status as enum ('active', 'inactive', 'restricted', 'blacklisted');
create type public.loan_status as enum ('draft', 'active', 'overdue', 'settled', 'restructured', 'written_off', 'cancelled');
create type public.installment_status as enum ('upcoming', 'due_soon', 'due_today', 'partially_paid', 'paid', 'overdue', 'rescheduled', 'written_off', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'TZS',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  full_name text not null,
  role public.app_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_number text not null,
  full_name text not null,
  phone text not null,
  alternate_phone text,
  email text,
  id_type text,
  id_number text,
  date_of_birth date,
  address text,
  occupation text,
  monthly_income_tzs bigint check (monthly_income_tzs >= 0),
  next_of_kin jsonb not null default '{}'::jsonb,
  guarantor jsonb not null default '{}'::jsonb,
  notification_channel text not null default 'whatsapp',
  reminder_consent boolean not null default false,
  status public.client_status not null default 'active',
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, client_number),
  unique (organization_id, phone)
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  loan_number text not null,
  principal_tzs bigint not null check (principal_tzs > 0),
  interest_method text not null,
  annual_rate_basis_points integer not null default 0,
  fees_tzs bigint not null default 0 check (fees_tzs >= 0),
  total_repayable_tzs bigint not null check (total_repayable_tzs >= principal_tzs),
  disbursement_date date not null,
  first_repayment_date date not null,
  frequency text not null,
  installment_count integer not null check (installment_count > 0),
  penalty_config jsonb not null default '{}'::jsonb,
  purpose text,
  collateral text,
  status public.loan_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, loan_number)
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  loan_id uuid not null references public.loans(id),
  installment_number integer not null,
  due_date date not null,
  opening_balance_tzs bigint not null,
  principal_due_tzs bigint not null,
  interest_due_tzs bigint not null default 0,
  fees_due_tzs bigint not null default 0,
  penalty_due_tzs bigint not null default 0,
  amount_paid_tzs bigint not null default 0,
  status public.installment_status not null default 'upcoming',
  unique (loan_id, installment_number)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  loan_id uuid not null references public.loans(id),
  receipt_number text not null,
  amount_tzs bigint not null check (amount_tzs > 0),
  payment_at timestamptz not null,
  method text not null,
  provider text,
  transaction_reference text,
  notes text,
  recorded_by uuid not null references public.profiles(id),
  reversed_payment_id uuid references public.payments(id),
  reversal_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, receipt_number),
  unique nulls not distinct (organization_id, transaction_reference)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  installment_id uuid not null references public.installments(id),
  penalty_tzs bigint not null default 0,
  fees_tzs bigint not null default 0,
  interest_tzs bigint not null default 0,
  principal_tzs bigint not null default 0
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.clients(id),
  loan_id uuid references public.loans(id),
  channel text not null,
  outcome text,
  promise_amount_tzs bigint,
  promise_date date,
  next_action_at timestamptz,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.loans enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.follow_ups enable row level security;
alter table public.audit_log enable row level security;

create or replace function public.current_org_id() returns uuid language sql stable security definer
set search_path = public as $$ select organization_id from profiles where id = auth.uid() $$;
create or replace function public.current_role() returns public.app_role language sql stable security definer
set search_path = public as $$ select role from profiles where id = auth.uid() and active $$;

create policy "organization can read clients" on public.clients for select using (organization_id = public.current_org_id());
create policy "owner and staff manage clients" on public.clients for all using (organization_id = public.current_org_id() and public.current_role() in ('owner','staff')) with check (organization_id = public.current_org_id());
create policy "organization can read loans" on public.loans for select using (organization_id = public.current_org_id());
create policy "owner and staff manage loans" on public.loans for all using (organization_id = public.current_org_id() and public.current_role() in ('owner','staff')) with check (organization_id = public.current_org_id());
create policy "organization can read installments" on public.installments for select using (organization_id = public.current_org_id());
create policy "owner and staff manage installments" on public.installments for all using (organization_id = public.current_org_id() and public.current_role() in ('owner','staff')) with check (organization_id = public.current_org_id());
create policy "organization can read payments" on public.payments for select using (organization_id = public.current_org_id());
create policy "owner and staff create payments" on public.payments for insert with check (organization_id = public.current_org_id() and public.current_role() in ('owner','staff'));
create policy "organization can read followups" on public.follow_ups for select using (organization_id = public.current_org_id());
create policy "owner and staff manage followups" on public.follow_ups for all using (organization_id = public.current_org_id() and public.current_role() in ('owner','staff')) with check (organization_id = public.current_org_id());
create policy "owner and auditor read audit" on public.audit_log for select using (organization_id = public.current_org_id() and public.current_role() in ('owner','auditor'));

-- Payments intentionally have no UPDATE or DELETE policy. Corrections use reversals.
