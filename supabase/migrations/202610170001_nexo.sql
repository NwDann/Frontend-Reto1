-- Run once with a database owner in Supabase SQL Editor.
-- Separate nexo_* tables. This does not modify the hackathon's existing tables.
begin;
create table public.nexo_workspaces (
 id uuid primary key, name text not null check(length(name) between 1 and 100),
 owner_id uuid not null references auth.users(id), data jsonb not null,
 revision bigint not null default 0, updated_at timestamptz not null default now()
);
create table public.nexo_memberships (
 workspace_id uuid references public.nexo_workspaces(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','gerencia','logistica','bodega','compras','consulta')),
 primary key(workspace_id,user_id)
);
create table public.nexo_documents (
 id uuid primary key, workspace_id uuid not null references public.nexo_workspaces(id) on delete cascade,
 object_key text unique not null,name text not null,content_type text not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.nexo_audit (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.nexo_workspaces(id) on delete cascade,
 actor uuid not null references auth.users(id),action text not null,revision bigint not null,created_at timestamptz not null default now()
);
create index nexo_memberships_user on public.nexo_memberships(user_id);
create index nexo_audit_workspace on public.nexo_audit(workspace_id,created_at);
alter table public.nexo_workspaces enable row level security;
alter table public.nexo_memberships enable row level security;
alter table public.nexo_documents enable row level security;
alter table public.nexo_audit enable row level security;
-- Browser users cannot bypass server validation by updating the JSON directly.
revoke all on public.nexo_workspaces,public.nexo_memberships,public.nexo_documents,public.nexo_audit from anon,authenticated;
grant all on public.nexo_workspaces,public.nexo_memberships,public.nexo_documents,public.nexo_audit to service_role;
grant usage,select on sequence public.nexo_audit_id_seq to service_role;
create function public.nexo_create_workspace(p_id uuid,p_owner uuid,p_name text,p_data jsonb) returns void language plpgsql security invoker set search_path=public as $$
begin
 if (select count(*) from nexo_memberships where user_id=p_owner and role='owner')>=30 then raise exception 'Workspace limit'; end if;
 if p_data->'company'->>'id' is distinct from p_id::text then raise exception 'Company mismatch';end if;
 insert into nexo_workspaces(id,name,owner_id,data) values(p_id,p_name,p_owner,p_data);
 insert into nexo_memberships values(p_id,p_owner,'owner');
 insert into nexo_audit(workspace_id,actor,action,revision) values(p_id,p_owner,'workspace.create',0);
end $$;
create function public.nexo_commit(p_workspace uuid,p_actor uuid,p_revision bigint,p_data jsonb,p_action text) returns boolean language plpgsql security invoker set search_path=public as $$
declare changed integer; actor_role text;
begin
 perform 1 from nexo_workspaces where id=p_workspace for update;
 select role into actor_role from nexo_memberships where workspace_id=p_workspace and user_id=p_actor;
 if actor_role is null then raise exception 'Access denied';end if;
 if actor_role not in ('owner','admin') and not (
 actor_role='gerencia' and p_action=any(array['finance.update','profile.update','alert.review']) or
 actor_role='logistica' and p_action=any(array['route.create','route.status','logistics.update','point.create','point.update','location.contact','warehouse.update','movement.locations','dispatch.create','dispatch.responsibility','vehicle.save','staff.save','fleet.cost','trip.create','toll.save','alert.review']) or
 actor_role='bodega' and p_action=any(array['item.create','item.update','history.import','purchase.receive','dispatch.create','dispatch.receive','dispatch.responsibility','stock.transfer','movement.locations','alert.review']) or
 actor_role='compras' and p_action=any(array['purchase.create','purchase.status','supplier.create','supplier.details','supplier.catalog','supplier.evaluate','alert.review'])
 ) then raise exception 'Action denied';end if;
 if p_data->'company'->>'id' is distinct from p_workspace::text then raise exception 'Company mismatch';end if;
 update nexo_workspaces set data=p_data,revision=revision+1,updated_at=now() where id=p_workspace and revision=p_revision;
 get diagnostics changed=row_count;
 if changed=0 then return false;end if;
 insert into nexo_audit(workspace_id,actor,action,revision) values(p_workspace,p_actor,p_action,p_revision+1);
 return true;
end $$;
create function public.nexo_find_user(p_email text) returns table(id uuid) language sql security definer set search_path='' as $$select id from auth.users where lower(email)=lower(p_email) and email_confirmed_at is not null limit 1$$;
create function public.nexo_list_members(p_workspace uuid) returns table(user_id uuid,email varchar,role text) language sql security definer set search_path='' as $$select m.user_id,u.email,m.role from public.nexo_memberships m join auth.users u on u.id=m.user_id where m.workspace_id=p_workspace order by u.email$$;
create function public.nexo_set_member(p_workspace uuid,p_actor uuid,p_target uuid,p_role text) returns void language plpgsql security invoker set search_path=public as $$
declare actor_role text; target_role text;
begin
 -- Serialize team changes with workspace mutations, including owner checks.
 perform 1 from nexo_workspaces where id=p_workspace for update;
 select role into actor_role from nexo_memberships where workspace_id=p_workspace and user_id=p_actor;
 select role into target_role from nexo_memberships where workspace_id=p_workspace and user_id=p_target;
 if actor_role is null or actor_role not in ('owner','admin') then raise exception 'Access denied';end if;
 if p_actor=p_target or target_role='owner' then raise exception 'Owner/self access cannot be changed here';end if;
 if actor_role='admin' and (p_role='admin' or target_role='admin') then raise exception 'Only owner can manage admins';end if;
 if p_role is null then delete from nexo_memberships where workspace_id=p_workspace and user_id=p_target;
 elsif p_role in ('admin','gerencia','logistica','bodega','compras','consulta') then
 insert into nexo_memberships values(p_workspace,p_target,p_role) on conflict(workspace_id,user_id) do update set role=excluded.role;
 else raise exception 'Invalid role';end if;
 insert into nexo_audit(workspace_id,actor,action,revision) select p_workspace,p_actor,'member.'||coalesce(p_role,'remove'),revision from nexo_workspaces where id=p_workspace;
end $$;
revoke all on function public.nexo_create_workspace(uuid,uuid,text,jsonb),public.nexo_commit(uuid,uuid,bigint,jsonb,text),public.nexo_find_user(text),public.nexo_list_members(uuid),public.nexo_set_member(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.nexo_create_workspace(uuid,uuid,text,jsonb),public.nexo_commit(uuid,uuid,bigint,jsonb,text),public.nexo_find_user(text),public.nexo_list_members(uuid),public.nexo_set_member(uuid,uuid,uuid,text) to service_role;
-- Private object storage: accessed only through the authenticated companion server.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nexo-documents','nexo-documents',false,8388608,array['application/pdf','text/csv','application/json','text/plain','image/png','image/jpeg']) on conflict(id) do nothing;
commit;
