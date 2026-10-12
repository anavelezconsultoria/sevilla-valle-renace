-- =============================================================================
-- 1. Prioridad 0: hogares con bebes o adultos mayores se atienden primero.
-- 2. Un celular, una clave: si el celular ya tiene clave, la nueva solicitud
--    debe usar la misma (con el mismo freno de 5 intentos).
-- 3. Coordinacion: un perfil coordinador puede asignar una clave nueva a un
--    solicitante que la olvido (despues de verificarlo llamando a su celular).
-- Todo es aditivo: las solicitudes y los clientes actuales siguen funcionando.
-- =============================================================================

alter table public.necesidades add column prioridad_cero boolean not null default false;
alter table public.perfiles add column es_coordinador boolean not null default false;

-- Solicitudes activas que ya mencionan bebes o adultos mayores pasan a prioridad 0.
update public.necesidades
   set prioridad_cero = true
 where estado in ('registrada', 'en_atencion', 'entregada')
   and (titulo || ' ' || descripcion) ~* '(beb[eé]|reci[eé]n nacid|embaraz|abuel|adulto mayor|adultos mayores|tercera edad|pañales de adulto)';

-- ---------------------------------------------------------------------------
-- Registro: prioridad 0 y una sola clave por celular.
-- ---------------------------------------------------------------------------
drop function if exists public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text, text);

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

-- ---------------------------------------------------------------------------
-- Coordinacion: asignar clave nueva a un solicitante verificado.
-- ---------------------------------------------------------------------------
create or replace function public.restablecer_clave_solicitante(p_telefono text, p_clave text)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_cambiadas int;
begin
  if not v_perfil.es_coordinador then
    raise exception 'Solo la coordinación puede asignar claves.' using errcode = '42501';
  end if;
  perform public._validar_clave(p_clave);
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final del celular. Elige otra.' using errcode = 'P0001';
  end if;

  update public.necesidades_privado
     set clave_hash = extensions.crypt(p_clave, extensions.gen_salt('bf', 8))
   where telefono = v_telefono;
  get diagnostics v_cambiadas = row_count;
  if v_cambiadas = 0 then
    raise exception 'No hay solicitudes registradas con ese celular.' using errcode = 'P0002';
  end if;

  delete from public.accesos_solicitante where telefono = v_telefono;
  return v_cambiadas;
end
$$;

-- Permisos: solo la API publica.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.consultar_por_codigo(text) to anon, authenticated;
grant execute on function public.confirmar_recibida(text) to anon, authenticated;
grant execute on function public.reportar_no_recibida(text, text) to anon, authenticated;
grant execute on function public.cancelar_necesidad(text) to anon, authenticated;
grant execute on function public.mis_necesidades(text, text) to anon, authenticated;
grant execute on function public.confirmar_con_clave(uuid, text, text) to anon, authenticated;
grant execute on function public.no_recibida_con_clave(uuid, text, text, text) to anon, authenticated;
grant execute on function public.cancelar_con_clave(uuid, text, text) to anon, authenticated;
grant execute on function public.restablecer_clave_solicitante(text, text) to authenticated;
grant execute on function public.asegurar_perfil(text, text) to authenticated;
grant execute on function public.tomar_necesidad(uuid) to authenticated;
grant execute on function public.liberar_necesidad(uuid) to authenticated;
grant execute on function public.entregar_necesidad(uuid, text, text[]) to authenticated;
grant execute on function public.contacto_necesidad(uuid) to authenticated;
