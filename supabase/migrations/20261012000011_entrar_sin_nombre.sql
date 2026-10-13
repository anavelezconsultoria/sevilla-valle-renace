-- Entrar como ayudante ya registrado solo con celular + clave (sin nombre):
-- se conserva el nombre que ya tenia. Misma funcion de la migracion 0010.

create or replace function public.asegurar_perfil(p_alias text, p_celular text, p_clave text)
returns public.perfiles
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_celular text := public._normalizar_telefono(p_celular);
  v_alias text := nullif(btrim(coalesce(p_alias, '')), '');
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

  -- Sin nombre ("Ya ayude antes"): se conserva el del perfil que coincide o el propio.
  v_alias := coalesce(
    v_alias,
    (select alias from public.perfiles where id = any (coalesce(v_coinciden, '{}')) order by creado_en limit 1),
    (select alias from public.perfiles where id = v_uid)
  );
  if v_alias is null then
    raise exception 'No encontramos un perfil con ese celular y esa clave. Si es tu primera vez, elige "Es mi primera vez".' using errcode = 'P0001';
  end if;

  insert into public.perfiles (id, alias) values (v_uid, v_alias)
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

revoke execute on function public.asegurar_perfil(text, text, text) from public, anon;
grant execute on function public.asegurar_perfil(text, text, text) to authenticated;
