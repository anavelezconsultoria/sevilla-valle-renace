-- =============================================================================
-- Sin duplicados: con mala senal la gente toca "Registrar" varias veces y se
-- creaban 3 solicitudes iguales en segundos. Si el mismo celular registra el
-- mismo titulo y la misma descripcion en menos de 30 minutos, se rechaza.
-- (Misma funcion de la migracion 0005 + la verificacion de duplicado.)
-- =============================================================================

create or replace function public._ventana_duplicados() returns interval language sql immutable as $$ select interval '30 minutes' $$;

create or replace function public.registrar_necesidad(
  p_categoria public.categoria_necesidad,
  p_titulo text,
  p_descripcion text,
  p_urgencia public.urgencia_necesidad,
  p_personas_hogar int,
  p_sector text,
  p_lat double precision,
  p_lng double precision,
  p_nombre text,
  p_telefono text,
  p_clave text,
  p_referencias text default '',
  p_prioridad_cero boolean default false
) returns table (necesidad_id uuid, codigo text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_codigo text;
  v_id uuid;
  v_aprox record;
  v_acceso public.accesos_solicitante;
begin
  perform public._validar_clave(p_clave);
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final de tu celular. Elige otra.' using errcode = 'P0001';
  end if;

  -- Si el celular ya tiene clave, debe ser la misma. Un fallo NO lanza excepcion
  -- (desharia el conteo de intentos): devuelve una fila con necesidad_id nulo.
  if exists (select 1 from public.necesidades_privado pr where pr.telefono = v_telefono and pr.clave_hash is not null) then
    select * into v_acceso from public.accesos_solicitante where telefono = v_telefono;
    if v_acceso.bloqueado_hasta is not null and v_acceso.bloqueado_hasta > now() then
      raise exception 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' using errcode = 'P0003';
    end if;
    if not exists (
      select 1 from public.necesidades_privado pr
       where pr.telefono = v_telefono and pr.clave_hash = extensions.crypt(p_clave, pr.clave_hash)
    ) then
      insert into public.accesos_solicitante (telefono, fallidos) values (v_telefono, 1)
      on conflict (telefono) do update
        set fallidos = case when public.accesos_solicitante.fallidos >= 5 then 1 else public.accesos_solicitante.fallidos + 1 end,
            bloqueado_hasta = case when public.accesos_solicitante.fallidos + 1 = 5 then now() + interval '15 minutes' end;
      return query select null::uuid, 'clave_no_coincide'::text;
      return;
    end if;
    delete from public.accesos_solicitante where telefono = v_telefono;
  end if;

  -- La misma solicitud otra vez en pocos minutos: es un toque repetido, no una necesidad nueva.
  if exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.telefono = v_telefono
       and n.estado in ('registrada', 'en_atencion', 'entregada')
       and lower(btrim(n.titulo)) = lower(btrim(p_titulo))
       and lower(btrim(n.descripcion)) = lower(btrim(p_descripcion))
       and n.registrada_en > now() - public._ventana_duplicados()
  ) then
    raise exception 'Esta necesidad ya quedó registrada hace unos minutos. Mírala en "Mis solicitudes".' using errcode = 'P0001';
  end if;

  if (select count(*) from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = v_telefono
         and n.estado in ('registrada', 'en_atencion', 'entregada')) >= 3 then
    raise exception 'Este celular ya tiene 3 necesidades activas.' using errcode = 'P0001';
  end if;

  select * into v_aprox from public._desplazar(p_lat, p_lng);

  insert into public.necesidades (categoria, titulo, descripcion, urgencia, personas_hogar, sector, lat_aprox, lng_aprox, prioridad_cero)
  values (p_categoria, btrim(p_titulo), btrim(p_descripcion), p_urgencia, p_personas_hogar, btrim(p_sector), v_aprox.lat, v_aprox.lng, coalesce(p_prioridad_cero, false))
  returning id into v_id;

  loop
    v_codigo := public._generar_codigo();
    begin
      insert into public.necesidades_privado (necesidad_id, nombre, telefono, lat, lng, referencias, codigo_hash, clave_hash)
      values (v_id, btrim(p_nombre), v_telefono, p_lat, p_lng, coalesce(btrim(p_referencias), ''),
              public._hash_codigo(v_codigo), extensions.crypt(p_clave, extensions.gen_salt('bf', 8)));
      exit;
    exception when unique_violation then
      -- otro codigo
    end;
  end loop;

  perform public._registrar_evento(v_id, 'registrada', null, 'Solicitante');
  return query select v_id, v_codigo;
end
$$;

revoke execute on function public._ventana_duplicados() from public, anon, authenticated;
revoke execute on function public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text, text, boolean) from public;
grant execute on function public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text, text, boolean) to anon, authenticated;
