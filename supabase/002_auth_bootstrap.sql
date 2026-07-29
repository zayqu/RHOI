-- Run after schema.sql. Creates the first owner profile automatically at sign-up.

create policy "users can read own profile"
on public.profiles for select
using (id = auth.uid());

create policy "owners can read organization profiles"
on public.profiles for select
using (
  organization_id = public.current_org_id()
  and public.current_role() = 'owner'
);

create policy "users can update own name"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and organization_id = public.current_org_id());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'organization_name', 'RHOI'))
  returning id into new_organization_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    new_organization_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update on public.clients to authenticated;
grant select, insert, update on public.loans to authenticated;
grant select, insert, update on public.installments to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert on public.payment_allocations to authenticated;
grant select, insert, update, delete on public.follow_ups to authenticated;
grant select on public.audit_log to authenticated;
