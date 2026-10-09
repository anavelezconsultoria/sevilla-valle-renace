-- =============================================================================
-- Quien ayuda entra sin correo: alias publico + celular privado.
-- La sesion es anonima (Supabase Anonymous Sign-ins), asi que no se envian
-- correos ni se choca con el limite del SMTP incluido.
-- El celular vive en una tabla SIN politicas: nadie lo lee por la API.
-- =============================================================================

create table public.perfiles_privado (
  id uuid primary key references public.perfiles (id) on delete cascade,
  celular text not null check (celular ~ '^3[0-9]{9}$'),
  actualizado_en timestamptz not null default now()
);

alter table public.perfiles_privado enable row level security;
revoke all on public.perfiles_privado from anon, authenticated;

drop function if exists public.asegurar_perfil(text);

create or replace function public.asegurar_perfil(p_alias text, p_celular text)
returns public.perfiles
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
  v_celular text := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Debes identificarte.' using errcode = '28000';
  end if;
  if v_celular !~ '^3[0-9]{9}$' then
    raise exception 'Escribe un celular de 10 dígitos que empiece por 3.' using errcode = 'P0001';
  end if;

  insert into public.perfiles (id, alias) values (auth.uid(), btrim(p_alias))
  on conflict (id) do update set alias = excluded.alias
  returning * into v_perfil;

  insert into public.perfiles_privado (id, celular) values (v_perfil.id, v_celular)
  on conflict (id) do update set celular = excluded.celular, actualizado_en = now();

  return v_perfil;
end
$$;

revoke execute on function public.asegurar_perfil(text, text) from public, anon;
grant execute on function public.asegurar_perfil(text, text) to authenticated;
