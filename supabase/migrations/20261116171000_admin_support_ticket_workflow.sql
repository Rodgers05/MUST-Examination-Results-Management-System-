-- Allow administrators to triage and close support tickets with an audit trail.
create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_status text;
begin
  if not private.is_admin() then
    raise exception 'An active administrator account is required' using errcode = '42501';
  end if;
  if p_status not in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED') then
    raise exception 'Invalid support ticket status' using errcode = '22023';
  end if;

  select status into v_previous_status
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;

  update public.support_tickets
  set status = p_status
  where id = p_ticket_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    'SUPPORT_TICKET_STATUS_UPDATED',
    'support_ticket',
    p_ticket_id::text,
    jsonb_build_object('previous_status', v_previous_status, 'new_status', p_status)
  );
end;
$function$;

revoke all on function public.admin_update_support_ticket(uuid, text) from public, anon;
grant execute on function public.admin_update_support_ticket(uuid, text) to authenticated;
