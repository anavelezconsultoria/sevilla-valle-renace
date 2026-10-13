-- =============================================================================
-- Quien ayuda entra con celular + clave de 4 numeros. Si ese celular ya tiene
-- un perfil con clave y la clave coincide, el perfil de ESTE navegador se une
-- con el anterior: asi un mismo ayudante ve todo desde cualquier celular.
-- Solo el celular no basta: es un dato que circula (campanas, grupos) y daria
-- acceso a los contactos de las familias.
-- Perfiles viejos sin clave no se unen solos (nadie puede probar que son suyos):
-- su duenio crea la clave desde Mi panel con establecer_clave_ayudante().
-- =============================================================================

alter table public.perfiles_privado add column if not exists clave_hash text;

create table if not exists public.accesos_ayudante (
  celular text primary key,
  fallidos int not null default 0,
  bloqueado_hasta timestamptz
);
alter table public.accesos_ayudante enable row level security;
revoke all on public.accesos_ayudante from anon, authenticated;

/** Une perfiles en el perfil destino: necesidades, historial y rol. Borra los usuarios viejos. */
create or replace function public._unir_perfiles(p_destino uuid, p_origenes uuid[])
returns void language plpgsql volatile
set search_path = ''
as $$
begin
  if coalesce(array_length(p_origenes, 1), 0) = 0 then return; end if;
  if exists (select 1 from public.perfiles where id = any (p_origenes) and rol = 'coordinacion') then
    update public.perfiles set rol = 'coordinacion' where id = p_destino;
  end if;
  update public.necesidades set ayudante_id = p_destino where ayudante_id = any (p_origenes);
  update public.eventos_necesidad set actor_id = p_destino where actor_id = any (p_origenes);
  delete from auth.users where id = any (p_origenes);
end
$$;

/**
 * Identifica a quien ayuda. Devuelve el perfil, o NULL si el celular ya tiene
 * clave y la escrita no coincide (sin excepcion, para no deshacer el conteo).
 */
create or replace function public.asegurar_perfil(p_alias text, p_celular text, p_clave text)
returns public.perfiles
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_celular text := public._normalizar_telefono(p_celular);
  v_acceso public.accesos_ayudante;
  v_con_clave uuid[];
  v_coinciden uuid[];
  v_perfil public.perfiles;
begin
  if v_uid is null then
    raise exception 'Debes identificarte.' using errcode = '28000';
  end if;
  if v_celular !~ '^3[0-9]{9}$' then
    raise exception 'Escribe un celular de 10 dígitos que empiece por 3.' using errcode = 'P0001';
  end if;
  perform public._validar_clave(p_clave);
  if right(v_celular, 4) = p_clave then
    raise exception 'La clave no puede ser el final de tu celular. Elige otra.' using errcode = 'P0001';
  end if;

  select array_agg(pp.id) into v_con_clave
    from public.perfiles_privado pp
   where pp.celular = v_celular and pp.id <> v_uid and pp.clave_hash is not null;

  if v_con_clave is not null then
    select * into v_acceso from public.accesos_ayudante where celular = v_celular;
    if v_acceso.bloqueado_hasta is not null and v_acceso.bloqueado_hasta > now() then
      raise exception 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' using errcode = 'P0003';
    end if;
    select array_agg(pp.id) into v_coinciden
      from public.perfiles_privado pp
     where pp.id = any (v_con_clave) and pp.clave_hash = extensions.crypt(p_clave, pp.clave_hash);
    if v_coinciden is null then
      insert into public.accesos_ayudante (celular, fallidos) values (v_celular, 1)
      on conflict (celular) do update
        set fallidos = case when public.accesos_ayudante.fallidos >= 5 then 1 else public.accesos_ayudante.fallidos + 1 end,
            bloqueado_hasta = case when public.accesos_ayudante.fallidos + 1 = 5 then now() + interval '15 minutes' end;
      return null;
    end if;
    delete from public.accesos_ayudante where celular = v_celular;
  end if;

  insert into public.perfiles (id, alias) values (v_uid, btrim(p_alias))
  on conflict (id) do update set alias = excluded.alias
  returning * into v_perfil;

  insert into public.perfiles_privado (id, celular, clave_hash)
  values (v_uid, v_celular, extensions.crypt(p_clave, extensions.gen_salt('bf', 8)))
  on conflict (id) do update set celular = excluded.celular, clave_hash = excluded.clave_hash, actualizado_en = now();

  perform public._unir_perfiles(v_uid, v_coinciden);
  select * into v_perfil from public.perfiles where id = v_uid;
  return v_perfil;
end
$$;

/** Crea o cambia la clave del perfil de esta sesion (para perfiles sin clave). */
create or replace function public.establecer_clave_ayudante(p_clave text)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_celular text;
begin
  select celular into v_celular from public.perfiles_privado where id = v_perfil.id;
  perform public._validar_clave(p_clave);
  if right(coalesce(v_celular, ''), 4) = p_clave then
    raise exception 'La clave no puede ser el final de tu celular. Elige otra.' using errcode = 'P0001';
  end if;
  update public.perfiles_privado set clave_hash = extensions.crypt(p_clave, extensions.gen_salt('bf', 8)), actualizado_en = now()
   where id = v_perfil.id;
end
$$;

create or replace function public.tengo_clave_ayudante()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select clave_hash is not null from public.perfiles_privado where id = auth.uid()), false) $$;

revoke execute on function public._unir_perfiles(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.asegurar_perfil(text, text, text) from public, anon;
revoke execute on function public.establecer_clave_ayudante(text) from public, anon;
revoke execute on function public.tengo_clave_ayudante() from public, anon;
grant execute on function public.asegurar_perfil(text, text, text) to authenticated;
grant execute on function public.establecer_clave_ayudante(text) to authenticated;
grant execute on function public.tengo_clave_ayudante() to authenticated;
