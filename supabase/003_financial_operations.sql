-- Atomic payment recording, allocation, reversal-safe policies, and audit logging.

alter table public.payments
  add column if not exists unallocated_tzs bigint not null default 0
  check (unallocated_tzs >= 0);

drop policy if exists "owner and staff manage loans" on public.loans;
create policy "owner and staff create loans" on public.loans
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('owner', 'staff')
  );
create policy "owner and staff update loans" on public.loans
  for update using (
    organization_id = public.current_org_id()
    and public.current_role() in ('owner', 'staff')
  ) with check (organization_id = public.current_org_id());

drop policy if exists "owner and staff manage installments" on public.installments;
create policy "owner and staff create installments" on public.installments
  for insert with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('owner', 'staff')
  );
create policy "owner and staff update installments" on public.installments
  for update using (
    organization_id = public.current_org_id()
    and public.current_role() in ('owner', 'staff')
  ) with check (organization_id = public.current_org_id());

create or replace function public.create_loan_atomic(
  p_client_id uuid,
  p_loan_number text,
  p_principal_tzs bigint,
  p_interest_method text,
  p_annual_rate_basis_points integer,
  p_fees_tzs bigint,
  p_total_repayable_tzs bigint,
  p_disbursement_date date,
  p_first_repayment_date date,
  p_frequency text,
  p_schedule jsonb
)
returns table(loan_id uuid, loan_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_loan_id uuid;
  item jsonb;
begin
  if public.current_role() not in ('owner', 'staff') then
    raise exception 'Not authorized to create loans';
  end if;
  if p_principal_tzs <= 0 or jsonb_array_length(p_schedule) = 0 then
    raise exception 'Principal and repayment schedule are required';
  end if;
  select organization_id into v_org
  from public.clients
  where id = p_client_id and organization_id = public.current_org_id();
  if v_org is null then raise exception 'Client not found'; end if;

  insert into public.loans (
    organization_id, client_id, loan_number, principal_tzs, interest_method,
    annual_rate_basis_points, fees_tzs, total_repayable_tzs, disbursement_date,
    first_repayment_date, frequency, installment_count, status, created_by
  ) values (
    v_org, p_client_id, p_loan_number, p_principal_tzs, p_interest_method,
    p_annual_rate_basis_points, p_fees_tzs, p_total_repayable_tzs, p_disbursement_date,
    p_first_repayment_date, p_frequency, jsonb_array_length(p_schedule), 'active', auth.uid()
  ) returning id into v_loan_id;

  for item in select * from jsonb_array_elements(p_schedule)
  loop
    insert into public.installments (
      organization_id, loan_id, installment_number, due_date, opening_balance_tzs,
      principal_due_tzs, interest_due_tzs, fees_due_tzs, status
    ) values (
      v_org, v_loan_id, (item->>'number')::integer, (item->>'dueDate')::date,
      (item->>'openingBalance')::bigint, (item->>'principalDue')::bigint,
      (item->>'interestDue')::bigint, (item->>'feesDue')::bigint,
      case
        when (item->>'dueDate')::date < current_date then 'overdue'::public.installment_status
        when (item->>'dueDate')::date = current_date then 'due_today'::public.installment_status
        else 'upcoming'::public.installment_status
      end
    );
  end loop;

  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_org, auth.uid(), 'loan.created', 'loan', v_loan_id,
    jsonb_build_object('loan_number', p_loan_number, 'principal_tzs', p_principal_tzs, 'total_repayable_tzs', p_total_repayable_tzs));
  return query select v_loan_id, p_loan_number;
end;
$$;

revoke all on function public.create_loan_atomic(uuid,text,bigint,text,integer,bigint,bigint,date,date,text,jsonb) from public;
grant execute on function public.create_loan_atomic(uuid,text,bigint,text,integer,bigint,bigint,date,date,text,jsonb) to authenticated;

create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, before_data)
    values (old.organization_id, auth.uid(), lower(tg_table_name || '.' || tg_op), tg_table_name, old.id, to_jsonb(old));
    return old;
  end if;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    new.organization_id, auth.uid(), lower(tg_table_name || '.' || tg_op), tg_table_name, new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists audit_clients on public.clients;
create trigger audit_clients after insert or update on public.clients
for each row execute function public.audit_business_change();
drop trigger if exists audit_followups on public.follow_ups;
create trigger audit_followups after insert or update or delete on public.follow_ups
for each row execute function public.audit_business_change();

create or replace function public.record_payment_atomic(
  p_loan_id uuid,
  p_amount_tzs bigint,
  p_payment_at timestamptz,
  p_method text,
  p_provider text default null,
  p_transaction_reference text default null,
  p_notes text default null
)
returns table(payment_id uuid, receipt_number text, unallocated_tzs bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_payment_id uuid;
  v_receipt text;
  v_remaining bigint;
  v_take bigint;
  v_allocated bigint;
  v_penalty bigint;
  v_fees bigint;
  v_interest bigint;
  v_principal bigint;
  v_existing_penalty bigint;
  v_existing_fees bigint;
  v_existing_interest bigint;
  v_existing_principal bigint;
  v_total_due bigint;
  installment record;
begin
  if p_amount_tzs <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if public.current_role() not in ('owner', 'staff') then
    raise exception 'Not authorized to record payments';
  end if;

  select organization_id into v_org
  from public.loans
  where id = p_loan_id and organization_id = public.current_org_id()
  for update;
  if v_org is null then raise exception 'Loan not found'; end if;

  v_receipt := 'RCP-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 4));
  insert into public.payments (
    organization_id, loan_id, receipt_number, amount_tzs, payment_at,
    method, provider, transaction_reference, notes, recorded_by
  ) values (
    v_org, p_loan_id, v_receipt, p_amount_tzs, p_payment_at,
    p_method, p_provider, nullif(p_transaction_reference, ''), p_notes, auth.uid()
  ) returning id into v_payment_id;

  v_remaining := p_amount_tzs;
  for installment in
    select * from public.installments
    where loan_id = p_loan_id
    order by due_date, installment_number
    for update
  loop
    exit when v_remaining = 0;
    select
      coalesce(sum(penalty_tzs), 0), coalesce(sum(fees_tzs), 0),
      coalesce(sum(interest_tzs), 0), coalesce(sum(principal_tzs), 0)
    into v_existing_penalty, v_existing_fees, v_existing_interest, v_existing_principal
    from public.payment_allocations where installment_id = installment.id;

    v_penalty := least(v_remaining, greatest(installment.penalty_due_tzs - v_existing_penalty, 0));
    v_remaining := v_remaining - v_penalty;
    v_fees := least(v_remaining, greatest(installment.fees_due_tzs - v_existing_fees, 0));
    v_remaining := v_remaining - v_fees;
    v_interest := least(v_remaining, greatest(installment.interest_due_tzs - v_existing_interest, 0));
    v_remaining := v_remaining - v_interest;
    v_principal := least(v_remaining, greatest(installment.principal_due_tzs - v_existing_principal, 0));
    v_remaining := v_remaining - v_principal;
    v_allocated := v_penalty + v_fees + v_interest + v_principal;

    if v_allocated > 0 then
      insert into public.payment_allocations (
        payment_id, installment_id, penalty_tzs, fees_tzs, interest_tzs, principal_tzs
      ) values (v_payment_id, installment.id, v_penalty, v_fees, v_interest, v_principal);
      v_total_due := installment.penalty_due_tzs + installment.fees_due_tzs
        + installment.interest_due_tzs + installment.principal_due_tzs;
      update public.installments set
        amount_paid_tzs = amount_paid_tzs + v_allocated,
        status = case
          when amount_paid_tzs + v_allocated >= v_total_due then 'paid'::public.installment_status
          else 'partially_paid'::public.installment_status
        end
      where id = installment.id;
    end if;
  end loop;

  update public.payments set unallocated_tzs = v_remaining where id = v_payment_id;
  update public.loans set status = case
    when not exists (
      select 1 from public.installments
      where loan_id = p_loan_id
        and amount_paid_tzs < principal_due_tzs + interest_due_tzs + fees_due_tzs + penalty_due_tzs
    ) then 'settled'::public.loan_status
    else status
  end where id = p_loan_id;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_org, auth.uid(), 'payment.created', 'payment', v_payment_id,
    jsonb_build_object('amount_tzs', p_amount_tzs, 'receipt_number', v_receipt, 'unallocated_tzs', v_remaining));

  return query select v_payment_id, v_receipt, v_remaining;
end;
$$;

revoke all on function public.record_payment_atomic(uuid,bigint,timestamptz,text,text,text,text) from public;
grant execute on function public.record_payment_atomic(uuid,bigint,timestamptz,text,text,text,text) to authenticated;

create or replace function public.reverse_payment_atomic(
  p_payment_id uuid,
  p_reason text
)
returns table(reversal_id uuid, reversal_receipt text)
language plpgsql
security definer
set search_path = public
as $$
declare
  original record;
  v_reversal_id uuid;
  v_receipt text;
  allocation record;
  installment record;
  v_total_due bigint;
  v_new_paid bigint;
begin
  if public.current_role() not in ('owner', 'staff') then
    raise exception 'Not authorized to reverse payments';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A clear reversal reason is required';
  end if;

  select * into original from public.payments
  where id = p_payment_id and organization_id = public.current_org_id()
  for update;
  if original.id is null then raise exception 'Payment not found'; end if;
  if original.reversed_payment_id is not null then raise exception 'A reversal entry cannot be reversed'; end if;
  if exists (select 1 from public.payments where reversed_payment_id = original.id) then
    raise exception 'Payment has already been reversed';
  end if;

  v_receipt := 'REV-' || original.receipt_number;
  insert into public.payments (
    organization_id, loan_id, receipt_number, amount_tzs, payment_at, method,
    provider, notes, recorded_by, reversed_payment_id, reversal_reason
  ) values (
    original.organization_id, original.loan_id, v_receipt, original.amount_tzs,
    now(), original.method, original.provider, 'Reversal of ' || original.receipt_number,
    auth.uid(), original.id, trim(p_reason)
  ) returning id into v_reversal_id;

  for allocation in select * from public.payment_allocations where payment_id = original.id
  loop
    select * into installment from public.installments where id = allocation.installment_id for update;
    insert into public.payment_allocations (
      payment_id, installment_id, penalty_tzs, fees_tzs, interest_tzs, principal_tzs
    ) values (
      v_reversal_id, allocation.installment_id, -allocation.penalty_tzs,
      -allocation.fees_tzs, -allocation.interest_tzs, -allocation.principal_tzs
    );
    v_new_paid := greatest(0, installment.amount_paid_tzs -
      (allocation.penalty_tzs + allocation.fees_tzs + allocation.interest_tzs + allocation.principal_tzs));
    v_total_due := installment.penalty_due_tzs + installment.fees_due_tzs
      + installment.interest_due_tzs + installment.principal_due_tzs;
    update public.installments set
      amount_paid_tzs = v_new_paid,
      status = case
        when v_new_paid = 0 and due_date < current_date then 'overdue'::public.installment_status
        when v_new_paid = 0 and due_date = current_date then 'due_today'::public.installment_status
        when v_new_paid = 0 then 'upcoming'::public.installment_status
        when v_new_paid < v_total_due then 'partially_paid'::public.installment_status
        else 'paid'::public.installment_status
      end
    where id = allocation.installment_id;
  end loop;

  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, after_data)
  values (original.organization_id, auth.uid(), 'payment.reversed', 'payment', original.id,
    jsonb_build_object('reversal_id', v_reversal_id, 'reason', trim(p_reason)));
  update public.loans set status = 'active' where id = original.loan_id and status = 'settled';
  return query select v_reversal_id, v_receipt;
end;
$$;

revoke all on function public.reverse_payment_atomic(uuid,text) from public;
grant execute on function public.reverse_payment_atomic(uuid,text) to authenticated;
