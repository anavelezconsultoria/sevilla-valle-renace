-- =============================================================================
-- Quien pide ayuda se identifica con su CELULAR + una CLAVE de 4 numeros que
-- elige al registrar (en lugar de un codigo aleatorio dificil de recordar).
--
-- Por que celular + clave y no solo celular: quien ayuda VE el celular de la
-- familia; sin la clave podria confirmar la entrega por ella.
-- Contra fuerza bruta: 5 intentos fallidos por celular bloquean 15 minutos.
-- El codigo aleatorio se conserva internamente: el celular que registro la
-- necesidad lo guarda para confirmar con un toque.
-- =============================================================================

alter table public.necesidades_privado add column clave_hash text;

-- Intentos de acceso por celular: freno a quien pruebe claves.
create table public.accesos_solicitante (
  telefono text primary key,
  fallidos int not null default 0,
  bloqueado_hasta timestamptz
);
alter table public.accesos_solicitante enable row level security;
revoke all on public.accesos_solicitante from anon, authenticated;

create or replace function public._normalizar_telefono(p_telefono text)
returns text language sql immutable
set search_path = ''
as $$ select regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g') $$;

create or replace function public._validar_clave(p_clave text)
returns void language plpgsql immutable
set search_path = ''
as $$
begin
  if coalesce(p_clave, '') !~ '^[0-9]{4}$' then
    raise exception 'La clave debe tener 4 números.' using errcode = 'P0001';
  end if;
  if p_clave in ('0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '9876') then
    raise exception 'Esa clave es muy fácil de adivinar. Elige otra.' using errcode = 'P0001';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Las acciones del solicitante, separadas de COMO se identifica (codigo o clave).
-- ---------------------------------------------------------------------------
create or replace function public._confirmar(p_necesidad uuid)
returns uuid language plpgsql volatile
set search_path = ''
as $$
begin
  update public.necesidades
     set estado = 'atendida', cierre = 'confirmada', vence_en = null, actualizada_en = now()
   where id = p_necesidad and estado = 'entregada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'confirmada', null, 'Solicitante');
  return p_necesidad;
end
$$;

create or replace function public._no_recibida(p_necesidad uuid, p_nota text)
returns uuid language plpgsql volatile
set search_path = ''
as $$
begin
  update public.necesidades
     set estado = 'en_atencion', vence_en = now() + public._horas_para_entregar(), actualizada_en = now()
   where id = p_necesidad and estado = 'entregada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'no_recibida', null, 'Solicitante', left(p_nota, 400));
  return p_necesidad;
end
$$;

create or replace function public._cancelar(p_necesidad uuid)
returns uuid language plpgsql volatile
set search_path = ''
as $$
begin
  update public.necesidades
     set estado = 'cancelada', actualizada_en = now()
   where id = p_necesidad and estado = 'registrada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'cancelada', null, 'Solicitante');
  return p_necesidad;
end
$$;

-- Las versiones por codigo (las usa el celular que registro) delegan en las anteriores.
create or replace function public.confirmar_recibida(p_codigo text)
returns uuid language sql volatile security definer
set search_path = ''
as $$ select public._confirmar((public._necesidad_por_codigo(p_codigo)).id) $$;

create or replace function public.reportar_no_recibida(p_codigo text, p_nota text)
returns uuid language sql volatile security definer
set search_path = ''
as $$ select public._no_recibida((public._necesidad_por_codigo(p_codigo)).id, p_nota) $$;

create or replace function public.cancelar_necesidad(p_codigo text)
returns uuid language sql volatile security definer
set search_path = ''
as $$ select public._cancelar((public._necesidad_por_codigo(p_codigo)).id) $$;

-- ---------------------------------------------------------------------------
-- Verificacion por celular + clave, con bloqueo por intentos fallidos.
-- Un fallo de clave NO lanza excepcion: devuelve vacio/null, porque una
-- excepcion desharia el conteo de intentos y el bloqueo nunca llegaria.
-- ---------------------------------------------------------------------------
create or replace function public._ids_por_clave(p_telefono text, p_clave text)
returns uuid[]
language plpgsql volatile
set search_path = ''
as $$
declare
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_acceso public.accesos_solicitante;
  v_ids uuid[];
begin
  select * into v_acceso from public.accesos_solicitante where telefono = v_telefono;
  if v_acceso.bloqueado_hasta is not null and v_acceso.bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' using errcode = 'P0003';
  end if;

  select array_agg(pr.necesidad_id) into v_ids
    from public.necesidades_privado pr
   where pr.telefono = v_telefono
     and pr.clave_hash is not null
     and pr.clave_hash = extensions.crypt(coalesce(p_clave, ''), pr.clave_hash);

  if v_ids is null then
    insert into public.accesos_solicitante (telefono, fallidos) values (v_telefono, 1)
    on conflict (telefono) do update
      set fallidos = case when public.accesos_solicitante.fallidos >= 5 then 1 else public.accesos_solicitante.fallidos + 1 end,
          bloqueado_hasta = case when public.accesos_solicitante.fallidos + 1 = 5 then now() + interval '15 minutes' end;
    return '{}';
  end if;

  delete from public.accesos_solicitante where telefono = v_telefono;
  return v_ids;
end
$$;

create or replace function public._clave_valida_para(p_necesidad uuid, p_telefono text, p_clave text)
returns boolean language sql volatile
set search_path = ''
as $$ select p_necesidad = any (public._ids_por_clave(p_telefono, p_clave)) $$;

-- Vacio = el celular o la clave no coinciden.
create or replace function public.mis_necesidades(p_telefono text, p_clave text)
returns setof uuid language sql volatile security definer
set search_path = ''
as $$ select unnest(public._ids_por_clave(p_telefono, p_clave)) $$;

-- Las acciones con clave devuelven null cuando el celular o la clave no coinciden.
create or replace function public.confirmar_con_clave(p_necesidad uuid, p_telefono text, p_clave text)
returns uuid language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public._clave_valida_para(p_necesidad, p_telefono, p_clave) then
    return null;
  end if;
  return public._confirmar(p_necesidad);
end
$$;

create or replace function public.no_recibida_con_clave(p_necesidad uuid, p_telefono text, p_clave text, p_nota text)
returns uuid language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public._clave_valida_para(p_necesidad, p_telefono, p_clave) then
    return null;
  end if;
  return public._no_recibida(p_necesidad, p_nota);
end
$$;

create or replace function public.cancelar_con_clave(p_necesidad uuid, p_telefono text, p_clave text)
returns uuid language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public._clave_valida_para(p_necesidad, p_telefono, p_clave) then
    return null;
  end if;
  return public._cancelar(p_necesidad);
end
$$;

-- ---------------------------------------------------------------------------
-- Registro con clave
-- ---------------------------------------------------------------------------
drop function if exists public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text);

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
  p_referencias text default ''
) returns table (necesidad_id uuid, codigo text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_codigo text;
  v_id uuid;
  v_aprox record;
begin
  perform public._validar_clave(p_clave);
  -- Quien ayuda ve el celular: la clave no puede salir de el.
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final de tu celular. Elige otra.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = v_telefono
         and n.estado in ('registrada', 'en_atencion', 'entregada')) >= 3 then
    raise exception 'Este celular ya tiene 3 necesidades activas.' using errcode = 'P0001';
  end if;

  select * into v_aprox from public._desplazar(p_lat, p_lng);

  insert into public.necesidades (categoria, titulo, descripcion, urgencia, personas_hogar, sector, lat_aprox, lng_aprox)
  values (p_categoria, btrim(p_titulo), btrim(p_descripcion), p_urgencia, p_personas_hogar, btrim(p_sector), v_aprox.lat, v_aprox.lng)
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

-- Permisos: solo la API publica.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text, text) to anon, authenticated;
grant execute on function public.consultar_por_codigo(text) to anon, authenticated;
grant execute on function public.confirmar_recibida(text) to anon, authenticated;
grant execute on function public.reportar_no_recibida(text, text) to anon, authenticated;
grant execute on function public.cancelar_necesidad(text) to anon, authenticated;
grant execute on function public.mis_necesidades(text, text) to anon, authenticated;
grant execute on function public.confirmar_con_clave(uuid, text, text) to anon, authenticated;
grant execute on function public.no_recibida_con_clave(uuid, text, text, text) to anon, authenticated;
grant execute on function public.cancelar_con_clave(uuid, text, text) to anon, authenticated;
grant execute on function public.asegurar_perfil(text, text) to authenticated;
grant execute on function public.tomar_necesidad(uuid) to authenticated;
grant execute on function public.liberar_necesidad(uuid) to authenticated;
grant execute on function public.entregar_necesidad(uuid, text, text[]) to authenticated;
grant execute on function public.contacto_necesidad(uuid) to authenticated;
